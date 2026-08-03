#!/usr/bin/env node
/**
 * render.mjs — 独立测试脚本
 *
 * 用项目真实的 Markdown 渲染管线（app/src/lib/markdown.ts → markdown-it）
 * 把 .md 转成完整 HTML 文件。不改动任何项目文件，只读取 app/node_modules
 * 里已安装的依赖，全部输出隔离在本 test/ 目录。
 *
 * 用法:
 *   node test/preview/render.mjs                     # 默认 sample.md -> sample.html
 *   node test/preview/render.mjs docs/a.md           # -> docs/a.html
 *   node test/preview/render.mjs docs/a.md out.html  # 指定输出
 *
 * 依赖: Node >= 23.6（原生 TS type-stripping）；本机为 v25，直接可用。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { renderMarkdown } from '../../app/src/lib/markdown.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const input = process.argv[2] || path.join(__dirname, 'sample.md');
const output =
  process.argv[3] ||
  input.replace(/\.md$/i, '.html');

// markdown.ts 渲染出的 KaTeX 公式需要 katex.min.css 才能正确显示，
// 直接从已安装的 node_modules 读取并内嵌进产物 HTML。
// （本文件位于 test/preview/，根目录是 ../../）
let katexCss = '';
try {
  katexCss = readFileSync(
    path.join(__dirname, '../../app/node_modules/katex/dist/katex.min.css'),
    'utf8',
  );
} catch {
  console.warn('⚠ 未找到 katex.min.css，公式将不带样式');
}

// 精简预览样式：与 app/src/styles/main.css 的 .preview-content 一致的基础排版
// + highlight.js 的 GitHub 浅色配色（与 hljs-theme.css 对应）。
const STYLE = `
  :root {
    --accent: #0969da; --text: #1f2328; --text-muted: #59636e;
    --border: #d1d9e0; --bg: #ffffff; --bg-hover: #f6f8fa;
    --font-ui: system-ui, -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
    --font-mono: ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", monospace;
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--text);
         font-family: var(--font-ui); font-size: 15px; line-height: 1.7; }
  .preview-content { max-width: 760px; margin: 0 auto; padding: 28px 36px 64px; }
  .preview-content h1, .preview-content h2, .preview-content h3,
  .preview-content h4 { font-weight: 700; line-height: 1.25; margin: 1.6em 0 .5em; }
  .preview-content h1 { font-size: 2em; } .preview-content h2 { font-size: 1.5em; }
  .preview-content h3 { font-size: 1.2em; }
  .preview-content p { margin: .8em 0; }
  .preview-content a { color: var(--accent); text-decoration: none; }
  .preview-content a:hover { text-decoration: underline; }
  .preview-content code { font-family: var(--font-mono); font-size: .9em;
    background: var(--bg-hover); padding: .15em .4em; border-radius: 4px; }
  .preview-content pre { font-family: var(--font-mono); background: var(--bg-hover);
    padding: 14px 16px; border-radius: 6px; overflow-x: auto; }
  .preview-content pre code { background: transparent; padding: 0; }
  .preview-content blockquote { border-left: 3px solid var(--accent);
    margin: 1em 0; padding: .2em 1em; color: var(--text-muted); }
  .preview-content ul, .preview-content ol { padding-left: 1.6em; }
  .preview-content table { border-collapse: collapse; margin: 1em 0; }
  .preview-content th, .preview-content td { border: 1px solid var(--border); padding: 6px 12px; }
  .preview-content hr { border: none; border-top: 1px solid var(--border); margin: 2em 0; }
  .preview-content img { max-width: 100%; border-radius: 4px; }
  .preview-content .task-list-item { list-style: none; }
  .preview-content .task-list-item-checkbox { margin-right: .5em; }
  .preview-content .md-frontmatter { background: var(--bg-hover); border-radius: 6px;
    padding: 12px 16px; margin: 1em 0; font-size: .9em; }
  .preview-content .md-frontmatter dl { display: grid; grid-template-columns: auto 1fr; gap: 2px 12px; margin: 0; }
  .preview-content .md-frontmatter dt { font-weight: 600; color: var(--accent); }
  .preview-content .md-frontmatter dd { margin: 0; color: var(--text-muted); }
  /* highlight.js — GitHub 浅色 */
  .hljs { display: block; color: #1f2328; background: transparent; }
  .hljs-comment, .hljs-quote { color: #6a737d; font-style: italic; }
  .hljs-keyword, .hljs-selector-tag, .hljs-doctag, .hljs-literal { color: #cf222e; }
  .hljs-string, .hljs-regexp, .hljs-template-variable, .hljs-addition { color: #0a3069; }
  .hljs-number, .hljs-symbol, .hljs-bullet { color: #0550ae; }
  .hljs-title, .hljs-section { color: #8250df; font-weight: 600; }
  .hljs-attr, .hljs-variable, .hljs-template-tag { color: #953800; }
  .hljs-built_in, .hljs-type { color: #8250df; }
  .hljs-meta { color: #953800; }
`;

const source = readFileSync(input, 'utf8');
const body = renderMarkdown(source);

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${path.basename(input)} — rendered by markdown.ts</title>
<style>${katexCss}\n${STYLE}</style>
</head>
<body>
<div class="preview-content">
${body}
</div>
</body>
</html>
`;

writeFileSync(output, html, 'utf8');
console.log(`✓ ${path.relative(process.cwd(), input)} -> ${path.relative(process.cwd(), output)} (${body.length} bytes of HTML)`);
