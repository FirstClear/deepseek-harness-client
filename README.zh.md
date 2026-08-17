# DeepSeek Harness

[English](README.md) | 中文

[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的桌面客户端。DeepSeek Harness 是 [DeepSeek AI](https://deepseek.com) 的开源 agent harness（智能体框架）。

安装 `.dmg` 或 `.exe`，打开应用，在 **Settings → Models** 粘贴 API key。不必安装 Node、pnpm，也不必检出仓库。

## 下载

从 [Releases](https://github.com/FirstClear/deepseek-harness-client/releases/latest) 获取最新安装包：

- macOS Apple Silicon：`DeepSeek.Harness-<version>-arm64.dmg`
- Windows：`DeepSeek.Harness.Setup.<version>.exe`

尚未发布 Intel Mac 与 Linux 安装包。

## 安装

### macOS

1. 打开 `.dmg`，把 **DeepSeek Harness** 拖进「应用程序」。
2. 当前构建未签名，Gatekeeper 可能提示应用已损坏。复制之后执行：

```sh
xattr -cr "/Applications/DeepSeek Harness.app"
open "/Applications/DeepSeek Harness.app"
```

从「应用程序」打开，不要从 `.dmg` 里直接打开。

### Windows

运行 `.exe`，按安装向导操作。可以自选安装目录。

## 首次启动

窗口就是 `dsh web` 的同一套 Web UI。在 **Settings → Models** 添加 DeepSeek API key。凭据保存在 `~/.dsh`（Windows 上为 `%USERPROFILE%\.dsh`），除非设置了 `DSH_HOME`。

## 运行

### 从源码运行

```sh
git clone https://github.com/FirstClear/deepseek-harness-client.git
cd deepseek-harness-client
pnpm install
pnpm run build
pnpm desktop:dev
```

用 `pnpm desktop:pack:mac` 或 `pnpm desktop:pack:win` 打包安装程序。细节见 [`apps/desktop/README.md`](apps/desktop/README.md)。

检出中的 CLI 与 Web UI 仍可按上游方式使用：`pnpm dsh web`。

## 工作原理

Electron 只是窗口。捆绑的官方 Node 22 进程运行 `dsh web --port 0`，窗口加载该环回地址。原生 addon 在子 Node 进程中加载，不在 Electron 中加载。

## 许可证

[MIT](LICENSE)，与上游 DeepSeek Harness 相同。

本仓库是加入了桌面外壳的独立快照。官方项目仍是 [deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness)。

第三方依赖及其许可证见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
