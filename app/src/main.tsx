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
import './styles/marktext/components.css';
import './styles/marktext/statusBar.css';
import 'katex/dist/katex.min.css';
import bus from './bus';

// WebView2 inherits Chromium navigation/reload/zoom/devtools shortcuts. They
// conflict with the native Tauri menu and editor keybindings. Keep F12 as the
// explicit debugging escape hatch while suppressing browser-only behavior.
window.addEventListener('keydown', (event) => {
  if (event.key === 'F12') return;
  const key = event.key.toLowerCase();
  const ctrl = event.ctrlKey || event.metaKey;
  const viewShortcut =
    (ctrl && !event.altKey && !event.shiftKey && key === 'j' && 'view.toggle-sidebar') ||
    (ctrl && !event.altKey && !event.shiftKey && (key === '\\' || event.code === 'Backslash') && 'view.toggle-sidebar') ||
    (ctrl && event.altKey && !event.shiftKey && key === 'o' && 'view.toggle-toc') ||
    (ctrl && event.altKey && !event.shiftKey && key === 's' && 'view.source-code-mode') ||
    (ctrl && event.shiftKey && !event.altKey && key === 'p' && 'view.command-palette') ||
    (ctrl && !event.altKey && !event.shiftKey && key === 'f' && 'edit.find') ||
    (ctrl && !event.altKey && event.shiftKey && key === 'f' && 'edit.find-in-folder') ||
    (ctrl && !event.altKey && !event.shiftKey && key === 'h' && 'edit.replace') ||
    (!ctrl && !event.altKey && !event.shiftKey && event.key === 'F3' && 'edit.findNext') ||
    (!ctrl && !event.altKey && event.shiftKey && event.key === 'F3' && 'edit.findPrevious') ||
    (ctrl && !event.altKey && !event.shiftKey && (key === '+' || key === '=') && 'window.zoomIn') ||
    (ctrl && !event.altKey && !event.shiftKey && key === '-' && 'window.zoomOut') ||
    (!ctrl && !event.altKey && !event.shiftKey && event.key === 'F11' && 'window.toggle-full-screen');
  if (viewShortcut) {
    event.preventDefault();
    event.stopPropagation();
    bus.emit('cmd::execute', viewShortcut);
    return;
  }
  const browserFunctionKey = ['F1', 'F3', 'F5', 'F6', 'F7', 'F10', 'F11'].includes(event.key);
  const browserCtrlKey = ctrl && [
    'r', 'l', 'u', 'p', 'w', 'n', 't', 'o', 's', 'f', 'g', 'k', 'e', 'd', 'h', 'j',
    '+', '-', '=', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'
  ].includes(key);
  const browserDevtoolsKey = ctrl && event.shiftKey && ['i', 'j'].includes(key);
  const browserNavigationKey = event.altKey && ['arrowleft', 'arrowright', 'home'].includes(key);
  if (browserFunctionKey || browserCtrlKey || browserDevtoolsKey || browserNavigationKey) {
    event.preventDefault();
  }
}, { capture: true });

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
