# Agent Note: Electron desktop installer shell

Status: implemented

English | [中文](2026-08-17-electron-desktop-shell.zh.md)

## Problem

`dsh web` requires Node 22+, pnpm, a repository build, and a browser pointed at a loopback URL. That is the contributor path. End users who only need to paste an API key and work in a workspace cannot be asked to install that toolchain. Windows and macOS need ordinary installers (NSIS `.exe`, `.dmg`) whose payload already contains the runtime.

The [GUI layering note](../architecture/2026-07-19-gui-layering-and-rpc-protocol.md) reserved an Electron client on an IPC `file://` fetch carrier. That carrier is not required to ship an installer: the Host already serves the product UI on `127.0.0.1`, and the Models page already stores the DeepSeek key in `$DSH_HOME/.credentials.yaml`.

## Decision

`apps/desktop` (`@deepseek-ai/dsh-desktop`) is an Electron window plus a child Node process. Electron never loads harness plugins into its own ABI. On launch it spawns the bundled official Node 22 binary with `@deepseek-ai/dsh`'s `lib/bin.js web --port 0`, waits for the `dsh web: http://127.0.0.1:<port>` readiness line, and loads that origin in a sandboxed BrowserWindow (`nodeIntegration` off, `contextIsolation` on). `--port 0` avoids colliding with a developer `dsh web` already bound to 3080. Windows and Linux hide Electron's in-window File/Edit menu (`Menu.setApplicationMenu(null)`); macOS keeps the system application menu.

Packaging is `pnpm deploy` of `@deepseek-ai/dsh` (the same production closure the CLI boots, including `@deepseek-ai/dsh-web-frontend` dist) plus the official Node tarball/zip for the target, copied into `apps/desktop/runtime/` as electron-builder `extraResources`. Native addons (`node-pty`, koffi) therefore load against Node, not Electron. Credentials stay in the default `~/.dsh` home unless `DSH_HOME` is set, so a key entered in the desktop UI is the same store `dsh web` reads. The dock, window, and installer icon is the official DeepSeek whale from `website/public/favicon.svg` on a full-bleed `#4D6BFE` square (`apps/desktop/build/icon.{svg,png,icns,ico}`).

Unpackaged `pnpm desktop:dev` uses `npm_node_execpath` and the checkout's `apps/cli/lib/bin.js`. A packaged launch that cannot print a readiness line shows an error dialog and exits. `.github/workflows/desktop-release.yml` packs the macOS `.dmg` and Windows `.exe` on `v*` tags and attaches them to a GitHub Release.

The IPC `file://` carrier named in the GUI layering note remains deferred: this shell reuses the HTTP loopback Host unchanged.

## Alternatives considered

- **Run the harness inside Electron's Node (`ELECTRON_RUN_AS_NODE` or `utilityProcess`)** — native addons must be rebuilt for Electron's ABI on every target, including node-pty's spawn helper. A bundled official Node binary keeps the CLI's already-validated addon set.
- **Ship the IPC `file://` carrier in the same change** — the Host webserver comment records that path, but it requires a new fetch/WebSocket bridge in `dsh-client-connection` and does not change the user-visible installer outcome. HTTP loopback reuses the shipped UI, onboarding, and `/api` trust fence.
- **pkg `--sea` single-exe as the host, Electron as only a window** — matches the Python SDK runtime, but pkg's Windows target is a documented non-goal there, and this product must emit an NSIS installer. extraResources + official Node covers Windows and macOS with one staging script.
- **Ask the user to install Node and run `npx @deepseek-ai/dsh web`** — that is already the contributor README path and fails the "no toolchain" requirement.

## Consequences

Installer size includes a Node binary and the full web-profile closure; it is large relative to the Electron shell JS. Windows NSIS and macOS dmg must be packed on a machine that can fetch the matching Node dist (macOS can stage `win32-x64` Node and pass `--win` to electron-builder). The window is same-origin with `/api` on loopback, so the existing browser-trust fence applies; remote origins opened from the UI are sent to the OS browser. No session-log snapshot is added: the desktop shell does not change model-visible text or the web composition. Verification is the desktop unit suite (`parseReadyUrl`, runtime paths, Electron env stripping, readiness spawn) plus a manual `pnpm desktop:dev` launch against a built checkout.
