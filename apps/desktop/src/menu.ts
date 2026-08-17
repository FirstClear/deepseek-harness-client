/**
 * Application-menu policy for the desktop shell.
 * macOS uses the system menu bar; Windows and Linux must not show Electron's
 * default in-window File/Edit/View bar over the Web UI.
 * @module @deepseek-ai/dsh-desktop/menu
 */

/**
 * Whether this platform should keep a native application menu.
 * @param platform - `process.platform`.
 */
export function wantsNativeMenuBar(platform: NodeJS.Platform): boolean {
  return platform === 'darwin'
}
