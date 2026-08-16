// 预览模式 Markdown 渲染 —— markdown-it + KaTeX + footnote + 语法高亮。
import MarkdownIt from 'markdown-it';
import katexPlugin from '@vscode/markdown-it-katex';
import footnotePlugin from 'markdown-it-footnote';
import hljs from 'highlight.js';
import 'highlight.js/styles/github.css';

const md: MarkdownIt = new MarkdownIt({
  html: true,
  linkify: true,
  breaks: false,
  highlight(str: string, lang: string): string {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return `<pre class="hljs"><code>${hljs.highlight(str, { language: lang, ignoreIllegals: true }).value}</code></pre>`;
      } catch {
        /* fallthrough */
      }
    }
    return `<pre class="hljs"><code>${md.utils.escapeHtml(str)}</code></pre>`;
  },
});

md.use(katexPlugin);
md.use(footnotePlugin);

export function renderMarkdown(src: string): string {
  return md.render(src);
}
