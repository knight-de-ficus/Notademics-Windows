/**
 * editor-bundle.ts — 实时渲染页面用的浏览器端入口（被 serve.mjs 用 esbuild
 * 打进内存 bundle，浏览器加载）。
 *
 * 组装的是应用真实使用的 Live 渲染管线：
 *   - liveEditExtension()    行内标记 WYSIWYG（标题/粗体/斜体/链接…）
 *   - liveBlocksExtension()  块级折叠（表格/整行图片/块级+行内数学/Mermaid…）
 *   - taskListExtension()    任务列表 checkbox
 *   - markdown()             lezer 语法树（行内标记/任务列表依赖它）
 *
 * 与 Editor.tsx 的装配一致，只是这里把编辑器直接暴露给页面脚本。
 */
import { EditorView, keymap } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { history, defaultKeymap, historyKeymap } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';
import { liveEditExtension } from '../../app/src/lib/cm-live-render';
import { liveBlocksExtension } from '../../app/src/lib/cm-live-blocks';
import { taskListExtension } from '../../app/src/lib/cm-task-list';
import { renderMarkdown } from '../../app/src/lib/markdown';

export interface LiveEditorHandle {
  view: EditorView;
  /** 用新内容整体替换编辑器文档（外部文件同步用）。 */
  setDoc: (md: string) => void;
  /** 当前文档全文。 */
  getDoc: () => string;
  destroy: () => void;
}

/**
 * 在容器里创建一个带完整 Live 渲染扩展的 CodeMirror 编辑器。
 * @param onDocChange 内容变更回调（md 全文）—— 用于驱动右侧实时预览。
 */
export function createLiveEditor(
  container: HTMLElement,
  initialDoc: string,
  onDocChange: (md: string) => void,
): LiveEditorHandle {
  const blocks = liveBlocksExtension({
    getImageRoot: () => null,
    getFilePath: () => undefined,
    getPlantuml: () => ({ enabled: false, server: '' }),
  });

  const state = EditorState.create({
    doc: initialDoc,
    extensions: [
      keymap.of([...defaultKeymap, ...historyKeymap]),
      history(),
      syntaxHighlighting(defaultHighlightStyle),
      EditorView.lineWrapping,
      // 顺序与 Editor.tsx 一致：liveEdit（含 liveEnterExtension，Prec.highest）
      // 在前，markdown() 的 markdownKeymap 在后 —— 保证 Enter 由
      // handleEnter 处理，而不是 lang-markdown 的 insertNewlineContinueMarkup。
      liveEditExtension(blocks),
      taskListExtension(),
      markdown({ base: markdownLanguage, codeLanguages: languages }),
      EditorView.updateListener.of((u) => {
        if (u.docChanged) onDocChange(u.state.doc.toString());
      }),
    ],
  });

  const view = new EditorView({ state, parent: container });

  // 调试辅助：暴露 view 供浏览器端测试脚本使用
  (window as unknown as Record<string, unknown>).__liveView = view;

  return {
    view,
    setDoc(md: string) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: md } });
    },
    getDoc: () => view.state.doc.toString(),
    destroy: () => view.destroy(),
  };
}

/** 同一 markdown-it 管线的预览渲染（右侧面板）。 */
export function renderPreview(md: string): string {
  return renderMarkdown(md);
}
