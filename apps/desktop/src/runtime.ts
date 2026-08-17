/**
 * Resolve the Node binary and `dsh` CLI entry the desktop shell spawns.
 * Packaged installs use the extraResources runtime; unpackaged launches use
 * the repository checkout that built this shell.
 * @module @deepseek-ai/dsh-desktop/runtime
 */

import { join } from 'node:path'

/** Spawn inputs for one desktop host process. */
export interface DesktopRuntime {
  /** Absolute path of a Node ≥22 binary, never Electron's `process.execPath`. */
  nodeBin: string
  /** Absolute path of `@deepseek-ai/dsh`'s built `lib/bin.js`. */
  cliBin: string
  /** Working directory inherited by the host; becomes the default workspace root. */
  cwd: string
}

/** Filesystem facts the resolver needs; tests substitute these. */
export interface RuntimeRequest {
  /** `app.isPackaged`. */
  packaged: boolean
  /** Electron `process.resourcesPath` when packaged. */
  resourcesPath: string
  /** Repository root of an unpackaged checkout. */
  repoRoot: string
  /** Node executable from the launching package manager (`npm_node_execpath`). */
  nodeExecPath: string
  /** `process.platform`. */
  platform: NodeJS.Platform
  /** Directory used as the host cwd. */
  homedir: string
}

/**
 * Resolve the host spawn paths for this launch.
 * @param request - packaged vs checkout filesystem facts.
 * @returns Node, CLI entry, and cwd.
 */
export function resolveDesktopRuntime(request: RuntimeRequest): DesktopRuntime {
  if (request.packaged) {
    const runtimeRoot = join(request.resourcesPath, 'runtime')
    return {
      nodeBin: join(runtimeRoot, request.platform === 'win32' ? 'node.exe' : 'node'),
      cliBin: join(runtimeRoot, 'app', 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js'),
      cwd: request.homedir,
    }
  }
  return {
    nodeBin: request.nodeExecPath,
    cliBin: join(request.repoRoot, 'apps', 'cli', 'lib', 'bin.js'),
    cwd: request.homedir,
  }
}
