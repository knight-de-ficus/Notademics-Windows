---
title: 开发文档
description: Notademics 的架构、环境准备、本地开发、测试、构建与发布流程。
permalink: /development/
---

<article class="document">
  <header class="document-header">
    <p class="eyebrow">Development</p>
    <h1>开发文档</h1>
    <p>项目采用 Tauri 2、Rust、React 19、TypeScript 与本地 Muya 包构建。</p>
  </header>
  <div class="document-content" markdown="1">

## 技术结构

```text
app/
├── src/                  React 前端、状态、页面与组件
├── packages/muya/        本地 WYSIWYG Markdown 引擎
├── src-tauri/            Rust 后端与 Tauri 配置
│   ├── src/              文件、窗口、菜单、搜索、设置等命令
│   ├── capabilities/     Tauri 权限声明
│   └── resources/        运行时语言资源
├── public/               应用图标等静态资源
└── scripts/              Windows Release 组装脚本
```

前端通过 Zustand 管理编辑器、项目、布局、偏好设置、命令中心与通知状态；React Router 管理编辑器和偏好设置页面。Rust 后端负责原生文件系统、编码识别、设置持久化、目录监听、搜索、窗口控制与图片上传命令。

## 环境准备

Windows 开发环境需要：

- Node.js 20.19 或更高版本（CI 使用 Node.js 22）；
- Rust stable 工具链；
- Microsoft C++ Build Tools，包含“使用 C++ 的桌面开发”；
- Microsoft Edge WebView2；
- 构建 MSI 时需要 Windows 的 VBScript 可选功能与 WiX v3 工具链支持。Tauri 会处理其打包流程。

## 本地运行

```powershell
cd app
npm ci
npm run dev:app
```

只检查前端生产构建：

```powershell
npm run build
```

只检查 Rust 后端：

```powershell
npm run check:rs
```

Muya 引擎包含独立测试：

```powershell
cd packages/muya
npm run test
```

## 应用路由与事件

应用路由入口位于 `src/router/index.tsx`：

| 路由 | 作用 |
|---|---|
| `/editor` | 主编辑器 |
| `/preference/*` | 通用、编辑器、Markdown、主题、图片、快捷键设置 |

主要的后端到前端事件包括：

| 事件 | 作用 |
|---|---|
| `menu://action` | 传递原生菜单命令 |
| `open-file` | 接收命令行或第二实例传入的文件 |
| `tauri://drag-drop` | 处理拖放文件 |
| `fs://change` | 通知目录中文件增删改 |

Rust 命令集中在 `src-tauri/src/commands.rs` 及相邻模块。新增命令时，需要同时完成命令实现、`lib.rs` 注册、capability 权限检查以及前端调用类型。

## Windows 构建

生成 MSI：

```powershell
cd app
npm ci
npm run tauri -- build --bundles msi
```

安装包位于 `app/src-tauri/target/release/bundle/msi/`。未打包的 `Notademics.exe` 位于 `app/src-tauri/target/release/`，Release 脚本会用它和运行时资源组装免安装 ZIP。

`src-tauri/target/` 是可再生成的 Cargo 构建缓存，可能占用较大空间。关闭正在运行的 Notademics 后，可执行 `npm run clean:rs` 清理。

## 发布流程

发布前让以下三个版本号完全一致：

- `app/package.json`
- `app/src-tauri/tauri.conf.json`
- `app/src-tauri/Cargo.toml`

然后创建并推送对应的 `v` 前缀标签：

```powershell
git tag v0.2.0
git push origin v0.2.0
```

`.github/workflows/release.yml` 会在 `windows-latest` 上重新安装锁定依赖、检查版本，按官方 SHA-256 校验 WiX 3.14.1 后构建 MSI，并产出：

```text
Notademics_<版本>_x64.msi
Notademics_<版本>_x64.msi.md5
Notademics_<版本>_x64-portable.zip
Notademics_<版本>_x64-portable.zip.md5
Notademics_<版本>_source.zip
```

源码包通过 `git archive HEAD:app` 生成，因此只包含发布标签中已提交的 `app/` 内容，并排除仓库其他目录、依赖目录和构建缓存。工作流会在上传前重新计算两份 MD5，并检查源码 ZIP 不含 `app/` 之外的路径。

## 文档网站

文档位于仓库根目录的 `docs/`。每个页面通过 Jekyll Front Matter 的 `permalink` 声明稳定路由，内部链接使用 `relative_url` 过滤器兼容项目站点的子路径。

本地预览：

```powershell
cd docs
bundle install
bundle exec jekyll serve --baseurl ""
```

推送到 `master` 后，`.github/workflows/pages.yml` 会构建 `docs/` 并部署。首次启用时，需要由仓库管理员在 **Settings → Pages → Build and deployment → Source** 中选择 **GitHub Actions**；工作流自带的 `GITHUB_TOKEN` 无法代替这项首次启用操作。

GitHub Pages 项目站点的默认路径由仓库名决定，无法通过 Jekyll 路由或 Pages 工作流改写。例如，仓库名为 `Notademics-Windows` 时，站点路径就是 `/Notademics-Windows`。如需使用 `/Notademics`，必须先将 GitHub 仓库重命名为 `Notademics`，再同步更新 `_config.yml` 中的 `baseurl`、`repository`、`repository_url` 和 `release_url`，以及本地 Git 远端地址。GitHub 不保证旧的项目站点 URL 在仓库重命名后自动跳转。

## 提交建议

提交前至少运行前端构建与 Rust 检查；涉及 Muya 行为时运行相关测试。不要提交 `node_modules/`、`dist/`、`src-tauri/target/`、`release-artifacts/` 或本地密钥。错误报告和合并请求请通过 [GitHub 仓库]({{ site.repository_url }}) 提交。

  </div>
</article>
