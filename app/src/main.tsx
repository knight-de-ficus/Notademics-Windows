// 必须是第一个 import：在纯浏览器（无 Tauri）调试时 mock __TAURI_INTERNALS__
import './browserMock';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { useRoutes } from 'react-router-dom';
import { Muya } from '@muyajs/core';
import {
  TableChessboard,
  ParagraphQuickInsertMenu,
  CodeBlockLanguageSelector,
  EmojiSelector,
  ImagePathPicker,
  ImageResizeBar,
  ImageToolBar,
  InlineFormatToolbar,
  ParagraphFrontButton,
  ParagraphFrontMenu,
  PreviewToolBar,
  LinkTools,
  FootnoteTool,
  TableColumnToolbar,
  TableDragBar,
  TableRowColumMenu,
} from '@muyajs/core';
import routes from './router';
import './assets/symbolIcon';
import './styles/marktext/index.css';
import 'katex/dist/katex.min.css';

// Muya UI 插件（进程级注册一次，所有编辑器实例共享）。
// 与 marktext editor.vue 的注册集一致（ImageEditTool 需要 imageAction 选项，
// 由编辑器组件在实例化时注入，故此处跳过）。
// 引擎样式（index/blockSyntax/inlineSyntax/prism-light/katex）由 @muyajs/core
// 入口自动注入。
Muya.use(TableChessboard);
Muya.use(ParagraphQuickInsertMenu);
Muya.use(CodeBlockLanguageSelector);
Muya.use(EmojiSelector);
Muya.use(ImagePathPicker);
Muya.use(ImageResizeBar);
Muya.use(ImageToolBar);
Muya.use(InlineFormatToolbar);
Muya.use(ParagraphFrontButton);
Muya.use(ParagraphFrontMenu);
Muya.use(PreviewToolBar);
Muya.use(LinkTools);
Muya.use(FootnoteTool);
Muya.use(TableColumnToolbar);
Muya.use(TableDragBar);
Muya.use(TableRowColumMenu);

// 按 URL type 参数决定默认页（editor / preference）
const type = new URLSearchParams(window.location.search).get('type');

function AppRoutes() {
  return useRoutes(routes(type));
}

const root = document.getElementById('app');
if (!root) throw new Error('Root element #app not found');

createRoot(root).render(
  <HashRouter>
    <AppRoutes />
  </HashRouter>,
);
