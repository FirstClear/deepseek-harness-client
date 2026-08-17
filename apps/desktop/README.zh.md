# `@deepseek-ai/dsh-desktop`

[English](README.md) | 中文

DeepSeek Harness 的 Electron 安装包外壳。窗口加载现有 Web UI；捆绑的 Node 进程运行 `dsh web`。用户安装 `.dmg` 或 `.exe`，打开应用，在 **Settings → Models** 粘贴 API key。他们不必安装 Node、pnpm 或仓库依赖。

## 从检出运行

仓库必须已经构建（在根目录执行 `pnpm run build`）。然后：

```sh
pnpm desktop:dev
```

此外壳用启动 pnpm 的那份 Node 拉起本检出的 `apps/cli/lib/bin.js web --port 0`，再按打印出的环回 URL 打开窗口。凭据使用 `~/.dsh`，除非设置了 `DSH_HOME`。

## 打包安装程序

```sh
pnpm desktop:pack:mac    # DeepSeek Harness.app + .dmg (this machine's arch)
pnpm desktop:pack:win    # NSIS .exe (stages win32-x64 Node, then electron-builder --win)
```

`pnpm desktop:pack` 打包当前平台。产物位于 `apps/desktop/release/`。暂存会下载官方 Node 22.23.1，并把 `@deepseek-ai/dsh` `pnpm deploy` 进 `apps/desktop/runtime/`（已 gitignore）。程序坞、窗口与安装包图标使用 `website/public/favicon.svg` 中的官方 DeepSeek 鲸鱼标（品牌色 `#4D6BFE`），栅格化后放在 `apps/desktop/build/`。

Host 绑定 `127.0.0.1` 上由操作系统分配的端口。原生 addon 在子 Node 进程中加载，不在 Electron 中加载。Windows 与 Linux 隐藏 Electron 窗口内的 File/Edit 菜单；macOS 保留系统应用菜单。

## Known Limitations and Deferred Work

- **IPC `file://` 载体不是此外壳。** Electron 通过环回 HTTP 与 Host 通信。见 [Electron 桌面外壳 Agent Note](../../.agents/notes/implemented/feature/2026-08-17-electron-desktop-shell.md)。
- **制作安装包需要网络**，以便拉取目标平台的 Node 发行包。
- **从 macOS 交叉打包 Windows** 仍要求该主机支持 electron-builder 的 Windows 目标；若无法下载 Electron 的 win32 二进制，仅暂存 `node.exe` 不够。
