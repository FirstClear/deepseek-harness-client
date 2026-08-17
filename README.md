# DeepSeek Harness

English | [中文](README.zh.md)

Desktop client for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness), the open-source agent harness from [DeepSeek AI](https://deepseek.com).

Install a `.dmg` or `.exe`, open the app, and paste an API key in **Settings → Models**. You do not need Node, pnpm, or a repository checkout.

## Download

Get the latest installers from [Releases](https://github.com/FirstClear/deepseek-harness-client/releases/latest):

- macOS Apple Silicon: `DeepSeek.Harness-<version>-arm64.dmg`
- Windows: `DeepSeek.Harness.Setup.<version>.exe`

Intel Mac and Linux installers are not published yet.

## Install

### macOS

1. Open the `.dmg` and drag **DeepSeek Harness** into **Applications**.
2. This build is unsigned, so Gatekeeper may say the app is damaged. After copying it, run:

```sh
xattr -cr "/Applications/DeepSeek Harness.app"
open "/Applications/DeepSeek Harness.app"
```

Open it from Applications, not from the `.dmg`.

### Windows

Run the `.exe` and follow the installer. You can choose the install directory.

## First launch

The window is the same Web UI as `dsh web`. Add a DeepSeek API key under **Settings → Models**. Credentials stay in `~/.dsh` (or `%USERPROFILE%\.dsh` on Windows) unless `DSH_HOME` is set.

## Run

### Run from source

```sh
git clone https://github.com/FirstClear/deepseek-harness-client.git
cd deepseek-harness-client
pnpm install
pnpm run build
pnpm desktop:dev
```

Pack installers with `pnpm desktop:pack:mac` or `pnpm desktop:pack:win`. Details are in [`apps/desktop/README.md`](apps/desktop/README.md).

The CLI and Web UI from a checkout still work as in upstream: `pnpm dsh web`.

## How it works

Electron is only a window. A bundled official Node 22 process runs `dsh web --port 0`, and the window loads that loopback origin. Native addons load in the child Node process, not in Electron.

## License

[MIT](LICENSE), same as upstream DeepSeek Harness.

This repository is an independent snapshot that adds the desktop shell. The official project remains [deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness).

Third-party dependencies and their licenses are disclosed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
