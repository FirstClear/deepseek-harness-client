/**
 * After `pnpm deploy --legacy`, restore workspace packages the hoister omitted
 * (link: overrides such as cosmokit, required peers such as cordis-plugin-group)
 * and replace remaining symlinks with real files so the .app is self-contained.
 */

import { existsSync, globSync } from 'node:fs'
import { cp, lstat, mkdir, readdir, readFile, realpath, rm } from 'node:fs/promises'
import { dirname, join, sep } from 'node:path'

interface PackageManifest {
  name?: string
  dependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  peerDependenciesMeta?: Record<string, { optional?: boolean }>
}

export async function loadWorkspaceDirectories(root: string): Promise<Map<string, string>> {
  const paths = globSync(['packages/*/*/package.json', 'vendor/*/package.json', 'apps/*/package.json'], { cwd: root })
  const result = new Map<string, string>()
  for (const relative of paths.sort()) {
    const manifestPath = join(root, relative)
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as PackageManifest
    if (manifest.name !== undefined) result.set(manifest.name, dirname(manifestPath))
  }
  return result
}

export async function copyMissingWorkspacePackages(
  dest: string,
  workspace: ReadonlyMap<string, string>,
): Promise<string[]> {
  const restored: string[] = []
  let changed = true
  while (changed) {
    changed = false
    const needed = new Set<string>()
    for (const name of requiredWorkspaceRefs(await readManifest(join(dest, 'package.json')), workspace)) {
      needed.add(name)
    }
    for (const installed of await listInstalledWorkspaceDirs(dest, workspace)) {
      for (const name of requiredWorkspaceRefs(await readManifest(join(installed, 'package.json')), workspace)) {
        needed.add(name)
      }
    }
    for (const name of [...needed].sort()) {
      const destination = join(dest, 'node_modules', ...name.split('/'))
      if (existsSync(destination)) continue
      const source = workspace.get(name)
      if (source === undefined) continue
      await mkdir(dirname(destination), { recursive: true })
      await rm(destination, { recursive: true, force: true })
      const nestedNodeModules = join(source, 'node_modules')
      await cp(source, destination, {
        recursive: true,
        dereference: true,
        filter: path => path !== nestedNodeModules && !path.startsWith(nestedNodeModules + sep),
      })
      restored.push(name)
      changed = true
    }
  }
  return restored
}

export async function materializeSymlinks(nodeModules: string): Promise<void> {
  let remaining = await findSymlink(nodeModules)
  while (remaining !== undefined) {
    const segments = remaining.slice(nodeModules.length + 1).split(sep)
    const binIndex = segments.lastIndexOf('.bin')
    if (binIndex >= 0) {
      await rm(join(nodeModules, ...segments.slice(0, binIndex + 1)), { recursive: true, force: true })
      remaining = await findSymlink(nodeModules)
      continue
    }
    const destination = remaining
    const source = await realpath(destination)
    const nestedNodeModules = join(source, 'node_modules')
    await rm(destination, { recursive: true, force: true })
    await cp(source, destination, {
      recursive: true,
      dereference: true,
      filter: path => path !== nestedNodeModules && !path.startsWith(nestedNodeModules + sep),
    })
    remaining = await findSymlink(nodeModules)
  }
}

function requiredWorkspaceRefs(manifest: PackageManifest, workspace: ReadonlyMap<string, string>): string[] {
  const names = [
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.optionalDependencies ?? {}),
    ...Object.keys(manifest.peerDependencies ?? {}).filter(peer => manifest.peerDependenciesMeta?.[peer]?.optional !== true),
  ]
  return names.filter(name => workspace.has(name))
}

async function listInstalledWorkspaceDirs(dest: string, workspace: ReadonlyMap<string, string>): Promise<string[]> {
  const nodeModules = join(dest, 'node_modules')
  if (!existsSync(nodeModules)) return []
  const found: string[] = []
  for (const [name] of workspace) {
    const path = join(nodeModules, ...name.split('/'))
    if (existsSync(path)) found.push(path)
  }
  return found
}

async function readManifest(path: string): Promise<PackageManifest> {
  return JSON.parse(await readFile(path, 'utf8')) as PackageManifest
}

async function findSymlink(directory: string): Promise<string | undefined> {
  let entries
  try {
    entries = await readdir(directory, { withFileTypes: true })
  } catch {
    return undefined
  }
  for (const entry of entries) {
    const path = join(directory, entry.name)
    const metadata = await lstat(path)
    if (metadata.isSymbolicLink()) return path
    if (metadata.isDirectory()) {
      const nested = await findSymlink(path)
      if (nested !== undefined) return nested
    }
  }
  return undefined
}
