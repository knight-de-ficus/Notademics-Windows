#!/usr/bin/env node
/**
 * serve.mjs — 实时渲染服务器（零新依赖：Node 内置 http + fs.watch + SSE）
 *
 * 在浏览器里提供一个真实的 CodeMirror Live 编辑器（应用真实 Live 管线，
 * 经 esbuild 打进内存 bundle），并做到"改 markdown，网页实时变"：
 *
 *   1. 编辑器内打字         → 右侧预览 debounce 200ms 实时更新
 *   2. 外部修改 md 文件      → fs.watch 检测 → SSE 推送 'changed'
 *                            → 浏览器自动拉取新内容同步进编辑器（未保存时）
 *   3. 页面 Ctrl+S / 保存按钮 → POST /save 写回 md 文件
 *
 * 用法:
 *   node test/realtime/serve.mjs                 # 默认 sample.md，端口 5175
 *   node test/realtime/serve.mjs docs/a.md 8090  # 指定文档与端口
 *
 * 打开 http://localhost:5175/
 */
import http from 'node:http';
import { readFileSync, writeFileSync, watch } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const APP_NM = path.join(ROOT, 'app/node_modules');
const PORT = Number(process.argv[3] || process.env.PORT || 5175);
const docFile = path.resolve(process.argv[2] || path.join(__dirname, 'sample.md'));

// ---------------------------------------------------------------------------
// 1) esbuild：把 editor-bundle.ts（真实 Live 管线）打进内存 bundle
//    mermaid 用真库（浏览器可跑）；tldraw 动态链 → stub（文档无 tldraw 围栏）
// ---------------------------------------------------------------------------
const esbuildMain = path.join(
  APP_NM, '.pnpm/esbuild@0.25.12/node_modules/esbuild/lib/main.js',
);
const { build } = await import(pathToFileURL(esbuildMain).href);

const tldrawStub = path.join(__dirname, 'stubs/tldraw-stub.mjs');
const stubTldrawPlugin = {
  name: 'stub-tldraw',
  setup(build) {
    build.onResolve({ filter: /^\.\/tldraw-runtime$/ }, () => ({ path: tldrawStub }));
    build.onResolve({ filter: /^tldraw$/ }, () => ({ path: tldrawStub }));
  },
};

const bundle = await build({
  entryPoints: [path.join(__dirname, 'editor-bundle.ts')],
  bundle: true,
  format: 'esm',
  write: false,
  platform: 'browser',
  target: 'es2020',
  logLevel: 'error',
  nodePaths: [APP_NM],
  plugins: [stubTldrawPlugin],
});
const bundleJs = bundle.outputFiles[0].text;

// ---------------------------------------------------------------------------
// 2) SSE 客户端集合 + 文件监听
// ---------------------------------------------------------------------------
const clients = new Set();
function broadcast(msg) {
  for (const res of clients) res.write(`data: ${msg}\n\n`);
}
watch(docFile, () => broadcast('changed'));

// ---------------------------------------------------------------------------
// 3) HTTP 服务
// ---------------------------------------------------------------------------
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = decodeURIComponent(url.pathname);

  // SSE 端点
  if (pathname === '/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.write('retry: 2000\n\n');
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }

  // 文档读取 / 保存
  if (pathname === '/doc' && req.method === 'GET') {
    try {
      res.writeHead(200, { 'Content-Type': 'text/markdown; charset=utf-8' });
      res.end(readFileSync(docFile, 'utf8'));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(`无法读取 ${docFile}: ${e.message}`);
    }
    return;
  }
  if (pathname === '/save' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      try {
        writeFileSync(docFile, body, 'utf8');
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('ok');
        // 显式广播（Windows 上 fs.watch 触发可能滞后/重复，客户端已去抖）
        broadcast('changed');
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(`保存失败: ${e.message}`);
      }
    });
    return;
  }

  // KaTeX 样式（应用真实管线的公式渲染依赖）→ 映射到 app/node_modules/katex/dist
  if (pathname === '/vendor/katex.min.css' || pathname.startsWith('/vendor/fonts/')) {
    const rel = pathname.replace(/^\/vendor\//, '');
    const file = path.join(APP_NM, 'katex/dist', rel);
    try {
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      res.end(readFileSync(file));
    } catch {
      res.writeHead(404); res.end('not found');
    }
    return;
  }

  // 静态文件（index.html 等）
  if (pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(readFileSync(path.join(__dirname, 'index.html'), 'utf8'));
    return;
  }
  if (pathname === '/bundle.js') {
    res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' });
    res.end(bundleJs);
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('not found');
});

server.listen(PORT, () => {
  console.log(`✓ 实时渲染已启动`);
  console.log(`  文档 : ${docFile}`);
  console.log(`  地址 : http://localhost:${PORT}/`);
  console.log(`  提示 : 编辑器内打字实时预览；外部改文件自动同步；Ctrl+S 保存回文件`);
});
