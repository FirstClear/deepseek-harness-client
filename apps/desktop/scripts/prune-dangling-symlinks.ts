/**
 * `pnpm deploy` leaves `.bin` shims whose targets were never copied. Those
 * dangling links survive into the .app bundle, so `xattr -cr` and Gatekeeper
 * report missing files and macOS calls the app damaged.
 */

import { readdir, stat, unlink } from 'node:fs/promises'
import { join } from 'node:path'

export async function pruneDanglingSymlinks(root: string): Promise<void> {
  const entries = await readdir(root, { withFileTypes: true })
  for (const entry of entries) {
    const path = join(root, entry.name)
    if (entry.isSymbolicLink()) {
      try {
        await stat(path)
      } catch {
        await unlink(path)
      }
    } else if (entry.isDirectory()) {
      await pruneDanglingSymlinks(path)
    }
  }
}
