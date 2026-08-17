# Agent Note: Electron desktop installer shell

Status: implemented

[English](2026-08-17-electron-desktop-shell.md) | 中文

## Problem

`dsh web` 需要 Node 22+、pnpm、仓库构建，以及浏览器指向环回 URL。那是贡献者路径。只想粘贴 API key 并在工作区里工作的最终用户，不能被要求安装那套工具链。Windows 与 macOS 需要普通安装包（NSIS `.exe`、`.dmg`），其载荷已经包含运行时。

[GUI 分层说明](../architecture/2026-07-19-gui-layering-and-rpc-protocol.md) 预留了走 IPC `file://` fetch 载体的 Electron 客户端。发出安装包并不需要该载体：Host 已经在 `127.0.0.1` 上提供产品 UI，Models 页也已经把 DeepSeek 密钥存进 `$DSH_HOME/.credentials.yaml`。

## Decision

`apps/desktop`（`@deepseek-ai/dsh-desktop`）是一个 Electron 窗口外加一个子 Node 进程。Electron 从不把 harness 插件加载进自己的 ABI。启动时它用捆绑的官方 Node 22 二进制运行 `@deepseek-ai/dsh` 的 `lib/bin.js web --port 0`，等待 `dsh web: http://127.0.0.1:<port>` 就绪行，再在沙箱 BrowserWindow 中加载该源（关闭 `nodeIntegration`，打开 `contextIsolation`）。`--port 0` 避免与已经绑定 3080 的开发者 `dsh web` 冲突。Windows 与 Linux 隐藏 Electron 窗口内的 File/Edit 菜单（`Menu.setApplicationMenu(null)`）；macOS 保留系统应用菜单。

打包方式是对 `@deepseek-ai/dsh` 做 `pnpm deploy`（CLI 启动的同一套生产闭包，含 `@deepseek-ai/dsh-web-frontend` dist），再加上目标平台的官方 Node tar/zip，复制进 `apps/desktop/runtime/`，作为 electron-builder 的 `extraResources`。因此原生 addon（`node-pty`、koffi）对着 Node 加载，而不是 Electron。凭据仍在默认 `~/.dsh` 主目录（除非设置了 `DSH_HOME`），所以在桌面 UI 里输入的密钥与 `dsh web` 读到的是同一份存储。程序坞、窗口与安装包图标是 `website/public/favicon.svg` 中的官方 DeepSeek 鲸鱼标，放在带透明圆角的 `#4D6BFE` squircle 上（`apps/desktop/build/icon.{svg,png,icns,ico}`）。

未打包的 `pnpm desktop:dev` 使用 `npm_node_execpath` 与检出中的 `apps/cli/lib/bin.js`。已打包启动若打不出就绪行，会显示错误对话框并退出。`.github/workflows/desktop-release.yml` 在 `v*` 标签上打包 macOS `.dmg` 与 Windows `.exe`，并挂到 GitHub Release 上。

GUI 分层说明里点名的 IPC `file://` 载体仍推迟：此外壳原样复用 HTTP 环回 Host。

## Alternatives considered

- **在 Electron 的 Node 内运行 harness（`ELECTRON_RUN_AS_NODE` 或 `utilityProcess`）** — 原生 addon 必须按 Electron ABI 在每个目标上重建，包括 node-pty 的 spawn helper。捆绑官方 Node 二进制可以沿用 CLI 已经验证过的 addon 集合。
- **同一变更里交付 IPC `file://` 载体** — Host webserver 注释记录了该路径，但它需要在 `dsh-client-connection` 里新增 fetch/WebSocket 桥，且不改变用户可见的安装包结果。HTTP 环回复用已交付的 UI、onboarding 和 `/api` 信任围栏。
- **用 pkg `--sea` 单文件 exe 当 host，Electron 只做窗口** — 与 Python SDK 运行时一致，但那里的 pkg Windows 目标是文档化的非目标，而本产品必须发出 NSIS 安装包。extraResources + 官方 Node 用一份暂存脚本覆盖 Windows 与 macOS。
- **要求用户安装 Node 并运行 `npx @deepseek-ai/dsh web`** — 那已是贡献者 README 路径，不满足「无需工具链」要求。

## Consequences

安装包体积包含一份 Node 二进制和完整 web-profile 闭包；相对 Electron 外壳 JS 会偏大。Windows NSIS 与 macOS dmg 必须在能拉取对应 Node 发行包的机器上打包（macOS 可以暂存 `win32-x64` Node 再把 `--win` 传给 electron-builder）。窗口与环回上的 `/api` 同源，因此沿用现有浏览器信任围栏；从 UI 打开的远程源交给系统浏览器。不新增 session-log 快照：桌面外壳不改变模型可见文本或 web 组合。验证是桌面单元套件（`parseReadyUrl`、运行时路径、剥离 Electron 环境变量、就绪 spawn）加上对着已构建检出手动运行 `pnpm desktop:dev`。
