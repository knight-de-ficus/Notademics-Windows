---
title: 简介
description: Notademics 是面向 Windows 的轻量、开源、所见即所得 Markdown 编辑器。
permalink: /
page_class: home-page
---

<article class="article">
  <header class="article-header">
    <p class="content-label">产品概述</p>
    <h1>Notademics</h1>
    <p class="lead">一款面向 Windows 的轻量、开源、所见即所得 Markdown 编辑器。</p>
    <div class="metadata">
      <span>适用于 Windows 10 和 Windows 11</span>
      <span>GNU GPL v3.0</span>
    </div>
  </header>

  <div class="article-body">
    <div class="hero-actions">
      <a class="button" href="{{ site.release_url }}">下载最新版本</a>
      <a class="button secondary" href="{{ '/guide/' | relative_url }}">阅读使用指南</a>
    </div>

    <div class="callout note">
      <strong>选择安装方式</strong>
      <p>正式 Release 同时提供 MSI 安装包和免安装 ZIP，并附带对应的 MD5 校验文件。</p>
    </div>

    <h2>主要功能</h2>
    <p>Notademics 将常用 Markdown 工作流集中在一个原生 Windows 窗口中，同时保留直接编辑源码的能力。</p>

    <div class="feature-grid">
      <section class="feature-card">
        <h3>所见即所得与源码模式</h3>
        <p>实时呈现标题、列表、表格、代码块、数学公式、脚注与图表，并可随时切换到 Markdown 源码。</p>
      </section>
      <section class="feature-card">
        <h3>文件与项目管理</h3>
        <p>打开单个文件或整个文件夹，通过标签页、文件树、目录和搜索在文稿之间导航。</p>
      </section>
      <section class="feature-card">
        <h3>Windows 原生体验</h3>
        <p>基于 Tauri 2 与 Rust，支持文件关联、单实例唤醒、窗口恢复和系统回收站。</p>
      </section>
      <section class="feature-card">
        <h3>可调整的写作环境</h3>
        <p>提供明暗主题、自定义 CSS、编辑字体、行宽、图片处理和可配置快捷键。</p>
      </section>
    </div>

    <h2>界面预览</h2>
    <figure class="product-shot">
      <img src="{{ site.repository_url }}/raw/master/image/screenshot.png" alt="Notademics Markdown 编辑器界面截图">
      <figcaption>编辑器主界面：文件树、所见即所得编辑区域与文档目录。</figcaption>
    </figure>

    <h2>开始使用</h2>
    <ol class="steps">
      <li><strong>下载应用。</strong> 从 GitHub Releases 获取 MSI 或免安装 ZIP。</li>
      <li><strong>打开内容。</strong> 选择一个 Markdown 文件，或打开文件夹以使用项目文件树。</li>
      <li><strong>开始写作。</strong> 使用所见即所得模式编辑，必要时切换到源码模式。</li>
    </ol>
    <p><a href="{{ '/guide/' | relative_url }}">查看完整使用方法 →</a></p>
  </div>
</article>
