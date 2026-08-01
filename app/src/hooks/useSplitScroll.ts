import { useEffect, useRef, useCallback } from 'react';

/**
 * Bidirectional scroll sync between an editor pane and a preview pane.
 *
 * On editor scroll: maps the top visible line to a `data-source-line` element
 * in the preview and scrolls it into view.
 * On preview scroll: maps the top visible `data-source-line` back to a
 * line number and tells the editor to scroll there.
 *
 * The preview HTML must have `data-source-line="N"` attributes on block-level
 * elements (markdown-it renders these automatically).
 */

export interface ScrollSyncTargets {
  editorScrollEl: HTMLElement | null;
  previewScrollEl: HTMLElement | null;
  /** Map an editor line number (1-based) to a pixel scrollTop in the editor. */
  editorLineToTop: (line: number) => number;
  /** Scroll the editor to a specific line (1-based). Returns the new scrollTop. */
  editorScrollToLine: (line: number) => void;
}

export function useSplitScroll(targets: ScrollSyncTargets, active: boolean) {
  const guardRef = useRef(false);

  useEffect(() => {
    if (!active) return;
    const { editorScrollEl, previewScrollEl, editorLineToTop } = targets;
    if (!editorScrollEl || !previewScrollEl) return;

    // --- Preview: map source-line elements ---
    function getSourceLineElements(): Array<{ line: number; el: HTMLElement }> {
      const nodes = previewScrollEl!.querySelectorAll<HTMLElement>('[data-source-line]');
      const list: Array<{ line: number; el: HTMLElement }> = [];
      for (const el of nodes) {
        const n = Number(el.getAttribute('data-source-line') || '0');
        if (n > 0) list.push({ line: n, el });
      }
      list.sort((a, b) => a.line - b.line);
      return list;
    }

    function nearestLineAbove(
      entries: Array<{ line: number; el: HTMLElement }>,
      scrollTop: number,
    ): number {
      // Find the first entry whose element rect is below scrollTop
      for (let i = 0; i < entries.length; i++) {
        const rect = entries[i].el.getBoundingClientRect();
        const containerRect = previewScrollEl!.getBoundingClientRect();
        const relativeTop = rect.top - containerRect.top;
        if (relativeTop > scrollTop) {
          return i > 0 ? entries[i - 1].line : entries[0]?.line ?? 1;
        }
      }
      return entries[entries.length - 1]?.line ?? 1;
    }

    function nearestElementAtLine(
      entries: Array<{ line: number; el: HTMLElement }>,
      targetLine: number,
    ): HTMLElement | null {
      // Binary search for closest element at or before targetLine
      let best: HTMLElement | null = null;
      let bestLine = 0;
      for (const entry of entries) {
        if (entry.line <= targetLine && entry.line > bestLine) {
          best = entry.el;
          bestLine = entry.line;
        }
      }
      return best;
    }

    // ---- Scroll handlers ----
    let driver: 'editor' | 'preview' | null = null;

    function onEditorScroll() {
      if (guardRef.current || driver === 'preview') return;
      driver = 'editor';
      guardRef.current = true;
      try {
        const scrollTop = editorScrollEl!.scrollTop;
        const entries = getSourceLineElements();
        if (entries.length === 0) return;

        // Map editor scrollTop → visible top line
        // Approximate: lineHeight ≈ 22px in the editor
        const topLine = Math.max(1, Math.floor(scrollTop / 22) + 1);
        const targetEl = nearestElementAtLine(entries, topLine);
        if (targetEl) {
          targetEl.scrollIntoView({ block: 'start', behavior: 'instant' });
        }
      } finally {
        guardRef.current = false;
      }
    }

    function onPreviewScroll() {
      if (guardRef.current || driver === 'editor') return;
      driver = 'preview';
      guardRef.current = true;
      try {
        const scrollTop = previewScrollEl!.scrollTop;
        const entries = getSourceLineElements();
        if (entries.length === 0) return;

        const line = nearestLineAbove(entries, scrollTop);
        targets.editorScrollToLine(line);
      } finally {
        guardRef.current = false;
      }
    }

    // Reset driver on pointer/key events (user-initiated)
    function resetDriver() {
      driver = null;
    }

    editorScrollEl.addEventListener('scroll', onEditorScroll, { passive: true });
    previewScrollEl.addEventListener('scroll', onPreviewScroll, { passive: true });
    // Reset driver when user clicks or types
    editorScrollEl.addEventListener('pointerdown', resetDriver);
    editorScrollEl.addEventListener('keydown', resetDriver);
    previewScrollEl.addEventListener('pointerdown', resetDriver);

    return () => {
      editorScrollEl.removeEventListener('scroll', onEditorScroll);
      previewScrollEl.removeEventListener('scroll', onPreviewScroll);
      editorScrollEl.removeEventListener('pointerdown', resetDriver);
      editorScrollEl.removeEventListener('keydown', resetDriver);
      previewScrollEl.removeEventListener('pointerdown', resetDriver);
    };
  }, [active, targets.editorScrollEl, targets.previewScrollEl]);
}
