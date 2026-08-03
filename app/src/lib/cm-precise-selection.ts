/**
 * cm-precise-selection.ts
 *
 * CM6's `drawSelection` paints selection backgrounds as full-line-width
 * rectangles from its own layout cache. With the Live-edit paragraph
 * spacing / blank-line folding (`.cm-md-blank-hidden` → `height: 0`) that
 * cache goes stale: backgrounds land at the wrong `top`, cover unselected
 * whitespace at line starts, and even merge adjacent lines.
 *
 * This ViewPlugin takes over background rendering entirely:
 *   - horizontal bounds come from `view.coordsAtPos()`, clamped to the
 *     line's VISIBLE TEXT span — list bullets (`- ` → `•`), quote markers
 *     (`>`), and hidden markers are excluded, so the highlight covers only
 *     the actual characters the user selected;
 *   - vertical bounds come from the real `.cm-line` DOM rect;
 *   - lines with no visible text (empty list-items, folded blanks) get no
 *     highlight at all.
 *
 * It manages its own `.cm-selectionBackground` elements inside CM6's
 * `.cm-selectionLayer`, so it is independent of CM6's (wrong) background
 * count / pairing. Selection changes trigger a re-render via rAF.
 */

import { ViewPlugin, ViewUpdate, EditorView } from '@codemirror/view';

const preciseSelection = ViewPlugin.fromClass(
  class {
    private view: EditorView;

    constructor(view: EditorView) {
      this.view = view;
      requestAnimationFrame(() => this.adjust());
    }

    update(u: ViewUpdate) {
      if (u.selectionSet || u.docChanged || u.viewportChanged) {
        requestAnimationFrame(() => this.adjust());
      }
    }

    destroy() {}

    private adjust() {
      const layer = this.view.scrollDOM.querySelector<HTMLElement>(
        '.cm-selectionLayer',
      );
      if (!layer) return;

      const scroller = this.view.scrollDOM;
      const sr = scroller.getBoundingClientRect();
      const sTop = scroller.scrollTop;
      const sLeft = scroller.scrollLeft;

      const sel = this.view.state.selection.main;

      // ── No selection → remove every painted background ──────────────────
      if (sel.empty) {
        for (const bg of layer.querySelectorAll<HTMLElement>(
          '.cm-selectionBackground',
        )) {
          bg.remove();
        }
        return;
      }

      const doc = this.view.state.doc;
      const lineEls = Array.from(
        this.view.contentDOM.querySelectorAll<HTMLElement>('.cm-line'),
      );

      // ── Collect every selected line segment (per real DOM line) ─────────
      // Each segment = one line that has selected characters AND visible text.
      const rects: { left: number; width: number; top: number; height: number }[] = [];

      const fromLine = doc.lineAt(sel.from).number;
      const toLine = doc.lineAt(Math.min(sel.to, doc.length)).number;

      for (let ln = fromLine; ln <= toLine; ln++) {
        const line = doc.line(ln);
        const segStart = Math.max(line.from, sel.from);
        const segEnd = Math.min(line.to, sel.to);
        if (segStart >= segEnd) continue; // empty line / no chars selected

        const lineEl = lineEls[ln - 1];
        // Skip visually folded blank lines (height 0) — nothing to paint.
        if (!lineEl || lineEl.getBoundingClientRect().height <= 0.5) continue;

        // Skip lines with NO visible text (empty list-items, blank lines
        // that carry only a marker) — the user wants no highlight there.
        const textStartX = measureTextStartX(lineEl);
        if (textStartX === null) continue;

        const sc = this.view.coordsAtPos(segStart);
        const ec = this.view.coordsAtPos(segEnd);
        if (!sc || !ec) continue;

        let left = sc.left - sr.left + sLeft;
        let right = ec.left - sr.left + sLeft;

        // Clamp into the visible-text span of this line. textStartX is in
        // VIEWPORT coords — convert to scroller coords before Math.max
        // (mixing units produced a >700px highlight in earlier versions).
        left = Math.max(left, textStartX - sr.left + sLeft);
        if (right <= left) continue; // only markers selected — nothing to paint

        // Vertical bounds: use the line's TEXT bounding box (not the full
        // line height) so the highlight hugs the glyphs and the text sits
        // vertically centered inside it. The line height includes paragraph
        // spacing (padding-bottom) that would otherwise push the highlight
        // taller than the text and off-center.
        const textY = measureTextBoundsY(lineEl);
        if (!textY) continue;
        rects.push({
          left,
          width: right - left,
          top: textY.top - sr.top + sTop,
          height: textY.bottom - textY.top,
        });
      }

      // ── Manage our own background elements (we take over rendering) ─────
      // CM6's drawSelection paints one rectangle per VISUAL line, but with
      // blank-line folding its coordinates go stale and it can MERGE lines
      // into one rectangle. We don't trust its count or pairing — we render
      // exactly `rects.length` backgrounds, reusing existing elements when
      // possible and creating the rest ourselves.
      const existing = Array.from(
        layer.querySelectorAll<HTMLElement>('.cm-selectionBackground'),
      );

      for (let i = 0; i < existing.length; i++) {
        const el = existing[i];
        if (i < rects.length) {
          const r = rects[i];
          el.style.display = '';
          el.style.left = r.left + 'px';
          el.style.width = r.width + 'px';
          el.style.top = r.top + 'px';
          el.style.height = r.height + 'px';
        } else {
          el.style.display = 'none';
        }
      }

      for (let i = existing.length; i < rects.length; i++) {
        const r = rects[i];
        const el = document.createElement('div');
        el.className = 'cm-selectionBackground';
        el.style.position = 'absolute';
        el.style.left = r.left + 'px';
        el.style.width = r.width + 'px';
        el.style.top = r.top + 'px';
        el.style.height = r.height + 'px';
        layer.appendChild(el);
      }
    }
  },
);

/**
 * Measure the x (relative to the viewport) of the first VISIBLE TEXT
 * character on a `.cm-line` element.
 *
 * - Skips text inside bullet widgets (`.cm-md-bullet`).
 * - Skips standalone structural marker nodes: `-` `*` `+` `>` `#`,
 *   `1.` (ordered), `[ ]` / `[x]` (task list).
 * - Skips leading markers inside the same text node (e.g. `> 引用`),
 *   measuring from the first real character after the marker.
 * - Returns `null` when the line has no visible text at all
 *   (e.g. an empty list-item line that only carries a bullet).
 */
/**
 * Measure the vertical bounding box of the VISIBLE TEXT on a `.cm-line`
 * (viewport coords). Returns `null` when the line has no visible glyphs.
 *
 * - Skips bullet-widget glyphs (`.cm-md-bullet`).
 * - Skips hidden / zero-size characters (decorations that hide markers).
 * - INCLUDES structural markers (`>`, `#`, …) — they share the line's
 *   vertical extent, so including them keeps the box representative.
 */
function measureTextBoundsY(
  lineEl: HTMLElement,
): { top: number; bottom: number } | null {
  const walker = document.createTreeWalker(lineEl, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  let minTop = Infinity;
  let maxBottom = -Infinity;
  while ((node = walker.nextNode())) {
    const tn = node as Text;
    const text = tn.textContent ?? '';
    if (!text) continue;

    // Skip bullet-widget glyphs (`•` inside .cm-md-bullet).
    const parent = tn.parentElement;
    if (parent && parent.classList.contains('cm-md-bullet')) continue;

    const range = document.createRange();
    range.setStart(tn, 0);
    range.setEnd(tn, text.length);
    const cr = range.getBoundingClientRect();
    // Skip hidden / zero-size characters (decorations that hide markers).
    if (cr.width <= 0.1 || cr.height <= 0.1) continue;

    minTop = Math.min(minTop, cr.top);
    maxBottom = Math.max(maxBottom, cr.bottom);
  }
  if (minTop === Infinity) return null;
  return { top: minTop, bottom: maxBottom };
}

function measureTextStartX(lineEl: HTMLElement): number | null {
  const walker = document.createTreeWalker(lineEl, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const tn = node as Text;
    const text = tn.textContent ?? '';
    if (!text) continue;

    // Skip bullet-widget text (`•` glyph inside .cm-md-bullet).
    const parent = tn.parentElement;
    if (parent && parent.classList.contains('cm-md-bullet')) continue;

    // (a) This node is a standalone structural marker: "-", ">", "#", "1.", "[ ]".
    if (
      /^[-*+>#]\s*$/.test(text) ||
      /^\d+\.\s*$/.test(text) ||
      /^\[[ xX]\]\s*$/.test(text)
    ) {
      continue;
    }

    // (b) Node begins with a marker + space, e.g. "> 引用" in one text node.
    let skip = 0;
    const mm = text.match(/^(?:[-*+>#]|\d+\.|\[[ xX]\])\s+/);
    if (mm && text.length > mm[0].length) skip = mm[0].length;

    const m = text.slice(skip).match(/\S/);
    if (!m) continue;
    const mIndex = m.index ?? 0;

    const range = document.createRange();
    range.setStart(tn, skip + mIndex);
    range.setEnd(tn, skip + mIndex + 1);
    const cr = range.getBoundingClientRect();
    // Skip hidden / zero-size characters (decorations that hide markers).
    if (cr.width <= 0.1 || cr.height <= 0.1) continue;

    return cr.left;
  }
  return null;
}

export { preciseSelection };

