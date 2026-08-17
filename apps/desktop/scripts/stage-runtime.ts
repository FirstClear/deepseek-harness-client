/**
 * Stage the desktop extraResources tree: a production `pnpm deploy` of
 * `@deepseek-ai/dsh` plus an official Node binary so the installer does not
 * require a system Node or pnpm.
 */

import { spawn } from 'node:child_process'
import { createWriteStream } from 'node:fs'
import { chmod, cp, mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { parseArgs } from 'node:util'
import { pruneDanglingSymlinks } from './prune-dangling-symlinks.ts'

const ROOT = join(import.meta.dirname, '../../..')
const DESKTOP = join(ROOT, 'apps/desktop')
const RUNTIME = join(DESKTOP, 'runtime')
const NODE_VERSION = '22.23.1'

const PLATFORMS = ['darwin', 'win32'] as const
const ARCHES = ['arm64', 'x64'] as const
type StagePlatform = (typeof PLATFORMS)[number]
type StageArch = (typeof ARCHES)[number]

function isPlatform(value: string): value is StagePlatform {
  return (PLATFORMS as readonly string[]).includes(value)
}

function isArch(value: string): value is StageArch {
  return (ARCHES as readonly string[]).includes(value)
}

function nodeDist(platform: StagePlatform, arch: StageArch): { url: string; archive: 'tar.gz' | 'zip'; binary: string } {
  if (platform === 'win32') {
    const name = `node-v${NODE_VERSION}-win-${arch}`
    return {
      url: `https://nodejs.org/dist/v${NODE_VERSION}/${name}.zip`,
      archive: 'zip',
      binary: `${name}/node.exe`,
    }
  }
  const name = `node-v${NODE_VERSION}-darwin-${arch}`
  return {
    url: `https://nodejs.org/dist/v${NODE_VERSION}/${name}.tar.gz`,
    archive: 'tar.gz',
    binary: `${name}/bin/node`,
  }
}

async function run(command: string, args: string[], cwd: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: 'inherit',
      // Windows `.cmd` shims (pnpm) are not found by spawn() without a shell.
      shell: process.platform === 'win32',
      windowsHide: true,
    })
    child.once('error', reject)
    child.once('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${command} ${args.join(' ')} exited ${String(code)}`))
    })
  })
}

async function download(url: string, dest: string): Promise<void> {
  const response = await fetch(url)
  if (!response.ok || response.body === null) {
    throw new Error(`dsh-desktop: failed to download ${url}: ${String(response.status)}`)
  }
  await pipeline(Readable.fromWeb(response.body), createWriteStream(dest))
}

async function extract(archive: string, kind: 'tar.gz' | 'zip', dest: string): Promise<void> {
  await mkdir(dest, { recursive: true })
  if (kind === 'tar.gz') {
    await run('tar', ['-xzf', archive, '-C', dest], dest)
    return
  }
  // Windows runners have no unzip; bsdtar on win32 reads zip. macOS/Linux keep unzip.
  if (process.platform === 'win32') {
    await run('tar', ['-xf', archive, '-C', dest], dest)
    return
  }
  await run('unzip', ['-q', archive, '-d', dest], dest)
}

async function main(): Promise<void> {
  const parsed = parseArgs({
    args: process.argv.slice(2).filter(arg => arg !== '--'),
    options: {
      platform: { type: 'string' },
      arch: { type: 'string' },
    },
  })
  const platform = parsed.values.platform ?? process.platform
  const arch = parsed.values.arch ?? process.arch
  if (!isPlatform(platform)) throw new Error(`dsh-desktop: unsupported --platform ${platform}`)
  if (!isArch(arch)) throw new Error(`dsh-desktop: unsupported --arch ${arch}`)

  await rm(RUNTIME, { recursive: true, force: true })
  await mkdir(join(RUNTIME, 'app'), { recursive: true })

  await run('pnpm', [
    '--filter',
    '@deepseek-ai/dsh',
    'deploy',
    '--legacy',
    '--prod',
    '--config.node-linker=hoisted',
    '--config.auto-install-peers=false',
    '--config.link-workspace-packages=true',
    join(RUNTIME, 'app'),
  ], ROOT)
  await cp(join(RUNTIME, 'app'), join(RUNTIME, 'app.real'), { recursive: true })
  await rm(join(RUNTIME, 'app'), { recursive: true, force: true })
  await cp(join(RUNTIME, 'app.real'), join(RUNTIME, 'app'), { recursive: true })
  await rm(join(RUNTIME, 'app.real'), { recursive: true, force: true })
  await pruneDanglingSymlinks(join(RUNTIME, 'app'))

  const dist = nodeDist(platform, arch)
  const scratch = join(tmpdir(), `dsh-desktop-node-${String(process.pid)}`)
  await rm(scratch, { recursive: true, force: true })
  await mkdir(scratch, { recursive: true })
  const archivePath = join(scratch, dist.archive === 'zip' ? 'node.zip' : 'node.tar.gz')
  await download(dist.url, archivePath)
  await extract(archivePath, dist.archive, scratch)
  const nodeDest = join(RUNTIME, platform === 'win32' ? 'node.exe' : 'node')
  await cp(join(scratch, dist.binary), nodeDest)
  if (platform !== 'win32') await chmod(nodeDest, 0o755)
  await rm(scratch, { recursive: true, force: true })
}

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exit(1)
})
