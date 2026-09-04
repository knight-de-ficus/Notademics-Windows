---
title: 使用方法
description: 安装、便携运行、文件管理、编辑功能、偏好设置与下载校验指南。
permalink: /guide/
---

<article class="document">
  <header class="document-header">
    <p class="eyebrow">User guide</p>
    <h1>使用方法</h1>
    <p>从第一次启动到日常写作，了解 Notademics 的主要工作方式。</p>
  </header>
  <div class="document-content" markdown="1">

## 下载与安装

在 [GitHub Releases]({{ site.release_url }}) 下载适用于 64 位 Windows 的文件：

| 文件 | 用途 |
|---|---|
| `Notademics_<版本>_x64.msi` | 标准 MSI 安装包，适合日常使用与系统化部署 |
| `Notademics_<版本>_x64-portable.zip` | 免安装包，解压后直接运行 |
| 同名 `.md5` 文件 | 校验 MSI 或便携 ZIP 是否完整 |

MSI 方式：双击安装包，按 Windows Installer 提示完成安装。当前构建未配置代码签名，因此 Windows 可能显示来源提示；请确认下载地址来自本项目的 GitHub Releases。

便携方式：完整解压 ZIP，保持 `Notademics.exe` 与 `resources/` 目录在一起，再运行 `Notademics.exe`。便携包不会把设置放进解压目录；偏好设置和恢复数据仍保存在当前 Windows 用户的应用数据目录。

> Notademics 使用 Microsoft Edge WebView2。受支持的 Windows 10/11 通常已包含 WebView2；若系统缺少它，MSI 会按 Tauri 的默认策略获取运行时。

### 验证 MD5

在 PowerShell 中进入下载目录后执行：

```powershell
(Get-FileHash .\Notademics_0.2.0_x64.msi -Algorithm MD5).Hash.ToLower()
Get-Content .\Notademics_0.2.0_x64.msi.md5
```

两处的 32 位十六进制值应完全一致。MD5 在这里用于发现下载损坏，不等同于数字签名或安全身份认证。

## 打开与管理文件

- 通过“文件 → 打开文件”打开单个 Markdown 或纯文本文件。
- 通过“文件 → 打开文件夹”载入侧边栏文件树，并进行文件夹内搜索。
- 支持 `.md`、`.markdown`、`.mdown`、`.mkd` 与 `.txt` 文件关联。
- 可同时打开多个标签页；外部程序修改文件时，目录监视器会通知编辑器。
- 删除操作会移动到 Windows 回收站，而非直接永久删除。

## 写作与排版

默认界面使用 Muya 所见即所得引擎。可通过菜单插入或调整：

- 六级标题、段落、引用、分隔线；
- 有序列表、无序列表、任务列表；
- 表格、代码块、HTML 块与 Front Matter；
- 粗体、斜体、删除线、下划线、高亮、上下标；
- 链接、图片、行内代码、行内及块级数学公式；
- 脚注、Mermaid、Flowchart、Sequence、PlantUML 与 Vega 图表。

使用“视图 → 源代码模式”可直接编辑 Markdown 源文本。状态栏会显示保存状态、编码、行尾与字数统计；点击字数区域可在单词、字符、段落和汇总之间切换。

## 图片

“偏好设置 → 图片”可选择三种插入策略：复制到指定目录、保留绝对路径、或交给 PicGo / 自定义命令行脚本上传。使用相对目录时，可选择以当前文件或已打开文件夹为基准。

## 个性化设置

偏好设置包含以下页面：

- **通用**：界面语言、缩放、启动恢复、侧边栏、自动保存；
- **编辑器**：字体、字号、行高、行宽、代码块、自动配对、编码和行尾；
- **Markdown**：列表标记、缩进、Front Matter、脚注和 Markdown 兼容选项；
- **主题**：多套明暗主题、跟随系统、编辑器背景图与自定义 CSS；
- **图片**：复制目录、路径方式、PicGo 与脚本上传；
- **快捷键**：浏览当前命令及按键组合。

界面提供简体中文、繁体中文、英语、德语、西班牙语、法语、日语、韩语、葡萄牙语和土耳其语。

## 常用操作

按 `Ctrl+Shift+P` 打开命令面板，可以搜索当前可用命令。常见按键以应用内菜单和“偏好设置 → 快捷键”显示为准，避免与用户自定义设置冲突。

遇到问题时，请在 [GitHub Issues]({{ site.repository_url }}/issues) 描述 Windows 版本、Notademics 版本、复现步骤与相关文件类型；提交前请移除文稿中的隐私内容。

  </div>
</article>

