/**
 * bundle-entry.ts — Live 渲染测试入口（被 esbuild 打包为单个 ESM，供
 * live-render.mjs 在 jsdom 环境加载）。
 *
 * 组装的是应用真实使用的 Live 渲染扩展：
 *   - liveEditExtension()  来自 cm-live-render.ts —— 行内标记 WYSIWYG
 *                           （标题/粗体/斜体/删除线/行内代码/链接/列表符号…）
 *   - liveBlocksExtension() 来自 cm-live-blocks.ts —— 块级折叠
 *                           （表格/整行图片/块级数学/行内数学/Mermaid…）
 *   - taskListExtension()   来自 cm-task-list.ts —— 任务列表 checkbox
 *
 * Editor.tsx 目前只接入了 liveEditExtension([])；liveBlocksExtension 与
 * taskListExtension 是同一管线的真实模块，这里一并组合测试。
 */
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
// 别名 import：完整 bundle 里 lang-markdown 的 `markdown` 可能与 app 的
// markdown.ts 模块产生标识符冲突被 esbuild 重命名（重命名后值丢失），
// 别名彻底规避。
import { markdown as cmMarkdown, markdownLanguage as cmMarkdownLanguage } from '@codemirror/lang-markdown';
import { liveEditExtension } from '../../app/src/lib/cm-live-render';
import { liveBlocksExtension } from '../../app/src/lib/cm-live-blocks';
import { taskListExtension } from '../../app/src/lib/cm-task-list';
import { renderMarkdown } from '../../app/src/lib/markdown';

// jsdom 没有真实布局引擎：clientHeight/clientWidth 恒为 0，CM6 因此认为
// viewport 为空，`view.visibleRanges` 返回空数组 —— 依赖它的行内标记
// （cm-live-render）和任务列表（cm-task-list）装饰将全部缺席。测试中把
// visibleRanges patch 成全文范围，让它们像在真实窗口里一样工作。
const visibleRangesDesc = Object.getOwnPropertyDescriptor(
  EditorView.prototype,
  'visibleRanges',
);
if (visibleRangesDesc?.get) {
  Object.defineProperty(EditorView.prototype, 'visibleRanges', {
    get(this: EditorView) {
      return [{ from: 0, to: this.state.doc.length }];
    },
    configurable: true,
  });
}

export interface LiveRenderResult {
  /** 整个编辑器 DOM 的 outerHTML（含 CM 注入的 <style> 之外的骨架） */
  domHtml: string;
  /** 可编辑内容区 contentDOM 的 innerHTML（最接近"渲染结果"的部分） */
  contentHtml: string;
}

/** 把 doc 第 line 行（1-based）的开头作为光标位置。 */
function lineStart(doc: string, line: number): number {
  let pos = 0;
  const lines = doc.split('\n');
  const target = Math.max(1, Math.min(line, lines.length));
  for (let i = 0; i < target - 1; i++) pos += lines[i].length + 1;
  return pos;
}

export async function createLiveEditor(
  markdown: string,
  cursorLine: number,
  opts: Record<string, unknown> = {},
): Promise<LiveRenderResult> {
  const blocks = liveBlocksExtension({
    getImageRoot: () => null,
    getFilePath: () => undefined,
    getPlantuml: () => ({ enabled: false, server: '' }),
    ...(opts as object),
  });

  const state = EditorState.create({
    doc: markdown,
    selection: { anchor: lineStart(markdown, cursorLine) },
    extensions: [
      // 行内标记（cm-live-render）与任务列表（cm-task-list）都从 lezer
      // 语法树取节点 —— 与 Editor.tsx 一致，必须挂 markdown language。
      cmMarkdown({ base: cmMarkdownLanguage }),
      liveEditExtension(blocks),
      taskListExtension(),
      EditorView.lineWrapping,
      EditorView.editable.of(true),
    ],
  });

  const parent = document.createElement('div');
  document.body.appendChild(parent);
  const view = new EditorView({ state, parent });

  // CM 的首帧渲染（含行内 mark 装饰与 block widget 挂载）发生在 rAF 回调里；
  // jsdom 的 rAF 用 setTimeout 模拟。等一两帧再读 DOM，否则行内装饰缺席。
  await new Promise((r) => setTimeout(r, 40));

  return {
    domHtml: view.dom.outerHTML,
    contentHtml: view.contentDOM.innerHTML,
  };
}

/** 对照组：同源码走 Preview 管线，方便肉眼对比两种模式。 */
export function previewHtml(markdown: string): string {
  return renderMarkdown(markdown);
}
