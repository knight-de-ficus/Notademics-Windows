---
title: 简介
description: 了解 Notademics 的产品定位、技术架构和核心能力。
permalink: /overview/
---

<article class="document">
  <header class="document-header">
    <p class="eyebrow">概述</p>
    <h1>Notademics 简介</h1>
    <p>了解编辑器的设计目标、技术组成以及 Windows 集成方式。</p>
  </header>
  <div class="document-content" markdown="1">

## 产品定位

Notademics 是一款面向 Windows 的开源 Markdown 编辑器，提供 Muya 所见即所得编辑体验，同时保留源码模式。它直接处理本地文件，不要求把文稿导入专用数据库，适合日常写作、项目文档和知识整理。

应用提供 MSI 安装包与免安装 ZIP，并支持文件关联、文件夹工作区、多标签页、自动保存、编码检测和系统回收站等 Windows 工作流。

## 技术架构

Notademics 使用 Tauri 2 将 Web 前端与 Rust 原生后端组合为桌面应用：

<div class="architecture-stack">
  <div><strong>界面与状态</strong><span>React 19 · TypeScript · Zustand · React Router</span></div>
  <div><strong>编辑器内核</strong><span>本地 Muya WYSIWYG Markdown 引擎</span></div>
  <div><strong>桌面桥接</strong><span>Tauri 2 命令、事件与 capability 权限</span></div>
  <div><strong>原生能力</strong><span>Rust 文件系统、搜索、编码、设置、窗口与目录监听</span></div>
</div>

前端负责编辑界面、项目导航、命令面板和偏好设置。Rust 后端负责需要系统权限的操作，包括读写文件、检测文本编码、监听目录变化、持久化设置、控制窗口和处理图片上传。

## 编辑能力

- 所见即所得和 Markdown 源码两种编辑模式；
- 标题、列表、表格、代码块、数学公式、脚注与 Front Matter；
- Mermaid、Flowchart、Sequence、PlantUML 和 Vega 图表；
- 文件树、文档目录、文件夹搜索、标签页和命令面板；
- 明暗主题、自定义 CSS、字体、行宽、图片与快捷键设置。

## 本地文件工作流

Notademics 可以打开单个 Markdown 文件，也可以打开文件夹作为工作区。文件内容仍保存在用户选择的位置；应用设置和恢复数据保存在当前 Windows 用户的应用数据目录。

目录监视器会识别外部文件变化。删除文件时，应用使用 Windows 回收站，而不是默认执行不可恢复的永久删除。

## 构建与分发

桌面应用通过 Tauri 和 WiX 构建 64 位 MSI，同时将可执行文件与运行时资源组装为免安装 ZIP。正式 Release 为 MSI 和便携 ZIP 提供 MD5 文件，并附带只包含发布标签下 `app/` 目录内容的源码 ZIP。

项目源码依据 [GNU GPL v3.0]({{ '/license/' | relative_url }}) 发布。更详细的模块、开发环境和发布流程见[开发文档]({{ '/development/' | relative_url }})。

  </div>
</article>
