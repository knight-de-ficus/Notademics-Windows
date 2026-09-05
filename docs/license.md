---
title: 授权声明
description: Notademics 的 GNU GPL v3.0 授权范围、使用权利与分发义务说明。
permalink: /license/
---

<article class="document">
  <header class="document-header">
    <p class="eyebrow">License</p>
    <h1>授权声明</h1>
    <p>Notademics 以 GNU General Public License version 3 授权。</p>
  </header>
  <div class="document-content" markdown="1">

## 项目许可证

Notademics 的项目源码以 **GNU General Public License v3.0（GPL-3.0-only）** 发布。完整且具有法律效力的条款见仓库根目录的 [LICENSE]({{ site.repository_url }}/blob/master/LICENSE)。本页面是便于理解的摘要，不替代许可证原文，也不构成法律意见。

## 你可以做什么

在遵守 GPL v3.0 的前提下，你可以：

- 出于任何目的运行本软件；
- 阅读、研究和修改源码；
- 复制和再分发原版；
- 分发你修改后的版本。

## 分发时的主要要求

如果你向他人分发本软件或其修改版本，通常需要：

- 保留适当的版权与许可证声明，并随附 GPL v3.0；
- 明确说明你做过的修改及相关日期；
- 以 GPL v3.0 授权所分发的衍生作品，不附加限制接收者权利的额外条款；
- 向接收者提供对应源代码，或依照 GPL v3.0 规定提供有效的源代码获取方式；
- 不以商标、保证或责任承诺暗示原作者为修改版本背书。

GPL 允许收费分发，但收费不会取消接收者复制、修改和再分发该 GPL 软件的权利。

## 保证与责任

在法律允许的范围内，本软件按“现状”提供，不附带任何明示或默示担保。作者或贡献者通常不对因使用或无法使用本软件产生的损失负责；具体边界以 GPL v3.0 原文及适用法律为准。

## 第三方组件

项目包含 Muya 及其他开源依赖。`app/packages/muya/package.json` 标注 Muya 核心包采用 MIT License；其他依赖分别受其自身许可证约束。再分发时，请同时检查 `package-lock.json`、`Cargo.lock` 与各上游项目的许可证要求。

## 如何获得源码

完整开发源码位于 [Notademics-Windows GitHub 仓库]({{ site.repository_url }})。每个正式 Release 还提供 `Notademics_<版本>_source.zip`，该附件仅打包相应标签下 `app/` 目录的内容，便于与应用版本对应。

  </div>
</article>
