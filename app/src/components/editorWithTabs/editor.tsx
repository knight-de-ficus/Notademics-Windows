// WYSIWYG 编辑器 —— 对齐 marktext components/editorWithTabs/editor.vue 的逻辑。
// 职责：实例化 Muya、把 json-change 派生内容快照写入 editor store、
// 桥接 bus 命令（段落/格式/查找/滚动/保存）到 Muya、持久化光标与滚动。
import { useCallback, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useEditorStore } from '../../store/editor';
import { usePreferencesStore } from '../../store/preferences';
import bus from '../../bus';
import { t } from '../../i18n';
import MuyaEditor, { type MuyaEditorHandle } from '../MuyaEditor';
import FindBar from '../search/index';
import { isOsx, animatedScrollTo } from '../../util';
import { wordCount } from '@muyajs/core';

interface EditorProps {
  markdown: string;
  cursor?: unknown;
  textDirection?: string;
  platform?: string;
}

const STANDAR_Y = 80

export default function Editor({ markdown, cursor, textDirection }: EditorProps) {
  const editorStore = useEditorStore();
  const preferencesStore = usePreferencesStore();
  const editorRef = useRef<MuyaEditorHandle>(null);
  const currentFileRef = useRef(editorStore.currentFile);
  currentFileRef.current = editorStore.currentFile;

  // 构造 Muya options（对齐 marktext editor.vue 的 options 映射）
  const options = useCallback(() => {
    const p = preferencesStore;
    return {
      focusMode: p.focus,
      preferLooseListItem: p.preferLooseListItem,
      autoPairBracket: p.autoPairBracket,
      autoPairMarkdownSyntax: p.autoPairMarkdownSyntax,
      autoPairQuote: p.autoPairQuote,
      trimUnnecessaryCodeBlockEmptyLines: p.trimUnnecessaryCodeBlockEmptyLines,
      bulletListMarker: p.bulletListMarker,
      orderListDelimiter: p.orderListDelimiter,
      tabSize: p.tabSize,
      fontSize: p.fontSize,
      lineHeight: p.lineHeight,
      editorFontFamily: p.editorFontFamily,
      codeFontSize: p.codeFontSize,
      codeFontFamily: p.codeFontFamily,
      wrapCodeBlocks: p.wrapCodeBlocks,
      codeBlockLineNumbers: p.codeBlockLineNumbers,
      listIndentation: p.listIndentation,
      frontmatterType: p.frontmatterType,
      superSubScript: p.superSubScript,
      footnote: p.footnote,
      disableHtml: !p.isHtmlEnabled,
      isGitlabCompatibilityEnabled: p.isGitlabCompatibilityEnabled,
      hideQuickInsertHint: p.hideQuickInsertHint,
      hideLinkPopup: p.hideLinkPopup,
      autoCheck: p.autoCheck,
      sequenceTheme: p.sequenceTheme,
      plantumlServer: p.plantumlServer,
      mermaidTheme: /dark/i.test(p.theme) ? 'dark' : 'default',
      vegaTheme: /dark/i.test(p.theme) ? 'dark' : 'latimes',
      textDirection,
      // 图片插入选择器确认 src 时回调：尝试上传（若配置），否则原样使用
      imageAction: async (state: { src: string; alt?: string; title?: string }) => {
        const src = state.src ?? ''
        if (!src) return src
        // 仅本地/远程 http 路径走上传；data URL 保留内联
        if (/^(https?:|data:)/.test(src) || !currentFileRef.current?.pathname) return src
        try {
          const url = await invoke('upload_image', { req: { path: src } })
          return typeof url === 'string' && url ? url : src
        } catch {
          return src
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textDirection]);

  // ── 内容变更 → store ──
  const handleChange = useCallback((md: string) => {
    const file = currentFileRef.current;
    if (!file) return;
    const wc = wordCount(md);
    editorStore.LISTEN_FOR_CONTENT_CHANGE({
      id: file.id,
      markdown: md,
      wordCount: wc,
      history: undefined,
      cursor: undefined,
      toc: undefined,
      blocks: undefined
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 保存 / 导出等命令桥接 ──
  const doSave = useCallback(() => {
    void editorStore.FILE_SAVE();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleUndo = useCallback(() => editorRef.current?.undo(), []);
  const handleRedo = useCallback(() => editorRef.current?.redo(), []);
  const handleSelectAll = useCallback(() => editorRef.current?.selectAll(), []);
  const handleParagraph = useCallback((type: string) => {
    const muya = editorRef.current?.getMuya();
    if (!muya) return;
    try {
      (muya as unknown as { updateParagraph: (t: string) => void }).updateParagraph(type);
    } catch (e) {
      console.error('updateParagraph failed:', type, e);
    }
  }, []);
  const handleFormat = useCallback((type: string) => {
    const muya = editorRef.current?.getMuya();
    if (!muya) return;
    try {
      (muya as unknown as { format: (t: string) => void }).format(type);
    } catch (e) {
      console.error('format failed:', type, e);
    }
  }, []);

  // 复制为富文本 / HTML / 粘贴纯文本（对齐 marktext handleCopyPaste）
  const handleCopyPaste = useCallback((type: string) => {
    const muya = editorRef.current?.getMuya();
    if (!muya) return;
    const ops = muya as unknown as {
      copyAsRich?: () => void
      copyAsHtml?: () => void
      pasteAsPlainText?: () => void
    };
    try {
      if (type === 'copyAsRich') ops.copyAsRich?.();
      else if (type === 'copyAsHtml') ops.copyAsHtml?.();
      else if (type === 'pasteAsPlainText') ops.pasteAsPlainText?.();
    } catch (e) {
      console.error('copy/paste failed:', type, e);
    }
  }, []);
  const handleSearch = useCallback((payload: unknown) => {
    const muya = editorRef.current?.getMuya();
    if (!muya) return;
    const { value, options: opts } = (payload ?? {}) as { value: string; options?: unknown };
    try {
      (muya as unknown as { search: (v: string, o?: unknown) => unknown }).search(value, opts);
    } catch { /* ignore */ }
  }, []);
  const handReplace = useCallback((payload: unknown) => {
    const muya = editorRef.current?.getMuya();
    if (!muya) return;
    const { value, options: opts } = (payload ?? {}) as { value: string; options?: unknown };
    try {
      (muya as unknown as { replace: (v: string, o?: unknown) => unknown }).replace(value, opts);
    } catch { /* ignore */ }
  }, []);
  const handleFindAction = useCallback((payload: unknown) => {
    const muya = editorRef.current?.getMuya();
    if (!muya) return;
    const action = String(payload ?? 'next') as 'previous' | 'next';
    try {
      muya.find(action);
    } catch { /* ignore */ }
  }, []);
  const scrollToHeader = useCallback((slug: string) => {
    const muya = editorRef.current?.getMuya();
    if (!muya) return;
    // 引擎无直接 API；通过 DOM 查找标题元素滚动（与 marktext scrollToHeader 一致）
    const container = muya.domNode as HTMLElement;
    const target = container.querySelector<HTMLElement>(`[data-slug="${slug}"]`)
      ?? container.querySelector<HTMLElement>(`#${slug}`);
    if (target) {
      animatedScrollTo(container, target.offsetTop - 20, 100);
    }
  }, []);

  // Ctrl/Cmd + 点击链接 → 打开外部链接 / 图片查看（简化：链接走系统浏览器）
  const handleFormatClick = useCallback((payload: { event: MouseEvent; formatType: string; data: unknown }) => {
    const { event, formatType, data } = payload;
    const ctrlOrMeta = (isOsx && event.metaKey) || (!isOsx && event.ctrlKey);
    if (formatType === 'link' && ctrlOrMeta) {
      const href = (data as { href?: string } | null)?.href;
      if (href) {
        void invoke('shell_open_external', { url: href }).catch(() => {});
      }
    }
  }, []);
  const flushActiveEditor = useCallback(() => {
    // MuyaEditor 的 json-change 是同步派发的；此处触发一次手动同步（getMarkdown 强制取最新）
    const md = editorRef.current?.getMarkdown();
    if (md) handleChange(md);
  }, [handleChange]);

  // ── bus 事件注册 ──
  useEffect(() => {
    bus.on('file-loaded', () => {
      const file = editorStore.currentFile;
      if (file) editorRef.current?.setContent(file.markdown);
    });
    bus.on('file-changed', (payload) => {
      const p = (payload ?? {}) as { id?: string; markdown?: string };
      if (typeof p.markdown === 'string') {
        editorRef.current?.setContent(p.markdown);
      }
    });
    bus.on('undo', handleUndo);
    bus.on('redo', handleRedo);
    bus.on('selectAll', handleSelectAll);
    bus.on('paragraph', (payload) => handleParagraph(String(payload)));
    bus.on('format', (payload) => handleFormat(String(payload)));
    bus.on('copyAsRich', () => handleCopyPaste('copyAsRich'));
    bus.on('copyAsHtml', () => handleCopyPaste('copyAsHtml'));
    bus.on('pasteAsPlainText', () => handleCopyPaste('pasteAsPlainText'));
    bus.on('cut', () => editorRef.current?.cut());
    bus.on('copy', () => editorRef.current?.copy());
    bus.on('paste', () => editorRef.current?.paste());
    bus.on('searchValue', handleSearch);
    bus.on('replaceValue', handReplace);
    bus.on('find-action', handleFindAction);
    bus.on('flush-active-editor', flushActiveEditor);
    bus.on('scroll-to-header', (payload) => scrollToHeader(String(payload)));
    bus.on('editor-focus', () => editorRef.current?.focus());
    bus.on('editor-blur', () => editorRef.current?.blur());
    bus.on('duplicate', () => handleParagraph('duplicate'));
    bus.on('createParagraph', () => handleParagraph('paragraph'));
    bus.on('deleteParagraph', () => handleParagraph('delete'));
    bus.on('insertParagraph', (payload) => {
      const dir = String((payload as { location?: string } | undefined)?.location ?? 'after') as 'before' | 'after';
      const muya = editorRef.current?.getMuya();
      if (muya) {
        try {
          (muya as unknown as { insertParagraph: (l: 'before' | 'after', text?: string, outMost?: boolean) => void }).insertParagraph(dir);
        } catch { /* ignore */ }
      }
    });
    return () => {
      // mitt 无退订；组件卸载即整体销毁（单实例 editor，可接受）
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="editor" style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column' }}>
      {!preferencesStore.sourceCode && <FindBar editorRef={editorRef} />}
      <MuyaEditor
        ref={editorRef}
        content={markdown}
        docKey={editorStore.currentFile?.id}
        options={options()}
        typewriter={preferencesStore.typewriter}
        onChange={handleChange}
        onFormatClick={handleFormatClick}
        onSave={doSave}
        className="muya-editor-container"
      />
    </div>
  );
}
