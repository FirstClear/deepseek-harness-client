/**
 * Parse the `dsh web` readiness line the desktop shell waits on before loading
 * the UI. The web bundle prints that line only after its Loader tree settles.
 * @module @deepseek-ai/dsh-desktop/ready-url
 */

/** Loopback URL captured from a `dsh web:` readiness line. */
const READY_LINE = /^dsh web: (http:\/\/127\.0\.0\.1:\d+)\b/m

/**
 * Return the loopback URL from accumulated `dsh web` stdout, or `undefined`
 * when no readiness line has arrived yet.
 * @param text - stdout collected so far, including partial chunks.
 * @returns the loopback origin, or `undefined`.
 */
export function parseReadyUrl(text: string): string | undefined {
  return READY_LINE.exec(text)?.[1]
}
