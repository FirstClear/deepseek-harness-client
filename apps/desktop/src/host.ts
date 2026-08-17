/**
 * Spawn `dsh web --port 0` as a child Node process and wait for its readiness
 * URL. The desktop window is a BrowserWindow over that loopback origin; the
 * child owns the harness. Native addons therefore load against bundled Node,
 * not Electron's ABI.
 * @module @deepseek-ai/dsh-desktop/host
 */

import { spawn, type ChildProcess } from 'node:child_process'
import { parseReadyUrl } from './ready-url.ts'
import type { DesktopRuntime } from './runtime.ts'

/** Default wait for the `dsh web:` line after spawn. */
export const HOST_READY_TIMEOUT_MS = 60_000

/** A running desktop host and the origin the window should load. */
export interface DesktopHost {
  /** Loopback origin printed by `dsh web`. */
  url: string
  /** SIGTERM the child, then SIGKILL if it is still alive after `killTimeoutMs`. */
  stop(): Promise<void>
}

/** Spawn function the host uses; tests substitute a fake. */
export type SpawnFn = typeof spawn

/** Options for {@link startDesktopHost}. */
export interface StartDesktopHostOptions {
  /** Resolved Node + CLI paths. */
  runtime: DesktopRuntime
  /** Environment forwarded to the child. `ELECTRON_*` keys are stripped. */
  env: NodeJS.ProcessEnv
  /** Spawn implementation. */
  spawn: SpawnFn
  /** Readiness timeout. */
  timeoutMs?: number
  /** Grace before SIGKILL. */
  killTimeoutMs?: number
}

/**
 * Start the web profile on an OS-assigned loopback port and resolve once the
 * readiness line arrives.
 * @param options - runtime, environment, and test seams.
 * @returns the live host.
 * @throws when the child exits first, or the readiness line does not arrive in time.
 */
export async function startDesktopHost(options: StartDesktopHostOptions): Promise<DesktopHost> {
  const timeoutMs = options.timeoutMs ?? HOST_READY_TIMEOUT_MS
  const killTimeoutMs = options.killTimeoutMs ?? 5_000
  const child = options.spawn(options.runtime.nodeBin, [options.runtime.cliBin, 'web', '--port', '0'], {
    cwd: options.runtime.cwd,
    env: hostEnvironment(options.env),
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })

  let stdout = ''
  const url = await new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup()
      reject(new Error(`dsh-desktop: host did not print a ready URL within ${String(timeoutMs)}ms`))
    }, timeoutMs)
    const onExit = (code: number | null, signal: NodeJS.Signals | null): void => {
      cleanup()
      reject(new Error(`dsh-desktop: host exited before ready (code ${String(code)}, signal ${String(signal)})`))
    }
    const onStdout = (chunk: Buffer | string): void => {
      stdout += typeof chunk === 'string' ? chunk : chunk.toString('utf8')
      const ready = parseReadyUrl(stdout)
      if (ready === undefined) return
      cleanup()
      resolve(ready)
    }
    const onError = (error: Error): void => {
      cleanup()
      reject(error)
    }
    const cleanup = (): void => {
      clearTimeout(timer)
      child.stdout.off('data', onStdout)
      child.off('exit', onExit)
      child.off('error', onError)
    }
    child.stdout.on('data', onStdout)
    child.stderr.on('data', (chunk: Buffer | string) => {
      process.stderr.write(chunk)
    })
    child.once('exit', onExit)
    child.once('error', onError)
  })

  return {
    url,
    stop: () => stopChild(child, killTimeoutMs),
  }
}

/**
 * Build the child environment: keep the user's `DSH_HOME` / credentials, and
 * drop Electron variables that would make Node load as Electron.
 * @param env - parent environment.
 * @returns the child environment.
 */
export function hostEnvironment(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const next: NodeJS.ProcessEnv = {}
  for (const [key, value] of Object.entries(env)) {
    if (key.startsWith('ELECTRON_')) continue
    next[key] = value
  }
  return next
}

/**
 * Terminate the host child.
 * @param child - the spawned process.
 * @param killTimeoutMs - SIGKILL delay.
 * @returns once the child has exited.
 */
function stopChild(child: ChildProcess, killTimeoutMs: number): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve()
  return new Promise((resolve) => {
    const timer = setTimeout(() => { child.kill('SIGKILL') }, killTimeoutMs)
    child.once('exit', () => {
      clearTimeout(timer)
      resolve()
    })
    child.kill('SIGTERM')
  })
}
