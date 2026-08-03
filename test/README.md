# 测试用

```bash
# Preview 管线（markdown.ts → markdown-it → HTML）
node test/preview/render.mjs

# Live 管线（jsdom + CodeMirror + cm-live-* 模块，静态快照 + 断言）
node test/live/live-render.mjs

# 实时渲染服务器（浏览器内真实 CodeMirror Live 编辑器 + 实时预览）
node test/realtime/serve.mjs                 # 打开 http://localhost:5175/
node test/realtime/serve.mjs docs/a.md 8090  # 指定文档与端口
```

实时渲染服务器特性：

- 左侧是真实 Live 管线编辑器（行内标记 WYSIWYG、表格/图片/数学块折叠、
  任务列表、Mermaid 真渲染 SVG）
- 右侧是 `renderMarkdown` 实时预览（编辑器打字 debounce 200ms 更新）
- 外部修改 md 文件 → `fs.watch` + SSE → 页面自动同步（有未保存修改时不覆盖）
- `Ctrl+S` 或保存按钮 → 内容写回 md 文件

实现零新依赖：`node:http` + `node:fs.watch` + SSE；bundle 用 esbuild（借
`app/node_modules/.pnpm`），其余依赖只读 `app/node_modules`，不碰 `app/` 工程。

