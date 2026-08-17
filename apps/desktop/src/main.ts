/**
 * Electron main process for the DeepSeek Harness desktop shell: start the
 * bundled `dsh web` host, open a BrowserWindow on its loopback origin, and
 * dispose the host when the app quits.
 * @module @deepseek-ai/dsh-desktop/main
 */

import { spawn } from 'node:child_process'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { app, BrowserWindow, dialog, Menu, shell } from 'electron'
import { startDesktopHost, type DesktopHost } from './host.ts'
import { wantsNativeMenuBar } from './menu.ts'
import { resolveDesktopRuntime } from './runtime.ts'

const PACKAGE_ROOT = dirname(fileURLToPath(new URL('../package.json', import.meta.url)))
const REPO_ROOT = dirname(dirname(PACKAGE_ROOT))

/**
 * Packaged extraResources copies `build/icon.png` next to the Node runtime;
 * unpackaged `desktop:dev` reads the same PNG from the checkout.
 */
function resolveAppIcon(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'icon.png')
    : join(PACKAGE_ROOT, 'build', 'icon.png')
}

let host: DesktopHost | undefined

/**
 * Create the product window after the host is ready.
 * @param url - loopback origin from `dsh web`.
 * @returns nothing; Electron retains the window.
 */
function createWindow(url: string): void {
  const created = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 900,
    minHeight: 600,
    title: 'DeepSeek Harness',
    icon: resolveAppIcon(),
    show: false,
    autoHideMenuBar: !wantsNativeMenuBar(process.platform),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  })
  if (!wantsNativeMenuBar(process.platform)) {
    created.setMenuBarVisibility(false)
    created.setMenu(null)
  }
  created.once('ready-to-show', () => { created.show() })
  created.webContents.setWindowOpenHandler(({ url: target }) => {
    if (target.startsWith('http://127.0.0.1:') || target.startsWith(url)) return { action: 'allow' }
    void shell.openExternal(target)
    return { action: 'deny' }
  })
  void created.loadURL(url)
}

/**
 * Boot the host and window. Failures show a dialog and quit.
 */
async function boot(): Promise<void> {
  const nodeExecPath = process.env.npm_node_execpath ?? process.env.NODE
  if (!app.isPackaged && (nodeExecPath === undefined || nodeExecPath === '')) {
    throw new Error('dsh-desktop: unpackaged launch needs npm_node_execpath or NODE pointing at Node ≥22')
  }
  const runtime = resolveDesktopRuntime({
    packaged: app.isPackaged,
    resourcesPath: process.resourcesPath,
    repoRoot: REPO_ROOT,
    nodeExecPath: nodeExecPath ?? '',
    platform: process.platform,
    homedir: homedir(),
  })
  host = await startDesktopHost({
    runtime,
    env: process.env,
    spawn,
  })
  createWindow(host.url)
}

function installMenu(): void {
  if (wantsNativeMenuBar(process.platform)) {
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      { role: 'appMenu' },
      { role: 'editMenu' },
      { role: 'viewMenu' },
      { role: 'windowMenu' },
    ]))
    return
  }
  Menu.setApplicationMenu(null)
}

void app.whenReady().then(async () => {
  if (process.platform === 'darwin' && app.dock !== undefined) app.dock.setIcon(resolveAppIcon())
  installMenu()
  try {
    await boot()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    dialog.showErrorBox('DeepSeek Harness failed to start', message)
    app.exit(1)
  }
})

app.on('window-all-closed', () => { app.quit() })

app.on('before-quit', (event) => {
  if (host === undefined) return
  event.preventDefault()
  const stopping = host
  host = undefined
  void stopping.stop().finally(() => { app.exit(0) })
})
