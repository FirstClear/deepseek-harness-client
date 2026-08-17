import { lstat, mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { pruneDanglingSymlinks } from '../scripts/prune-dangling-symlinks.ts'

describe('pruneDanglingSymlinks', () => {
  it('removes dangling bin links and keeps live files and live links', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-prune-'))
    try {
      const bin = join(root, 'node_modules', '.bin')
      await mkdir(bin, { recursive: true })
      await writeFile(join(root, 'keep.txt'), 'ok')
      await writeFile(join(bin, 'real-target.js'), 'console.log(1)\n')
      try {
        await symlink('real-target.js', join(bin, 'live'))
        await symlink('missing-package/cli.js', join(bin, 'loose-envify'))
        await symlink('../missing/cordis', join(root, 'node_modules', 'cordis'))
      } catch (error) {
        if (process.platform === 'win32') return
        throw error
      }
      await pruneDanglingSymlinks(root)
      await expect(lstat(join(bin, 'live'))).resolves.toBeDefined()
      await expect(lstat(join(root, 'keep.txt'))).resolves.toBeDefined()
      await expect(lstat(join(bin, 'loose-envify'))).rejects.toMatchObject({ code: 'ENOENT' })
      await expect(lstat(join(root, 'node_modules', 'cordis'))).rejects.toMatchObject({ code: 'ENOENT' })
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
