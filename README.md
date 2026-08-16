<div align="center">
<img src="app/src-tauri/icons/icon-round.webp" width="96" />

<h1> Notademics for Windows </h1>

<p>The Art of Minimal Markdown</p>

</div>

Notademics 是一个极简的所见即所得（WYSIWYG）Markdown 编辑器，面向 Windows 平台。

- **技术栈**：Tauri 2 + Rust + React 19 + Vite
- **编辑器引擎**：Muya（`@muyajs/core`）—— 基于块结构的 WYSIWYG Markdown 渲染内核
- **核心能力**：实时编辑（WYSIWYG）、源码模式、分栏预览、多标签页、文件夹文件树、查找/替换、明暗主题、自动保存、文件监视

## 目录结构

```
Notademics-Windows/
  app/                 应用源代码（Tauri + React）
    src/               React 前端
    src-tauri/         Rust 后端（文件系统、偏好、菜单、监视）
      icons/           Notademics 品牌图标
  LICENSE              MIT
```

## 开发

```bash
# 安装依赖（app 目录下）
cd app
npm install

# 开发模式（Vite dev server + Tauri 窗口）
npm run dev:app

# 前端类型检查 + 构建
npm run build

# Rust 侧检查
npm run check:rs

# 打包 Windows 安装程序（NSIS）
npm run tauri build
```

> 说明：本仓库使用 `npm` 管理依赖（`package-lock.json`）。

## 功能

- **多标签页**：新建 / 打开 / 保存 / 另存为，未保存关闭确认
- **实时编辑**：Muya WYSIWYG 引擎，支持标题、引用、列表、任务列表、代码块、数学公式、Mermaid / PlantUML 等块级元素
- **四种视图**：实时编辑（liveEdit）、源码（code）、分栏（split）、预览（preview）
- **文件树**：打开文件夹后按目录浏览，点击打开 Markdown / 纯文本文件
- **查找/替换**：编辑器内查找（F3 下一个）
- **主题**：明暗切换（Ctrl+Shift+T）
- **自动保存**：可在偏好中开启

## 快捷键

| 操作 | 快捷键 |
|---|---|
| 新建文件 | Ctrl+N |
| 打开文件 | Ctrl+O |
| 打开文件夹 | Ctrl+Shift+O |
| 保存 / 另存为 | Ctrl+S / Ctrl+Shift+S |
| 关闭标签 | Ctrl+W |
| 撤销 / 重做 | Ctrl+Z / Ctrl+Y |
| 查找 | Ctrl+F |
| 切换视图模式 | Ctrl+1 |
| 切换文件树 | Ctrl+\ |
| 切换主题 | Ctrl+Shift+T |
| 切换标签 | Ctrl+Tab |

## 许可

[MIT](./LICENSE)
