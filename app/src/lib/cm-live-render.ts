/**
 * cm-live-render.ts — WYSIWYG "live edit" CM6 extension for SoloMD v2.3
 *
 * Goes further than `cm-live-preview.ts`. The preview-style extension hides
 * a few marker characters and lets the HighlightStyle do the rest. This
 * extension is the editor-only "live edit" mode (Typora / Obsidian Live
 * Preview equivalent) — it RENDERS markdown formatting inline:
 *
 *   - `# Heading` → larger bold heading; the `#` is hidden when the caret
 *     is on a different line.
 *   - `**bold**` → bold text; `**` markers hidden when caret is outside.
 *   - `*italic*` / `_italic_` → italic; markers hidden when caret outside.
 *   - `` `code` `` → monospace + bg; backticks hidden when caret outside.
 *   - `[label](url)` → blue + underlined; raw form revealed when caret
 *     enters either the label or the URL part.
 *   - `- item`, `* item`, `1. item` → list bullet/number stays visible
 *     because that IS the visual rendering for a list — but we slim down
 *     the spacing and color it like the preview.
 *   - `> quote` → indented + left bar via a `Decoration.line` class; the
 *     `>` itself stays visible (Typora hides it; we keep it because hiding
 *     the `>` makes new-line-into-quote ergonomics worse).
 *   - Fenced code blocks (`` ``` ``) → grey background; existing syntax
 *     coloring from the markdown package handles the inner tokens.
 *   - `~~strike~~` → strikethrough; markers hidden when caret outside.
 *
 * Caret reveal model: a marker decoration is suppressed (raw markdown
 * shown) when the user's selection touches the same LINE as the marker.
 * Multi-line selections naturally reveal everything they cross.
 *
 * Performance: decoration recompute happens on `docChanged`,
 * `selectionSet`, or `viewportChanged` only, and only iterates the
 * syntax tree over `view.visibleRanges` — i.e. O(viewport) not O(doc).
 *
 * CJK note: the lezer-markdown parser emits `EmphasisMark` nodes
 * regardless of full-width punctuation around markers, so `**粗体**`
 * just works. We don't post-filter on character classes.
 */

import { syntaxTree, HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import type { Range, Text } from '@codemirror/state';

// Minimal structural view of a lezer `SyntaxNode`. `@lezer/common` is only a
// transitive dependency (not in our package.json), so we describe just the
// tree-walk fields we touch rather than importing the real type.
export interface MdSyntaxNode {
  name: string;
  parent: MdSyntaxNode | null;
  firstChild: MdSyntaxNode | null;
  nextSibling: MdSyntaxNode | null;
}
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
  WidgetType,
} from '@codemirror/view';
import { frozenDuringComposition, isImeSafeFlushTransaction } from './cm-ime-guard';
import { tags as t } from '@lezer/highlight';
import { isDragging, isDragEndTransaction } from './cm-drag-aware';
import { liveEnterExtension } from './cm-live-enter';
import { preciseSelection } from './cm-precise-selection';

// ---------------------------------------------------------------------------
// Marker nodes that we hide off-line. Brackets/parens for links and
// backticks for inline code are included here so the rendered text reads
// like a real preview. When the caret is on the same line the marker is
// revealed so it stays editable.
// ---------------------------------------------------------------------------
const HIDDEN_MARK_NODES = new Set<string>([
  'HeaderMark',     // `#`, `##`, …
  'EmphasisMark',   // `*`, `_`
  'StrikethroughMark', // `~~`
  'CodeMark',       // backticks for inline code AND fenced code
  'LinkMark',       // `[`, `]`, `(`, `)` around links
  // NOTE: QuoteMark (`>`) is intentionally NOT hidden — blockquote markers
  // stay visible so the quote structure reads clearly while editing.
  'LinkTitle',      // optional title in `[label](url "title")`
  'CodeInfo',       // language tag after ``` — visually noisy off-line
]);

// `URL` nodes are special: inside `[label](url)` we want to hide them so
// only the label shows; inside an Autolink (`<https://x.com>`) the URL
// IS the visible text and hiding it would erase the link. We handle URL
// in the iterate callback by checking the parent.

// Inline mark decorations applied on top of the existing token highlight.
// Class names follow `cm-md-…` so theme overrides are easy.
const headingClass = (level: number) =>
  Decoration.mark({ class: `cm-md-h cm-md-h${level}`, inclusive: false });
const strongMark = Decoration.mark({ class: 'cm-md-strong' });
const emMark = Decoration.mark({ class: 'cm-md-em' });
const strikeMark = Decoration.mark({ class: 'cm-md-strike' });
const codeMark = Decoration.mark({ class: 'cm-md-code' });
const linkMark = Decoration.mark({ class: 'cm-md-link' });

const hideDeco = Decoration.replace({});

// ---------------------------------------------------------------------------
// List + horizontal-rule rendering (v4.7.1). Off the caret line we render
// the markdown the way a preview would; on the caret line the raw source is
// revealed so it stays editable — same model as the inline marks above.
//   - `- item` / `* item` / `+ item` → the marker becomes a • bullet glyph.
//   - `1. item`                       → number kept (it IS the visual), just
//                                       styled; not replaced.
//   - `- [ ] item`                    → the dash is hidden so the checkbox
//                                       (rendered by cm-task-list.ts) leads.
//   - `---` / `***` / `___`           → a real <hr> rule.
// ---------------------------------------------------------------------------
// Widgets carry their own inline styling so they render correctly under BOTH
// the liveEdit theme (here) and the edit-mode livePreview extension
// (cm-live-preview.ts), which reuses these via the exports below.
class BulletWidget extends WidgetType {
  eq() {
    return true;
  }
  toDOM() {
    const span = document.createElement('span');
    span.className = 'cm-md-bullet';
    span.textContent = '•';
    span.style.color = 'var(--md-list)';
    span.style.fontWeight = '700';
    span.setAttribute('aria-hidden', 'true');
    return span;
  }
  ignoreEvent() {
    return false;
  }
}

class HrWidget extends WidgetType {
  eq() {
    return true;
  }
  toDOM() {
    const hr = document.createElement('hr');
    hr.className = 'cm-md-hr';
    hr.style.display = 'inline-block';
    hr.style.width = '100%';
    hr.style.height = '0';
    hr.style.margin = '0.2em 0';
    hr.style.border = 'none';
    hr.style.borderTop = '1px solid var(--border)';
    hr.style.verticalAlign = 'middle';
    return hr;
  }
}

export const bulletDeco = Decoration.replace({ widget: new BulletWidget() });
export const hrDeco = Decoration.replace({ widget: new HrWidget() });

// Does the `ListMark`'s ListItem hold a GFM TaskMarker (`[ ]` / `[x]`)?
// Those are already rendered as a checkbox by cm-task-list.ts, so we hide the
// leading dash instead of swapping in a bullet.
export function listItemHasTask(listMark: MdSyntaxNode): boolean {
  const item = listMark.parent; // ListItem
  if (!item) return false;
  for (let child = item.firstChild; child; child = child.nextSibling) {
    if (child.name === 'TaskMarker' || child.name === 'Task') return true;
  }
  return false;
}

// Heading nodes 1..6 → level
const HEADING_LEVELS: Record<string, number> = {
  ATXHeading1: 1, ATXHeading2: 2, ATXHeading3: 3,
  ATXHeading4: 4, ATXHeading5: 5, ATXHeading6: 6,
  SetextHeading1: 1, SetextHeading2: 2,
};

function buildDecorations(view: EditorView): DecorationSet {
  const sel = view.state.selection.main;
  const fromLine = view.state.doc.lineAt(sel.from).number;
  const toLine = view.state.doc.lineAt(sel.to).number;
  const tree = syntaxTree(view.state);

  // We collect into a flat list of `Range<Decoration>` and then call
  // `Decoration.set(ranges, /* sort */ true)` — that's the documented
  // forgiving path for adding line + mark decorations together. The
  // `sort=true` arg lets CM6 sort by (from, startSide) for us, which is
  // necessary because line and mark decorations have different sides.
  const ranges: Range<Decoration>[] = [];

  // Multiple line decorations on the SAME line would collide in
  // `Decoration.set` (the later range silently replaces the earlier one),
  // so every line-level class — heading / quote / fenced / paragraph-spacing
  // — is collected here per line and emitted as ONE combined
  // `Decoration.line({ class: 'a b c' })` at the end.
  const lineClasses = new Map<number, string[]>();
  const addLineClass = (lineFrom: number, cls: string) => {
    const arr = lineClasses.get(lineFrom);
    if (arr) {
      if (!arr.includes(cls)) arr.push(cls);
    } else {
      lineClasses.set(lineFrom, [cls]);
    }
  };

  for (const { from, to } of view.visibleRanges) {
    tree.iterate({
      from,
      to,
      enter: (node) => {
        const name = node.name;
        const nFrom = node.from;
        const nTo = node.to;
        const lineAtNode = view.state.doc.lineAt(nFrom).number;
        const lineEndAtNode = view.state.doc.lineAt(
          Math.min(nTo, view.state.doc.length),
        ).number;
        const caretTouches = lineEndAtNode >= fromLine && lineAtNode <= toLine;

        // ---- Always-hidden markers (none currently; kept as extension point) ----
        if (HIDDEN_MARK_NODES.has(name)) {
          if (!caretTouches && nTo > nFrom) {
            // v4.3.5 #83 — for ATX heading marks (`#`, `##`, …) also hide
            // the single trailing space that separates the marker from
            // the heading text. Without this, the space character remains
            // and renders at the heading line's font-size, so H1 (1.85em
            // space) visibly indents further than H4 (1.1em space) etc.
            // Headings end up looking left-staggered instead of aligned.
            let hideTo = nTo;
            if (name === 'HeaderMark') {
              const line = view.state.doc.lineAt(nFrom);
              // Setext headings put `HeaderMark` on the underline (---/===)
              // line, with no following space to eat. Only widen for ATX.
              if (line.from === nFrom && nTo - nFrom <= 6) {
                const after = view.state.doc.sliceString(nTo, Math.min(nTo + 1, view.state.doc.length));
                if (after === ' ') hideTo = nTo + 1;
              }
            }
            ranges.push(hideDeco.range(nFrom, hideTo));
          }
          return;
        }

        // ---- URL: hide only when it's the destination part of a real
        //      `[label](url)` link. Autolinks (`<https://x.com>`) make
        //      the URL the visible text, so we leave it alone there. ----
        if (name === 'URL') {
          const parent = node.node.parent;
          const inLabeledLink = parent && parent.name === 'Link';
          if (inLabeledLink && !caretTouches && nTo > nFrom) {
            ranges.push(hideDeco.range(nFrom, nTo));
          }
          return;
        }

        // ---- Headings: line class for sizing + heading mark on text ----
        if (HEADING_LEVELS[name]) {
          const level = HEADING_LEVELS[name];
          const lineObj = view.state.doc.lineAt(nFrom);
          addLineClass(lineObj.from, `cm-md-heading-line cm-md-heading-line-${level}`);
          if (nFrom < nTo) {
            ranges.push(
              headingClass(level).range(nFrom, Math.min(nTo, view.state.doc.length)),
            );
          }
          return;
        }

        // ---- Inline strong / emphasis / strike ----
        if (name === 'StrongEmphasis' && nFrom < nTo) {
          ranges.push(strongMark.range(nFrom, nTo));
          return;
        }
        if (name === 'Emphasis' && nFrom < nTo) {
          ranges.push(emMark.range(nFrom, nTo));
          return;
        }
        if (name === 'Strikethrough' && nFrom < nTo) {
          ranges.push(strikeMark.range(nFrom, nTo));
          return;
        }

        // ---- Inline code ----
        if (name === 'InlineCode' && nFrom < nTo) {
          ranges.push(codeMark.range(nFrom, nTo));
          return;
        }

        // ---- Links ----
        if (name === 'Link' && nFrom < nTo) {
          ranges.push(linkMark.range(nFrom, nTo));
          return;
        }

        // ---- Blockquote line styling ----
        // Only apply quote styling when the line has a valid `> ` marker
        // (`>` followed by whitespace) — `>text` without space and a lone
        // `>` at EOL are not blockquotes (rendered as plain text, see
        // markdown.ts `escapeBareQuoteMarkers`).
        if (name === 'Blockquote') {
          const startLine = view.state.doc.lineAt(nFrom).number;
          const endLine = view.state.doc.lineAt(
            Math.min(nTo, view.state.doc.length),
          ).number;
          for (let ln = startLine; ln <= endLine; ln++) {
            const t = view.state.doc.line(ln).text;
            if (/^> /.test(t)) {
              addLineClass(view.state.doc.line(ln).from, 'cm-md-quote-line');
            }
          }
          return;
        }

        // ---- Fenced code block background ----
        if (name === 'FencedCode' || name === 'CodeBlock') {
          const startLine = view.state.doc.lineAt(nFrom).number;
          const endLine = view.state.doc.lineAt(
            Math.min(nTo, view.state.doc.length),
          ).number;
          for (let ln = startLine; ln <= endLine; ln++) {
            addLineClass(view.state.doc.line(ln).from, 'cm-md-fenced-line');
          }
          return;
        }

        // ---- List markers (v4.7.1) ----
        // Bullets (`-`/`*`/`+`) become a • glyph; ordered numbers stay; a
        // task item's dash is hidden so the checkbox widget leads. Revealed
        // (raw) on the caret line so the marker stays editable.
        if (name === 'ListMark') {
          if (caretTouches || nTo <= nFrom) return;
          const mark = view.state.doc.sliceString(nFrom, nTo);
          const isBullet = mark === '-' || mark === '*' || mark === '+';
          if (!isBullet) return; // ordered list ("1.", "2)") keeps its number
          if (listItemHasTask(node.node as unknown as MdSyntaxNode)) {
            // Hide "- " (dash + trailing space) — the checkbox renders the item.
            const after = view.state.doc.sliceString(
              nTo,
              Math.min(nTo + 1, view.state.doc.length),
            );
            ranges.push(hideDeco.range(nFrom, after === ' ' ? nTo + 1 : nTo));
          } else {
            ranges.push(bulletDeco.range(nFrom, nTo));
          }
          return;
        }

        // ---- Horizontal rule (v4.7.1): `---` / `***` / `___` → <hr> ----
        if (name === 'HorizontalRule') {
          if (caretTouches || nTo <= nFrom) return;
          ranges.push(hrDeco.range(nFrom, nTo));
          return;
        }
      },
    });
  }

  // ---- Paragraph blank-line folding (see addParagraphSpacing below) ----
  addParagraphSpacing(view, addLineClass);

  // Emit every line-level class as ONE combined line decoration per line
  // (multiple line decorations on the same range would collide in
  // `Decoration.set` — the later one silently replaces the earlier).
  for (const [lineFrom, clsArr] of lineClasses) {
    ranges.push(Decoration.line({ class: clsArr.join(' ') }).range(lineFrom));
  }

  // sort = true so CM6 handles (from, side) ordering regardless of the
  // mixed line/mark/replace decorations we collected.
  return Decoration.set(ranges, true);
}

/**
 * Wires the paragraph blank-line folding into a line-class collector.
 * The pure computation lives in computeParagraphSpacing() (unit-tested).
 */
function addParagraphSpacing(
  view: EditorView,
  addLineClass: (lineFrom: number, cls: string) => void,
) {
  const doc = view.state.doc;
  const codeLines = collectCodeBlockLines(syntaxTree(view.state), doc);
  // Caret-aware folding: the line the caret sits on stays expanded; and
  // during an actual (non-empty) selection folding is disabled entirely so
  // drag-selecting never un-folds lines under the mouse.
  const selMain = view.state.selection.main;
  const selectionActive = view.state.selection.ranges.some((r) => !r.empty);
  const caretLine = doc.lineAt(selMain.head).number;
  for (const { from, to } of view.visibleRanges) {
    const spacing = computeParagraphSpacing(
      doc,
      codeLines,
      doc.lineAt(from).number,
      doc.lineAt(to).number,
      caretLine,
      selectionActive,
    );
    for (const [ln, clsArr] of spacing) {
      for (const cls of clsArr) addLineClass(doc.line(ln).from, cls);
    }
  }
}

/** Line numbers covered by fenced/indented code blocks (blank lines inside
 *  them are exempt from folding). Pure — unit-tested. */
export function collectCodeBlockLines(
  tree: { iterate: (spec: { enter(node: { name: string; from: number; to: number }): void }) => void },
  doc: Text,
): Set<number> {
  const codeLines = new Set<number>();
  tree.iterate({
    enter(node) {
      const name = node.name;
      if (name === 'FencedCode' || name === 'CodeBlock') {
        const from = doc.lineAt(node.from).number;
        const to = doc.lineAt(Math.min(node.to, doc.length)).number;
        for (let ln = from; ln <= to; ln++) codeLines.add(ln);
      }
    },
  });
  return codeLines;
}

/**
 * Paragraph blank-line folding for lines `startLine..endLine` (inclusive).
 * Returns per-line class lists, e.g. `Map<lineNo, ['cm-md-blank-hidden']>`.
 *
 * Rules (n = number of consecutive structural blank lines; a structural blank
 * is `^\s*$` or a quote-only line `^\s*>\s+$` — the `>` MUST be followed by
 * whitespace; a bare `>` at EOL is plain text, not a quote/blank):
 *
 *   BETWEEN two content lines (prevContent && nextContent) — Typora-matched:
 *     1. Split the run into segments by blank TYPE (quote `> ` vs plain);
 *        the position counter RESETS at each segment boundary.
 *     2. Within a segment keep EVEN positions (2,4,…), fold ODD (1,3,…).
 *     3. The LAST blank of the run is always folded (hugs the next content).
 *     Verified: 2 quotes→0, 4 quotes→1, 4q+1p→2 quotes, 3q+2p→1 quote,
 *     1q+3p→1 plain, 3q+4p→1 quote+1 plain, plain 1/2/3/4→0/0/1/1.
 *
 *   TRAILING run (prevContent, no nextContent) at document end:
 *     keep positions 0, 2, 4, … (the first visible line must stay for the
 *     caret to land on at end-of-document).  count = ⌈n/2⌉.
 *
 *   LEADING run (no prevContent, nextContent) at document start:
 *     folded entirely (no leading blank paragraph rows).
 *
 * Spacing (padding-bottom only, so CodeMirror measures it):
 *   - content line followed by a blank line → `cm-md-para-gap` (padding P)
 *   - content line followed by another content line → `cm-md-para-inline` (P/2)
 *   - kept empty-paragraph line followed by a folded blank → `cm-md-para-gap`
 *   - code-block interior lines get no classes
 */
export function computeParagraphSpacing(
  doc: Text,
  codeLines: ReadonlySet<number>,
  startLine: number,
  endLine: number,
  caretLine = 0,
  selectionActive = false,
): Map<number, string[]> {
  const out = new Map<number, string[]>();

  // A blank line that the caret is resting on is NEVER folded (kept at full
  // height) so the user sees where they are; any other blank in the run still
  // folds per the rules below. During a selection (caretLine ignored) folding
  // is skipped so a drag over folded blanks doesn't expand them mid-gesture.
  const forceKeep = (lineNo: number): boolean =>
    !selectionActive && lineNo === caretLine;
  const add = (ln: number, cls: string) => {
    const arr = out.get(ln);
    if (arr) {
      if (!arr.includes(cls)) arr.push(cls);
    } else {
      out.set(ln, [cls]);
    }
  };

  const blank = (ln: number): boolean => {
    if (ln < 1 || ln > doc.lines) return false;
    if (codeLines.has(ln)) return false;
    const t = doc.line(ln).text;
    // A quote line counts as blank only when the `>` is followed by
    // whitespace (`> `). A bare `>` at EOL is plain text (see markdown.ts
    // `escapeBareQuoteMarkers`), NOT a structural blank.
    return /^\s*$/.test(t) || /^\s*>\s+$/.test(t);
  };
  const content = (ln: number): boolean => {
    if (ln < 1 || ln > doc.lines) return false;
    return !blank(ln);
  };

  let ln = startLine;
  while (ln <= endLine) {
    if (blank(ln)) {
      let runEnd = ln;
      while (runEnd <= doc.lines && blank(runEnd)) runEnd++;
      const runLen = runEnd - ln;
      const prevContent = content(ln - 1);
      const nextContent = content(runEnd);

      if (prevContent && nextContent) {
        // Between two content lines. Typora-matched rule (verified against
        // a 29-scenario Typora matrix):
        //   1. Split the run into type segments — quote blanks (`> `) vs
        //      plain blanks. The position counter RESETS at a segment
        //      boundary (no cross-block counting).
        //   2. Within each segment, keep EVEN positions (2, 4, …), fold
        //      ODD positions (1, 3, …).
        //   3. The LAST blank of the whole run is always folded (it hugs
        //      the following content line — Typora never shows it).
        // Examples:
        //   > aaa  > (1 fold)  > (2 keep)  > (3 fold)  (1 fold)  aaa
        //   2 quote blanks only  → keep #2, but it's the run tail → 0
        //   4 quote blanks only  → keep #2,#4, tail #4 folded → 1
        //   4 quote + 1 plain    → quotes #2,#4 kept (2), plain tail → 2
        let pos = 1;
        let segType: 'quote' | 'plain' | null = null;
        for (let k = 0; k < runLen; k++) {
          const lineNo = ln + k;
          const t = doc.line(lineNo).text;
          const type: 'quote' | 'plain' = /^\s*>\s+$/.test(t) ? 'quote' : 'plain';
          if (type !== segType) {
            segType = type;
            pos = 1;
          }
          const isRunTail = k === runLen - 1;
          const kept = forceKeep(lineNo) || (!isRunTail && pos % 2 === 0);
          add(lineNo, kept ? 'cm-md-blank-kept' : 'cm-md-blank-hidden');
          if (kept) add(lineNo, 'cm-md-para-gap');
          pos++;
        }
      } else if (prevContent) {
        // Trailing run (content above, nothing below) — keep every other
        // starting from pos 0.  count = ⌈n/2⌉.
        const count = Math.ceil(runLen / 2);
        for (let k = 0; k < runLen; k++) {
          const lineNo = ln + k;
          const kept = forceKeep(lineNo) || (k % 2 === 0 && k <= 2 * (count - 1));
          add(lineNo, kept ? 'cm-md-blank-kept' : 'cm-md-blank-hidden');
        }
      } else {
        // Leading run (or entire doc is blank) — fold all.
        for (let k = 0; k < runLen; k++) {
          const lineNo = ln + k;
          const kept = forceKeep(lineNo);
          add(lineNo, kept ? 'cm-md-blank-kept' : 'cm-md-blank-hidden');
        }
      }
      ln = runEnd;
    } else {
      // Content line (heading / quote / list / plain text / code edge).
      // Code-block lines — opening/closing fences AND interior (incl. its
      // blank lines) — never participate in paragraph spacing: the fenced
      // background already provides the visual separation.
      if (codeLines.has(ln)) {
        ln++;
        continue;
      }
      const next = ln + 1;
      if (next <= doc.lines && blank(next)) {
        add(ln, 'cm-md-para-gap');
      } else if (next <= doc.lines && content(next)) {
        add(ln, 'cm-md-para-inline');
      }
      ln++;
    }
  }
  return out;
}

const liveRenderPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    // Signature of the paragraph-spacing line classes currently applied.
    // CodeMirror does NOT re-measure line heights when a decoration class
    // changes (it can't know the class alters layout), yet our folding
    // classes set heights/paddings that MUST be re-measured or clicks and
    // scrolling drift away from what the user sees. When the signature
    // changes we force a measure; the signature is cheap (viewport lines
    // only) so normal typing does not pay for it.
    paraSig = '';

    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
    }

    update(u: ViewUpdate) {
      // IME composition guard (#108) — don't rebuild decorations on the
      // composing line while a Windows IME (Sogou) candidate window is open,
      // or the mid-composition DOM swap drops the composition ("吃字").
      const frozen = frozenDuringComposition(u, this.decorations);
      if (frozen) {
        this.decorations = frozen;
        return;
      }
      // See cm-drag-aware.ts — freeze marker toggles during pointer drag
      // so Windows WebView2 doesn't lose pointer capture mid-selection.
      const dragEnded = u.transactions.some(isDragEndTransaction);
      const imeFlush = u.transactions.some(isImeSafeFlushTransaction);
      if (u.docChanged || u.viewportChanged || dragEnded || imeFlush) {
        const sig = paragraphSpacingSignature(u.view);
        if (sig !== this.paraSig) {
          this.paraSig = sig;
          // Re-measure line heights (0-height folded blanks, paragraph
          // paddings) so posAtCoords / scrolling stay in sync with the
          // rendered layout.
          u.view.requestMeasure();
        }
        this.decorations = buildDecorations(u.view);
        return;
      }
      if (u.selectionSet && !isDragging(u.state)) {
        this.decorations = buildDecorations(u.view);
      }
    }
  },
  { decorations: (v) => v.decorations }
);

/** Signature of the folding/spacing classes across the visible range. */
function paragraphSpacingSignature(view: EditorView): string {
  const doc = view.state.doc;
  const codeLines = collectCodeBlockLines(syntaxTree(view.state), doc);
  const selMain = view.state.selection.main;
  const selectionActive = view.state.selection.ranges.some((r) => !r.empty);
  const caretLine = doc.lineAt(selMain.head).number;
  let sig = '';
  for (const { from, to } of view.visibleRanges) {
    const spacing = computeParagraphSpacing(
      doc,
      codeLines,
      doc.lineAt(from).number,
      doc.lineAt(to).number,
      caretLine,
      selectionActive,
    );
    for (const [ln, clsArr] of spacing) {
      sig += ln + ':' + clsArr.join('+') + ';';
    }
  }
  return sig;
}

// Rich syntax highlighting — same palette as cm-live-preview.ts but kept
// here so live-edit can be used independently of the live-preview toggle.
const liveEditHighlightStyle = HighlightStyle.define([
  { tag: t.heading1, fontWeight: '700', color: 'var(--md-h1)' },
  { tag: t.heading2, fontWeight: '700', color: 'var(--md-h2)' },
  { tag: t.heading3, fontWeight: '700', color: 'var(--md-h3)' },
  { tag: t.heading4, fontWeight: '700', color: 'var(--md-h4)' },
  { tag: t.heading5, fontWeight: '700', color: 'var(--md-h5)' },
  { tag: t.heading6, fontWeight: '700', color: 'var(--md-h6)' },
  { tag: t.strong, fontWeight: '700', color: 'var(--md-strong)' },
  { tag: t.emphasis, fontStyle: 'italic', color: 'var(--md-em)' },
  { tag: t.strikethrough, textDecoration: 'line-through', color: 'var(--text-muted)' },
  { tag: t.link, color: 'var(--md-link)' },
  { tag: t.url, color: 'var(--md-url)' },
  { tag: t.monospace, fontFamily: 'var(--font-mono)', color: 'var(--md-code)' },
  { tag: t.quote, color: 'var(--md-quote)', fontStyle: 'italic' },
  { tag: t.list, color: 'var(--md-list)' },
  { tag: t.contentSeparator, color: 'var(--md-hr)' },
  { tag: t.processingInstruction, color: 'var(--text-faint)' },
  // Code-block syntax (nested languages)
  { tag: t.keyword, color: 'var(--syn-keyword)' },
  { tag: t.string, color: 'var(--syn-string)' },
  { tag: t.number, color: 'var(--syn-number)' },
  { tag: t.comment, color: 'var(--syn-comment)', fontStyle: 'italic' },
  { tag: t.function(t.variableName), color: 'var(--syn-function)' },
  { tag: t.variableName, color: 'var(--syn-variable)' },
  { tag: t.typeName, color: 'var(--syn-type)' },
  { tag: t.className, color: 'var(--syn-type)' },
  { tag: t.propertyName, color: 'var(--syn-property)' },
  { tag: t.operator, color: 'var(--syn-operator)' },
  { tag: t.punctuation, color: 'var(--text-muted)' },
  { tag: t.bracket, color: 'var(--text-muted)' },
  { tag: t.bool, color: 'var(--syn-number)' },
  { tag: t.null, color: 'var(--syn-number)' },
  { tag: t.tagName, color: 'var(--syn-keyword)' },
  { tag: t.attributeName, color: 'var(--syn-property)' },
  { tag: t.attributeValue, color: 'var(--syn-string)' },
]);

// Theme: heading sizes match the Preview pane sizes (h1 2em, h2 1.5em,
// h3 1.2em) so toggling between liveEdit and preview feels seamless.
const liveEditTheme = EditorView.theme({
  '.cm-line': {
    fontVariantLigatures: 'none',
  },
  // Heading lines — use line-decoration to size whole line so layout
  // doesn't jump when markers are revealed/hidden.
  // Note: do NOT set a custom lineHeight here. Heading visual height is
  // achieved through fontSize + padding alone. Overriding lineHeight per
  // line breaks CodeMirror's posAtCoords math (it caches line-box metrics
  // measured against the base lineHeight), making click-to-position land
  // on the wrong line. Keep line-height uniform at the .cm-scroller base.
  '.cm-md-heading-line-1': {
    fontSize: '1.85em',
    fontWeight: '700',
    paddingTop: '0.4em',
    paddingBottom: '0.15em',
  },
  '.cm-md-heading-line-2': {
    fontSize: '1.5em',
    fontWeight: '700',
    paddingTop: '0.3em',
    paddingBottom: '0.1em',
  },
  '.cm-md-heading-line-3': {
    fontSize: '1.22em',
    fontWeight: '700',
  },
  '.cm-md-heading-line-4': { fontSize: '1.1em', fontWeight: '700' },
  '.cm-md-heading-line-5': { fontWeight: '700' },
  '.cm-md-heading-line-6': { fontWeight: '700', color: 'var(--text-muted)' },

  // Heading text color (from the heading mark). The line decoration sets
  // size; this paints the color so emphasis/strong inside a heading
  // inherit cleanly.
  '.cm-md-h1': { color: 'var(--md-h1)' },
  '.cm-md-h2': { color: 'var(--md-h2)' },
  '.cm-md-h3': { color: 'var(--md-h3)' },
  '.cm-md-h4': { color: 'var(--md-h4)' },
  '.cm-md-h5': { color: 'var(--md-h5)' },
  '.cm-md-h6': { color: 'var(--md-h6)' },

  '.cm-md-strong': { fontWeight: '700', color: 'var(--md-strong)' },
  '.cm-md-em': { fontStyle: 'italic', color: 'var(--md-em)' },
  '.cm-md-strike': { textDecoration: 'line-through', color: 'var(--text-muted)' },

  '.cm-md-code': {
    fontFamily: 'var(--font-mono)',
    color: 'var(--md-code)',
    backgroundColor: 'var(--md-code-bg)',
    padding: '0.1em 0.35em',
    borderRadius: '4px',
  },

  '.cm-md-link': {
    color: 'var(--md-link)',
    textDecoration: 'underline',
    textUnderlineOffset: '2px',
  },

  // v4.7.1 — bullet glyph that replaces a `-`/`*`/`+` list marker off-line.
  // `position: relative; z-index: 3` lifts the glyph ABOVE the selection
  // layer (`.cm-selectionLayer` is z-index 2) so a cross-line selection's
  // shadow never paints over the bullet — the highlight stays on the text.
  '.cm-md-bullet': {
    color: 'var(--md-list)',
    fontWeight: '700',
    position: 'relative',
    zIndex: '3',
  },

  // v4.7.1 — `---` / `***` / `___` rendered as a real rule off-line. The
  // widget replaces the whole marker run, so make it span the text column.
  '.cm-md-hr': {
    display: 'inline-block',
    width: '100%',
    height: '0',
    margin: '0.2em 0',
    border: 'none',
    borderTop: '1px solid var(--border)',
    verticalAlign: 'middle',
  },

  '.cm-md-quote-line': {
    color: 'var(--md-quote)',
    fontStyle: 'italic',
    backgroundColor: 'var(--bg-elev, transparent)',
    border: 'none',
    padding: '0.12em 0em 0.12em 0.6em',
    borderLeft: '3px solid var(--border)',
  },

  '.cm-md-fenced-line': {
    backgroundColor: 'var(--md-code-bg)',
    fontFamily: 'var(--font-mono)',
  },

  // #82 / #44 — selection highlight inside code was invisible in live-edit.
  '.cm-selectionLayer': { zIndex: '2 !important' },
  '.cm-selectionBackground': {
    backgroundColor: 'rgba(255,159,64,0.45) !important',
  },
});

/**
 * Bundle for the v2.3 "live edit" view mode. Wire into Editor.vue as the
 * rich-extensions value when `viewMode === 'liveEdit'` and the tab is
 * markdown.
 *
 * v3.6 (issue #44): pass the optional `blocks` extensions in to add
 * image / table live-render widgets (cm-live-blocks). The caller is
 * responsible for building those with workspace + file-path context;
 * we just splice them into the bundle so they live in the same
 * compartment as the rest of the live-edit machinery.
 */
export function liveEditExtension(blocks: any[] = []) {
  return [
    syntaxHighlighting(liveEditHighlightStyle),
    liveRenderPlugin,
    liveEditTheme,
    liveEnterExtension(),
    preciseSelection,
    ...blocks,
  ];
}

// ---------------------------------------------------------------------------
// Self-test hook (used by dev-mcp `solomd_get_editor_decorations`).
//
// We expose a tiny window-level helper that, when the editor is mounted,
// reports the current visible-range decoration counts. The Tauri webview
// can't be poked directly from MCP, so this isn't called by the MCP
// server itself — instead the MCP tool returns "look at the DOM by
// querying `.cm-md-heading-line-1` etc.". We document the class names
// there as the contract.
// ---------------------------------------------------------------------------

/**
 * Stable list of class names this extension emits, exported so the dev-mcp
 * `solomd_get_editor_decorations` tool (and any future automated tests)
 * can assert on them.
 */
export const LIVE_EDIT_CLASSES = [
  'cm-md-heading-line-1',
  'cm-md-heading-line-2',
  'cm-md-heading-line-3',
  'cm-md-heading-line-4',
  'cm-md-heading-line-5',
  'cm-md-heading-line-6',
  'cm-md-strong',
  'cm-md-em',
  'cm-md-strike',
  'cm-md-code',
  'cm-md-link',
  'cm-md-quote-line',
  'cm-md-fenced-line',
  'cm-md-bullet',
  'cm-md-hr',
  // Paragraph blank-line folding (v4.x) — see addParagraphSpacing().
  'cm-md-blank-hidden',
  'cm-md-blank-kept',
  'cm-md-para-gap',
  'cm-md-para-inline',
] as const;
