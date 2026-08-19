// 源码模式编辑器 —— CodeMirror 5，对齐 marktext sourceCode.vue 的行为：
// 编辑防抖提交内容、与 WYSIWYG 共享同一 tab 内容、切换时交还光标。
import { useEffect, useRef } from 'react';
import codeMirror from '../../codeMirror';
import { useEditorStore } from '../../store/editor';
import bus from '../../bus';

const markdownToc = (markdown: string) => markdown.split(/\r?\n/).flatMap((line, index) => {
  const match = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
  if (!match) return [];
  const content = match[2].replace(/[*_`~[\]]/g, '').trim();
  return [{ content, lvl: match[1].length, slug: `source-heading-${index}`, githubSlug: content.toLowerCase().replace(/\s+/g, '-') }];
});

interface SourceCodeProps {
  active?: boolean;
  markdown?: string;
  textDirection?: string;
}

export default function SourceCode({ active = false, markdown, textDirection }: SourceCodeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<ReturnType<typeof codeMirror> | null>(null);
  const commitTimerRef = useRef<number | null>(null);
  const editorStore = useEditorStore();
  const lastValueRef = useRef<string | null>(null);

  useEffect(() => {
    const host = containerRef.current;
    if (!host) return;
    const cm = codeMirror(host, {
      mode: 'markdown-math',
      lineNumbers: false,
      lineWrapping: true,
      styleActiveLine: true,
      autoCloseBrackets: true,
      autoCloseTags: true,
      spellcheck: false,
      value: markdown ?? ''
    });
    editorRef.current = cm;
    lastValueRef.current = markdown ?? null;
    cm.on('change', () => {
      if (commitTimerRef.current !== null) window.clearTimeout(commitTimerRef.current);
      commitTimerRef.current = window.setTimeout(() => {
        const value = cm.getValue();
        lastValueRef.current = value;
        const file = editorStore.currentFile;
        if (file) {
          editorStore.LISTEN_FOR_CONTENT_CHANGE({
            id: file.id,
            markdown: value,
            wordCount: undefined,
            history: undefined,
            cursor: undefined,
            toc: markdownToc(value),
            blocks: undefined
          });
        }
      }, 200);
    });

    const insertTextAtCursor = (payload: unknown): void => {
      const text = String(payload ?? '');
      if (!text) return;
      cm.focus();
      cm.replaceSelection(text, 'end');
    };
    bus.on('insert-text-at-cursor', insertTextAtCursor);

    return () => {
      bus.off('insert-text-at-cursor', insertTextAtCursor);
      if (commitTimerRef.current !== null) window.clearTimeout(commitTimerRef.current);
      // 卸载（切到 WYSIWYG）时把当前值交还
      const value = cm.getValue();
      if (value !== lastValueRef.current) {
        const file = editorStore.currentFile;
        if (file) {
          bus.emit('file-changed', { id: file.id, markdown: value });
        }
      }
      cm.getWrapperElement().remove();
      editorRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 外部内容替换（切换标签）
  useEffect(() => {
    const cm = editorRef.current;
    if (!cm) return;
    const current = cm.getValue();
    if (markdown !== undefined && markdown !== current && markdown !== lastValueRef.current) {
      lastValueRef.current = markdown;
      cm.setValue(markdown);
    }
  }, [markdown]);

  useEffect(() => {
    if (active) requestAnimationFrame(() => editorRef.current?.refresh());
  }, [active]);

  return <div ref={containerRef} className="source-code" style={{ height: '100%', width: '100%' }} />;
}
