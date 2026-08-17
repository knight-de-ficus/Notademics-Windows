/* @refresh reset */
// Muya (WYSIWYG Markdown 引擎) 编辑器封装。
//
// 引擎（vendored @muyajs/core，与 marktext 同源开发版）在每次文档变更时
// 通过 `json-change` 事件广播 ot-json1 操作（JSONState.dispatch /
// _flushOperationCache 均触发），宿主在此事件中取 `getMarkdown()` 同步
// 内容 —— 与 marktext editor.vue 的处理方式一致，无需轮询或手工序列化。
//
// 其他要点（实战验证）：
//  1. Muya 构造时会用新的 contenteditable div 替换传入的容器，React 的
//     ref 指向的旧节点会被移除 —— 一切 DOM 操作必须用 `muya.domNode`。
//  2. 引擎没有内置"光标自动滚动"，监听 `selection-change` 手动跟随。
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import { Muya } from '@muyajs/core';

/** 构造参数中 options 的类型（入口类型面为 Record<string, unknown>）。 */
type MuyaOptions = NonNullable<ConstructorParameters<typeof Muya>[1]>;

export interface MuyaEditorHandle {
  getMarkdown(): string;
  setContent(markdown: string): void;
  undo(): void;
  redo(): void;
  focus(): void;
  blur(): void;
  selectAll(): void;
  getMuya(): Muya | null;
  getTOC(): unknown[];
  cut(): void;
  copy(): void;
  paste(): void;
}

interface MuyaEditorProps {
  /** 初始 Markdown 内容（仅首次挂载 / docKey 变化时写入） */
  content: string;
  /** 文档身份标识：变化时用 setContent 切换内容。
   *  同一 docKey 下的 content prop 变化来自编辑器自身的 onChange 回写，
   *  会被忽略，避免 setContent 重置光标/历史。 */
  docKey?: string;
  /** Muya 配置（初始化后不再响应变化） */
  options?: MuyaOptions;
  /** 打字机模式：光标保持垂直居中 */
  typewriter?: boolean;
  onChange?: (markdown: string) => void;
  onSelectionChange?: (changes: unknown) => void;
  onFormatClick?: (payload: { event: MouseEvent; formatType: string; data: unknown }) => void;
  onBlur?: () => void;
  onSave?: () => void;
  className?: string;
}

export const MuyaEditor = forwardRef<MuyaEditorHandle, MuyaEditorProps>(
  function MuyaEditor(
    { content, docKey, options, typewriter, onChange, onSelectionChange, onFormatClick, onBlur, onSave, className },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const muyaRef = useRef<Muya | null>(null);
    const docKeyRef = useRef<string | undefined>(docKey);
    const lastWrittenRef = useRef<string | null>(null);
    const mountedRef = useRef(false);
    const typewriterRef = useRef(!!typewriter);
    typewriterRef.current = !!typewriter;

    // 用 ref 存回调，避免回调身份变化导致 effect 重新执行
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;
    const onSelectionChangeRef = useRef(onSelectionChange);
    onSelectionChangeRef.current = onSelectionChange;
    const onFormatClickRef = useRef(onFormatClick);
    onFormatClickRef.current = onFormatClick;
    const onBlurRef = useRef(onBlur);
    onBlurRef.current = onBlur;
    const onSaveRef = useRef(onSave);
    onSaveRef.current = onSave;

    useImperativeHandle(ref, () => ({
      getMarkdown() {
        return muyaRef.current?.getMarkdown() ?? '';
      },
      setContent(markdown: string) {
        muyaRef.current?.setContent(markdown);
      },
      undo() {
        muyaRef.current?.undo();
      },
      redo() {
        muyaRef.current?.redo();
      },
      focus() {
        muyaRef.current?.focus();
      },
      blur() {
        muyaRef.current?.blur();
      },
      selectAll() {
        muyaRef.current?.selectAll();
      },
      getMuya() {
        return muyaRef.current;
      },
      getTOC() {
        return muyaRef.current?.getTOC() ?? [];
      },
      cut() {
        // 先聚焦 Muya 的 contenteditable 容器，再执行原生剪切，
        // 避免菜单点击后焦点在菜单上导致 execCommand 作用域错误。
        muyaRef.current?.focus();
        requestAnimationFrame(() => document.execCommand('cut'));
      },
      copy() {
        muyaRef.current?.focus();
        requestAnimationFrame(() => document.execCommand('copy'));
      },
      paste() {
        muyaRef.current?.focus();
        requestAnimationFrame(() => document.execCommand('paste'));
      },
    }), []);

    // ── 光标滚动跟随 ──
    const scrollCursorIntoView = useCallback(() => {
      const muya = muyaRef.current;
      if (!muya) return;
      const container = muya.domNode as HTMLElement;

      let rect: DOMRect | null = null;
      try {
        const sel = document.getSelection();
        if (sel && sel.rangeCount > 0) {
          const range = sel.getRangeAt(0);
          if (container.contains(range.commonAncestorContainer)) {
            const r = range.getBoundingClientRect();
            if (r && (r.width > 0 || r.height > 0)) rect = r;
          }
        }
      } catch {
        /* ignore */
      }

      if (!rect) {
        try {
          const coords = (
            muya as unknown as {
              editor?: { selection?: { getCursorCoords?: () => DOMRect | null } };
            }
          ).editor?.selection?.getCursorCoords?.();
          if (coords && (coords.width > 0 || coords.height > 0)) rect = coords;
        } catch {
          /* ignore */
        }
      }

      if (!rect) {
        try {
          const dom = (
            muya as unknown as {
              editor?: { activeContentBlock?: { domNode?: HTMLElement } };
            }
          ).editor?.activeContentBlock?.domNode;
          if (dom && container.contains(dom)) {
            rect = dom.getBoundingClientRect();
          }
        } catch {
          /* ignore */
        }
      }

      if (!rect) return;

      const cRect = container.getBoundingClientRect();
      const margin = 24;
      const top = rect.top - cRect.top;
      const bottom = rect.bottom - cRect.top;
      const viewH = container.clientHeight;
      if (top < margin) {
        container.scrollTop += top - margin;
      } else if (bottom > viewH - margin) {
        container.scrollTop += bottom - viewH + margin;
      }
    }, []);

    // ── 初始化（仅一次）──
    useEffect(() => {
      const host = containerRef.current;
      if (!host) return;

      const muya = new Muya(host, {
        markdown: content,
        ...options,
      } as unknown as MuyaOptions);
      muya.init();
      muyaRef.current = muya;
      mountedRef.current = true;
      // 以 Muya 规范化后的实际内容为基线，避免打开文档立即显示"未保存"。
      lastWrittenRef.current = muya.getMarkdown();

      const container = muya.domNode as HTMLElement;

      // 文档变更 → 同步 markdown 到宿主
      const onJsonChange = (): void => {
        const md = muya.getMarkdown();
        if (md !== lastWrittenRef.current) {
          lastWrittenRef.current = md;
          onChangeRef.current?.(md);
        }
      };
      muya.on('json-change', onJsonChange);

      muya.on('blur', () => {
        onBlurRef.current?.();
      });
      muya.on('selection-change', (changes: unknown) => {
        onSelectionChangeRef.current?.(changes);
        // 打字机模式：光标垂直居中
        if (typewriterRef.current) {
          const y = (changes as { cursorCoords?: { y?: number } })?.cursorCoords?.y;
          if (typeof y === 'number') {
            const startPosition = container.scrollTop;
            const toPosition = startPosition + y - container.clientHeight / 2;
            if (Math.abs(startPosition - toPosition) > 2) {
              container.scrollTo({ top: toPosition, behavior: 'smooth' });
            }
          }
        }
        requestAnimationFrame(() => scrollCursorIntoView());
      });

      // Ctrl/Cmd + 点击链接/图片 → 转发给宿主（打开链接 / 查看图片）
      muya.on('format-click', (payload: unknown) => {
        onFormatClickRef.current?.(payload as { event: MouseEvent; formatType: string; data: unknown });
      });

      // Ctrl+S 保存
      const onKeyDown = (e: KeyboardEvent) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
          e.preventDefault();
          onSaveRef.current?.();
        }
      };
      container.addEventListener('keydown', onKeyDown);

      docKeyRef.current = docKey;

      return () => {
        container.removeEventListener('keydown', onKeyDown);
        muya.destroy();
        muyaRef.current = null;
        mountedRef.current = false;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── 内容/文档同步 ──
    // 1. docKey 变化 → 切换文档，setContent（并清空历史，避免跨文档 undo 串扰）
    // 2. docKey 未变但内容与最后一次自编辑器写出的内容不一致 → 外部替换，setContent
    // 3. 其余（自身编辑回写）→ 忽略，避免重置光标/历史
    useEffect(() => {
      if (!mountedRef.current) return;
      const muya = muyaRef.current;
      if (!muya) return;
      const sameDoc = docKey === docKeyRef.current;
      if (sameDoc && content === lastWrittenRef.current) return;
      if (sameDoc && content === muya.getMarkdown()) return;
      docKeyRef.current = docKey;
      lastWrittenRef.current = content;
      muya.setContent(content);
      (muya as unknown as { clearHistory?: () => void }).clearHistory?.();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [docKey, content]);

    return (
      <div
        ref={containerRef}
        data-pane="editor"
        data-muya-editor
        className={className}
        style={{ height: '100%', width: '100%', overflow: 'auto' }}
      />
    );
  },
);

export default MuyaEditor;
