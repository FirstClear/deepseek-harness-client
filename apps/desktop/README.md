# `@deepseek-ai/dsh-desktop`

English | [中文](README.zh.md)

Electron installer shell for DeepSeek Harness. The window loads the existing Web UI; a bundled Node process runs `dsh web`. Users install a `.dmg` or `.exe`, open the app, and paste an API key in **Settings → Models**. They do not install Node, pnpm, or repository dependencies.

## Run from a checkout

The repository must already be built (`pnpm run build` at the root). Then:

```sh
pnpm desktop:dev
```

The shell spawns this checkout's `apps/cli/lib/bin.js web --port 0` with the Node that launched pnpm, then opens a window on the printed loopback URL. Credentials use `~/.dsh` unless `DSH_HOME` is set.

## Pack installers

```sh
pnpm desktop:pack:mac    # DeepSeek Harness.app + .dmg (this machine's arch)
pnpm desktop:pack:win    # NSIS .exe (stages win32-x64 Node, then electron-builder --win)
```

`pnpm desktop:pack` packs the current platform. Artifacts land in `apps/desktop/release/`. Staging downloads official Node 22.23.1 and `pnpm deploy`s `@deepseek-ai/dsh` into `apps/desktop/runtime/` (gitignored). Dock, window, and installer icons use the official DeepSeek whale mark from `website/public/favicon.svg` (brand `#4D6BFE`), rasterized in `apps/desktop/build/`.

The host binds `127.0.0.1` on an OS-assigned port. Native addons load in the child Node process, not in Electron. Windows and Linux hide Electron's in-window File/Edit menu; macOS keeps the system application menu.

## Known Limitations and Deferred Work

- **The IPC `file://` carrier is not this shell.** Electron talks to the Host over loopback HTTP. See the [electron desktop shell Agent Note](../../.agents/notes/implemented/feature/2026-08-17-electron-desktop-shell.md).
- **Installer builds need network** to fetch the Node distribution for the target.
- **Cross-packing Windows from macOS** still requires electron-builder's Windows target support on that host; the staged `node.exe` is not enough if Electron's win32 binaries cannot be downloaded.
