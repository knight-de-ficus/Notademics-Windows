import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
// cjk-font.css removed: the 43 KB base64 LXGW WenKai font blocked pure-CJK
// text rendering in Tauri WebView2.  System font stacks (main.css) already
// cover CJK with Microsoft YaHei / PingFang SC / Noto Sans CJK on every
// real platform; the font was only needed for the iOS Simulator.
import './styles/main.css';
import './styles/hljs-theme.css';
import 'katex/dist/katex.min.css';

const root = document.getElementById('app');
if (!root) throw new Error('Root element #app not found');

createRoot(root).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
);
