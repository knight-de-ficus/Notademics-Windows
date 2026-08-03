#!/usr/bin/env node
/**
 * live-render.mjs — Live（WYSIWYG）渲染管线测试
 *
 * 用应用真实模块（cm-live-render / cm-live-blocks / cm-task-list，经 esbuild
 * 打包）+ CodeMirror 6，在 jsdom 中构建编辑器，把 .md 渲染成两种状态的
 * 编辑器 DOM 并保存为 HTML：
 *
 *   1. 光标在第 1 行（块折叠 + 行内标记隐藏）   —— "所见即所得"状态
 *   2. 光标在表格 header 行（该块展开为源码）   —— "可编辑揭示"状态
 *
 * 并输出断言结果。全部隔离在 test/live/：只读 app/node_modules（esbuild、
 * CodeMirror、markdown 依赖），jsdom 装在 test/live/node_modules。
 *
 * 用法: node test/live/live-render.mjs [doc.md] [out.html]
 */
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../..');

// ---------------------------------------------------------------------------
// 1) esbuild：把 bundle-entry.ts（含 app/src/lib 的 live 模块）打包成单个 ESM
//    mermaid → stub（见 stubs/mermaid-stub.mjs）。esbuild 借用 app 的 .pnpm。
// ---------------------------------------------------------------------------
const esbuildMain = join(
  ROOT, 'app/node_modules/.pnpm/esbuild@0.25.12/node_modules/esbuild/lib/main.js',
);
const { build } = await import(pathToFileURL(esbuildMain).href);

const tmp = mkdtempSync(join(tmpdir(), 'live-render-'));
const outFile = join(tmp, 'bundle-entry.mjs');

// cm-live-blocks 动态 import('./tldraw-runtime') → 真 tldraw（React/canvas）
// 无法在 jsdom 运行；测试文档无 tldraw 围栏，这里用 onResolve 把整条链
// 指向 stub（esbuild 的 alias 只接受包名，相对路径需走插件）。
const tldrawStub = join(__dirname, 'stubs/tldraw-stub.mjs');
const stubTldrawPlugin = {
  name: 'stub-tldraw',
  setup(build) {
    build.onResolve({ filter: /^\.\/tldraw-runtime$/ }, () => ({ path: tldrawStub }));
    build.onResolve({ filter: /^tldraw$/ }, () => ({ path: tldrawStub }));
  },
};

await build({
  entryPoints: [join(__dirname, 'bundle-entry.ts')],
  bundle: true,
  format: 'esm',
  outfile: outFile,
  platform: 'browser',
  target: 'es2020',
  logLevel: 'error',
  // bundle 入口在 test/live/，esbuild 不会自动去 sibling 的 app/node_modules
  // 解析 @codemirror/*、markdown-it、katex 等 —— 用 nodePaths 附加。
  nodePaths: [join(ROOT, 'app/node_modules')],
  alias: { mermaid: join(__dirname, 'stubs/mermaid-stub.mjs') },
  plugins: [stubTldrawPlugin],
});

// ---------------------------------------------------------------------------
// 2) jsdom 环境：CM6 需要 window/document/navigator/raf；@tauri-apps/api/core
//    （被 image-resolve 引用）需要 window.__TAURI_INTERNALS__。
// ---------------------------------------------------------------------------
const dom = new JSDOM('<!DOCTYPE html><html><head><meta charset="utf-8"></head><body></body></html>', {
  pretendToBeVisual: true,
  url: 'https://localhost/',
});
const { window } = dom;
globalThis.window = window;
globalThis.document = window.document;
// Node ≥21 的 globalThis.navigator 是只读 getter，需用 defineProperty 覆盖
Object.defineProperty(globalThis, 'navigator', {
  value: window.navigator,
  configurable: true,
});
globalThis.CustomEvent = window.CustomEvent;
globalThis.getComputedStyle = window.getComputedStyle.bind(window);
// CodeMirror 需要的一批浏览器全局：jsdom 有就补到 Node globalThis
for (const k of [
  'MutationObserver', 'DOMException', 'getSelection', 'matchMedia',
  'Range', 'Node', 'Element', 'HTMLElement', 'Text', 'Comment',
  'DocumentFragment', 'Event', 'KeyboardEvent', 'MouseEvent', 'InputEvent',
  // 构造器：CM6 会做 `window instanceof Window` / `instanceof Document` 检查
  'Window', 'Document', 'HTMLElement', 'HTMLDivElement', 'SVGElement',
]) {
  if (window[k] !== undefined && globalThis[k] === undefined) {
    globalThis[k] = window[k];
  }
}
// jsdom 没有 IntersectionObserver/ResizeObserver —— CM6 对前者有 feature-detect，
// 后者仅在主题测量时用，测试场景不需要。
if (window.requestAnimationFrame) globalThis.requestAnimationFrame = window.requestAnimationFrame.bind(window);
if (window.cancelAnimationFrame) globalThis.cancelAnimationFrame = window.cancelAnimationFrame.bind(window);
window.__TAURI_INTERNALS__ = {
  convertFileSrc: (p) => `asset://localhost/${encodeURIComponent(p)}`,
  invoke: async () => { throw new Error('invoke not available in test'); },
};

const { createLiveEditor, previewHtml } = await import(pathToFileURL(outFile).href);

// ---------------------------------------------------------------------------
// 3) 读取文档，渲染两种光标状态
// ---------------------------------------------------------------------------
const input = process.argv[2] || join(__dirname, 'sample-live.md');
const output = process.argv[3] || join(__dirname, 'sample-live.html');
const source = readFileSync(input, 'utf8');

// 找到表格 header 行号（状态 B 的落点）
const lines = source.split('\n');
const tableHeaderLine = lines.findIndex((l) => l.trim().startsWith('|') && l.includes('列A')) + 1;

const stateA = await createLiveEditor(source, 1);        // 光标在第 1 行
const stateB = await createLiveEditor(source, tableHeaderLine); // 光标在表格内
await new Promise((r) => setTimeout(r, 50));       // 等 mermaid stub 的微任务填充 SVG 缓存

// ---------------------------------------------------------------------------
// 4) 断言（渲染 DOM 检查）
// ---------------------------------------------------------------------------
let pass = 0, fail = 0;
const ok = (name, cond, detail = '') => {
  if (cond) { console.log('  ✓', name); pass++; }
  else { console.log('  ✗', name, detail); fail++; }
};

console.log('\n=== 状态 A（光标第 1 行，块折叠 + 标记隐藏）===');
const a = stateA.contentHtml;
ok('标题 # 被隐藏（无 HeaderMark）', !/cm-line[^>]*>[^<]*#/.test(a) || !a.includes('HeaderMark'));
ok('粗体 ** 被隐藏、strong 生效', a.includes('cm-md-strong'));
ok('斜体 / 删除线 / 行内代码标记', a.includes('cm-md-em') || a.includes('cm-md-strike') || a.includes('cm-md-code'));
ok('链接渲染为 cm-md-link', a.includes('cm-md-link'));
ok('表格折叠为块 widget', a.includes('cm-live-block--table'));
ok('表格内渲染出 <table>', a.includes('<table'));
ok('整行图片折叠为 <img>', a.includes('cm-live-block--image') && a.includes('<img'));
ok('块级数学折叠', a.includes('cm-live-block--math'));
ok('行内数学折叠为 KaTeX', a.includes('cm-live-inline-math'));
ok('任务列表 checkbox', a.includes('type="checkbox"'));
ok('Mermaid 折叠为 widget', a.includes('cm-live-block--mermaid'));

console.log('\n=== 状态 B（光标在表格 header 行，表格展开源码）===');
const b = stateB.contentHtml;
ok('表格块不再折叠', !b.includes('cm-live-block--table'));
ok('表格源码可见', b.includes('| 列A') || b.includes('列A'));
ok('表格源码中有对齐分隔行', b.includes('---'));
ok('其余块仍折叠（数学）', b.includes('cm-live-block--math'));

console.log('\n=== 与 Preview 管线一致性（同一 markdown-it）===');
const pv = previewHtml(source);
ok('preview 渲染出表格', pv.includes('<table'));
ok('preview 渲染出 KaTeX', pv.includes('katex'));
ok('preview 渲染出任务列表', pv.includes('task-list-item'));

// ---------------------------------------------------------------------------
// 5) 保存 HTML（两个编辑器实例 + Preview 对照）
// ---------------------------------------------------------------------------
const STYLE = `
  body { margin: 0; background: #fff; color: #1f2328; font-family: system-ui, "PingFang SC", "Microsoft YaHei", sans-serif; }
  .stage { max-width: 860px; margin: 0 auto; padding: 20px 24px 64px; }
  .stage h1 { font-size: 1.1em; margin: 0 0 4px; }
  .stage .sub { color: #57606a; font-size: .85em; margin: 0 0 12px; }
  .editor-box { border: 1px solid #d1d9e0; border-radius: 8px; overflow: hidden; margin-bottom: 28px; }
  .editor-box .label { background: #f6f8fa; border-bottom: 1px solid #d1d9e0; padding: 6px 12px; font-size: .8em; color: #57606a; }
  .cm-editor { height: auto !important; }
  .cm-content { min-height: 200px; padding: 16px 20px; font-size: 15px; line-height: 1.7; }
  .preview-box { border: 1px solid #d1d9e0; border-radius: 8px; padding: 16px 24px; }
`;

// CM 把 .cm-* 主题样式注入 <head>；导出整个 document 即可带上
window.document.title = `${basename(input)} — Live render test (jsdom)`;
const body = window.document.body;
body.innerHTML = `
  <div class="stage">
    <h1>Live 模式渲染测试</h1>
    <p class="sub">${basename(input)} · 状态 A：光标在第 1 行（块折叠+标记隐藏） · 状态 B：光标在表格行（块展开） · Preview：同源码对照</p>
    <div class="editor-box"><div class="label">状态 A — 光标第 1 行（所见即所得）</div>${stateA.domHtml}</div>
    <div class="editor-box"><div class="label">状态 B — 光标在表格 header 行（表格源码揭示）</div>${stateB.domHtml}</div>
    <div class="editor-box"><div class="label">Preview 对照 — renderMarkdown() 输出</div><div class="preview-box">${pv}</div></div>
  </div>
  <style>${STYLE}</style>
`;
writeFileSync(output, window.document.documentElement.outerHTML, 'utf8');

console.log(`\n${pass} passed, ${fail} failed`);
console.log(`✓ 已保存: ${output}`);
process.exit(fail > 0 ? 1 : 0);
