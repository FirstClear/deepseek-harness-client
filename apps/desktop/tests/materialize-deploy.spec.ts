import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { copyMissingWorkspacePackages, materializeSymlinks } from '../scripts/materialize-deploy.ts'

describe('copyMissingWorkspacePackages', () => {
  it('copies a missing required peer and then that peer\'s workspace dependency', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-fill-'))
    try {
      const dest = join(root, 'dest')
      const group = join(root, 'group')
      const cosmokit = join(root, 'cosmokit')
      await mkdir(join(dest, 'node_modules', '@deepseek-ai', 'dsh-app-boot'), { recursive: true })
      await writeFile(join(dest, 'package.json'), JSON.stringify({
        name: '@deepseek-ai/dsh',
        dependencies: { '@deepseek-ai/dsh-app-boot': 'workspace:^' },
      }))
      await writeFile(join(dest, 'node_modules', '@deepseek-ai', 'dsh-app-boot', 'package.json'), JSON.stringify({
        name: '@deepseek-ai/dsh-app-boot',
        peerDependencies: { '@deepseek-ai/cordis-plugin-group': 'workspace:^' },
      }))
      await mkdir(group)
      await writeFile(join(group, 'package.json'), JSON.stringify({
        name: '@deepseek-ai/cordis-plugin-group',
        dependencies: { '@deepseek-ai/cosmokit': 'workspace:^' },
      }))
      await writeFile(join(group, 'index.js'), 'export {}\n')
      await mkdir(cosmokit)
      await writeFile(join(cosmokit, 'package.json'), JSON.stringify({ name: '@deepseek-ai/cosmokit' }))
      await writeFile(join(cosmokit, 'index.js'), 'export {}\n')
      const restored = await copyMissingWorkspacePackages(dest, new Map([
        ['@deepseek-ai/dsh-app-boot', join(dest, 'node_modules', '@deepseek-ai', 'dsh-app-boot')],
        ['@deepseek-ai/cordis-plugin-group', group],
        ['@deepseek-ai/cosmokit', cosmokit],
      ]))
      expect(restored).toEqual(['@deepseek-ai/cordis-plugin-group', '@deepseek-ai/cosmokit'])
      expect(await readFile(join(dest, 'node_modules', '@deepseek-ai', 'cosmokit', 'index.js'), 'utf8')).toBe('export {}\n')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})

describe('materializeSymlinks', () => {
  it('replaces a package symlink with real files and drops .bin shims', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-mat-'))
    try {
      const nodeModules = join(root, 'node_modules')
      const real = join(root, 'real-pkg')
      await mkdir(join(nodeModules, '.bin'), { recursive: true })
      await mkdir(real)
      await writeFile(join(real, 'index.js'), 'ok\n')
      try {
        await symlink(real, join(nodeModules, 'pkg'))
        await symlink('../pkg/index.js', join(nodeModules, '.bin', 'pkg'))
      } catch (error) {
        if (process.platform === 'win32') return
        throw error
      }
      await materializeSymlinks(nodeModules)
      expect(await readFile(join(nodeModules, 'pkg', 'index.js'), 'utf8')).toBe('ok\n')
      await expect(readFile(join(nodeModules, '.bin', 'pkg'))).rejects.toMatchObject({ code: 'ENOENT' })
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
