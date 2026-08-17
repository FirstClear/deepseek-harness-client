import { EventEmitter } from 'node:events'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { hostEnvironment, startDesktopHost } from '../src/host.ts'
import { wantsNativeMenuBar, wantsRuntimeDockIcon } from '../src/menu.ts'
import { parseReadyUrl } from '../src/ready-url.ts'
import { resolveDesktopRuntime } from '../src/runtime.ts'

describe('parseReadyUrl', () => {
  it('captures the loopback origin from the settled dsh web line', () => {
    expect(parseReadyUrl('dsh web: http://127.0.0.1:4123\n')).toBe('http://127.0.0.1:4123')
  })

  it('ignores a LAN suffix and still returns the loopback origin', () => {
    expect(parseReadyUrl('dsh web: http://127.0.0.1:3080 (LAN: http://192.168.1.9:3080)\n'))
      .toBe('http://127.0.0.1:3080')
  })

  it('returns undefined until a complete readiness line arrives', () => {
    expect(parseReadyUrl('starting\n')).toBeUndefined()
    expect(parseReadyUrl('dsh web: http://127.0.0.1:')).toBeUndefined()
    expect(parseReadyUrl('dsh web: http://0.0.0.0:3080\n')).toBeUndefined()
  })
})

describe('resolveDesktopRuntime', () => {
  it('points packaged launches at extraResources and unpackaged launches at the checkout', () => {
    const resourcesPath = join('/App', 'Resources')
    const repoRoot = join('/src')
    const homedir = join('/Users', 'a')
    expect(resolveDesktopRuntime({
      packaged: true,
      resourcesPath,
      repoRoot,
      nodeExecPath: '/usr/bin/node',
      platform: 'darwin',
      homedir,
    })).toEqual({
      nodeBin: join(resourcesPath, 'runtime', 'node'),
      cliBin: join(resourcesPath, 'runtime', 'app', 'lib', 'bin.js'),
      cwd: homedir,
    })
    expect(resolveDesktopRuntime({
      packaged: true,
      resourcesPath,
      repoRoot,
      nodeExecPath: '/usr/bin/node',
      platform: 'win32',
      homedir,
    }).nodeBin).toBe(join(resourcesPath, 'runtime', 'node.exe'))
    expect(resolveDesktopRuntime({
      packaged: false,
      resourcesPath: join('/unused'),
      repoRoot,
      nodeExecPath: '/usr/bin/node',
      platform: 'darwin',
      homedir,
    })).toEqual({
      nodeBin: '/usr/bin/node',
      cliBin: join(repoRoot, 'apps', 'cli', 'lib', 'bin.js'),
      cwd: homedir,
    })
  })
})

describe('wantsNativeMenuBar', () => {
  it('keeps the system menu on macOS and hides Electron File chrome elsewhere', () => {
    expect(wantsNativeMenuBar('darwin')).toBe(true)
    expect(wantsNativeMenuBar('win32')).toBe(false)
    expect(wantsNativeMenuBar('linux')).toBe(false)
  })

  it('does not replace the packaged macOS Dock icon with a PNG', () => {
    expect(wantsRuntimeDockIcon('darwin', false)).toBe(true)
    expect(wantsRuntimeDockIcon('darwin', true)).toBe(false)
    expect(wantsRuntimeDockIcon('win32', false)).toBe(false)
  })
})

describe('hostEnvironment', () => {
  it('drops Electron variables so the child loads as Node', () => {
    expect(hostEnvironment({
      PATH: '/bin',
      ELECTRON_RUN_AS_NODE: '1',
      ELECTRON_NO_ASAR: '1',
      DSH_HOME: '/tmp/dsh',
    })).toEqual({
      PATH: '/bin',
      DSH_HOME: '/tmp/dsh',
    })
  })
})

describe('startDesktopHost', () => {
  it('resolves once stdout contains the readiness line', async () => {
    const child = Object.assign(new EventEmitter(), {
      stdout: new EventEmitter(),
      stderr: new EventEmitter(),
      exitCode: null as number | null,
      signalCode: null as NodeJS.Signals | null,
      kill: vi.fn(),
    })
    const spawned = vi.fn().mockReturnValue(child)
    const started = startDesktopHost({
      runtime: { nodeBin: '/node', cliBin: '/bin.js', cwd: '/tmp' },
      env: { PATH: '/bin' },
      spawn: spawned as never,
      timeoutMs: 1_000,
    })
    child.stdout.emit('data', Buffer.from('dsh web: http://127.0.0.1:4099\n'))
    await expect(started).resolves.toMatchObject({ url: 'http://127.0.0.1:4099' })
    expect(spawned).toHaveBeenCalledWith('/node', ['/bin.js', 'web', '--port', '0'], expect.objectContaining({
      cwd: '/tmp',
      windowsHide: true,
    }))
    child.exitCode = null
    const stopping = (await started).stop()
    expect(child.kill).toHaveBeenCalledWith('SIGTERM')
    child.emit('exit', 0, 'SIGTERM')
    await stopping
  })

  it('rejects when the child exits before a readiness line', async () => {
    const child = Object.assign(new EventEmitter(), {
      stdout: new EventEmitter(),
      stderr: new EventEmitter(),
      exitCode: null as number | null,
      signalCode: null as NodeJS.Signals | null,
      kill: vi.fn(),
    })
    const started = startDesktopHost({
      runtime: { nodeBin: '/node', cliBin: '/bin.js', cwd: '/tmp' },
      env: {},
      spawn: vi.fn().mockReturnValue(child) as never,
      timeoutMs: 1_000,
    })
    child.stderr.emit('data', Buffer.from("Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@deepseek-ai/cordis-plugin-group'\n"))
    child.emit('exit', 1, null)
    await expect(started).rejects.toThrow(/cordis-plugin-group/)
  })
})
