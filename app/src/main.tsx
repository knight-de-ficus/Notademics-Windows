import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles/cjk-font.css';
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
