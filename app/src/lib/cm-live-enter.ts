/**
 * cm-live-enter.ts — Live-edit Enter handling (simplified v5).
 *
 * Every key follows ONE consistent rule based only on the caret line:
 *
 * ── CONTENT BLOCK MARKER LINE (prefix exists, rest has text) ──
 *   Enter       → split at caret, carry marker: `> a|b` → `> a` ⏎ `> b`
 *   Shift-Enter → keep quote marker: `> a` → `> a` ⏎ `> ` (list: plain \n)
 *   Backspace / Delete → default CM6
 *
 * ── EMPTY BLOCK MARKER LINE (prefix exists, rest is whitespace) ──
 *   Enter / Shift-Enter → EXIT block: clear markers, leave 1 plain blank
 *   Backspace / Delete → default CM6
 *
 * ── PLAIN TEXT ──
 *   Enter / Shift-Enter → insert one `\n`.  Paragraph spacing handles visuals.
 *   Backspace / Delete → default CM6
 *
 * ── INSIDE FENCED CODE ──
 *   All keys → default CM6
 *
 * The old odd-gap guarantee, blank-run-collapse Backspace/Delete hacks,
 * and soft-enter state tracking are REMOVED — they produced unpredictable
 * behaviour depending on user speed and document state.
 */

import { keymap, EditorView } from '@codemirror/view';
import { Prec, type Text } from '@codemirror/state';

// One block-marker token at the start of a line (standard Markdown: marker
// MUST be followed by a space or end-of-line).
//   - `> `                  (blockquote — `>` MUST be followed by whitespace;
//                            bare `>` alone is NOT a quote, see #enter-rule)
//   - `- ` / `* ` / `+ `    (unordered list)
//   - `1. ` / `1) `         (ordered list)
//   - `- [ ] ` / `- [x] `   (task list; ordered variants too)
//
// Bare `>abc` (no space after `>`) and a lone `>` at end-of-line are NOT
// blockquote markers — they render as plain text (see markdown.ts
// `escapeBareQuoteMarkers`) and must NOT auto-continue on Enter.
const BLOCK_TOKEN_RE = /^(?:> |(?:[-*+]|\d+[.)])(?: \[[ xX]\])?[ \t]+)/;

/**
 * Leading block-marker sequence of a line (nested markers accumulate), or
 * null when the line has no marker. Examples:
 *   `> a` → `> `    `> > a` → `> > `   `- item` → `- `
 *   `1. a` → `1. `  `- [ ] t` → `- [ ] `  `> - a` → `> - `
 *   `abc` → null    `---` → null        `1.2.3` → null
 * Pure — unit-tested.
 */
export function getBlockPrefix(text: string): string | null {
  let prefix = '';
  let rest = text;
  while (rest) {
    const m = BLOCK_TOKEN_RE.exec(rest);
    if (!m) break;
    prefix += m[0];
    rest = rest.slice(m[0].length);
  }
  return prefix.length > 0 ? prefix : null;
}

/** Increment the last ordered-list number in a marker prefix (`1. ` → `2. `,
 *  `> 3) ` → `> 4) `, `3. [ ] ` → `4. [ ] `); non-ordered prefixes pass
 *  through unchanged. */
export function incrementLastNumber(prefix: string): string {
  return prefix.replace(
    /(\d+)(?=[.)][ \t]*(?:\[[ xX]\])?[ \t]*$)/,
    (m) => String(parseInt(m, 10) + 1),
  );
}

export interface BlockEnterResult {
  changes: { from: number; to?: number; insert: string }[];
  caret: number;
}

/**
 * Block-marker Enter continuation at `pos` (single caret). Returns null when
 * the line has no block marker (caller falls back to the normal paragraph
 * split). Otherwise:
 *   - empty marker line (`> `)     → EXIT the block: clear the `> ` markers
 *     from the current line AND every consecutive empty-marker line above
 *     it, turning the whole run into plain blank lines (no more `> `).
 *     Cursor lands at the end of the run (last blank line).
 *   - content line, any position   → split the line at the caret and
 *     carry the marker forward on the new line:
 *       `> a|b` → `> a` ⏎ `> b`  (caret after `> ` on the new line)
 *       `> a` at end → `> a` ⏎ `> `  (caret on the new empty marker)
 *     Task markers reset to `[ ]`, ordered numbers increment on the
 *     content line only.
 * Pure — unit-tested.
 */
export function computeBlockEnter(doc: Text, pos: number): BlockEnterResult | null {
  const line = doc.lineAt(pos);
  const prefix = getBlockPrefix(line.text);
  if (prefix === null) return null;

  const rest = line.text.slice(prefix.length);
  if (rest.trim() === '') {
    // Empty marker line → EXIT the block. Clear markers from the full
    // empty-marker run (above + below).
    let runStart = line.number;
    while (runStart > 1) {
      const above = doc.line(runStart - 1);
      const p = getBlockPrefix(above.text);
      if (p === null) break;
      if (above.text.slice(p.length).trim() !== '') break;
      runStart--;
    }
    let runEnd = line.number;
    while (runEnd < doc.lines) {
      const below = doc.line(runEnd + 1);
      const p2 = getBlockPrefix(below.text);
      if (p2 === null) break;
      if (below.text.slice(p2.length).trim() !== '') break;
      runEnd++;
    }
    const from = doc.line(runStart).from;
    const lastLine = doc.line(runEnd);
    let to = lastLine.to + 1;
    if (to > doc.length) to = doc.length;
    const cleared = doc
      .sliceString(from, to)
      .split('\n')
      .map((l) => {
        const p = getBlockPrefix(l);
        return p !== null ? l.slice(p.length) : l;
      })
      .join('\n');
    return { changes: [{ from, to, insert: cleared }], caret: from + cleared.length };
  }

  // Content line: split at caret, carry the marker forward on the new line.
  // A SINGLE change to avoid CM6 parallel-apply issues: delete from caret to
  // end-of-line and insert `\n` + prefix + rest-of-line-text in one shot.
  let nextPrefix = prefix;
  if (/\[[ xX]\]/.test(nextPrefix)) nextPrefix = nextPrefix.replace(/\[[ xX]\]/, '[ ]');
  nextPrefix = incrementLastNumber(nextPrefix);

  const afterOnLine = line.text.slice(pos - line.from);
  // If the cursor is AFTER the prefix, strip the prefix so we don't duplicate it.
  const afterText = afterOnLine.startsWith(prefix)
    ? afterOnLine.slice(prefix.length)
    : afterOnLine;

  const insert = '\n' + nextPrefix + afterText;
  const delTo = line.to; // delete from caret to end of line
  return {
    changes: [{ from: pos, to: delTo, insert }],
    caret: pos + 1 + nextPrefix.length, // after `\n` + prefix
  };
}

/** True when `pos` sits inside a fenced/indented code block. */
export function inCodeBlock(state: { doc: Text; languageDataAt?: unknown }, pos: number): boolean {
  const doc = state.doc;
  // Cheap line-level check first: a code fence is a line whose trimmed text
  // starts with ``` or ~~~ (markdown fences). If the caret is between an
  // opening and closing fence, it's inside code.
  let openFence: string | null = null;
  const n = doc.lineAt(pos).number;
  for (let ln = 1; ln <= n; ln++) {
    const t = doc.line(ln).text.trim();
    if (t.startsWith('```') || t.startsWith('~~~')) {
      // Opening fence (has info string after the fence) vs closing.
      const isFence = /^(`{3,}|~{3,})/.test(t);
      if (!isFence) continue;
      const fence = t.match(/^(```+|~~~+)/)?.[0] ?? '';
      if (openFence === null) {
        openFence = fence;
      } else if (fence === openFence) {
        openFence = null; // closed
      }
    }
  }
  return openFence !== null;
}

// ── Soft-enter state ───────────────────────────────────────────────────────
let lastWasSoftEnter = false;

// ── Unified Enter / Shift-Enter handlers ────────────────────────────────────

function handleEnter(view: EditorView): boolean {
  return insertNewline(view, false);
}

function handleSoftEnter(view: EditorView): boolean {
  return insertNewline(view, true);
}

function insertNewline(view: EditorView, soft: boolean): boolean {
  let state = view.state;
  let sel = state.selection.main;

  if (sel.from !== sel.to) {
    view.dispatch({ changes: { from: sel.from, to: sel.to, insert: '' }, selection: { anchor: sel.from } });
    state = view.state; sel = state.selection.main;
  }

  const pos = sel.anchor;

  if (inCodeBlock(state, pos)) {
    view.dispatch(state.update(state.replaceSelection('\n')));
    return true;
  }

  const line = state.doc.lineAt(pos);
  const prefix = getBlockPrefix(line.text);

  if (prefix) {
    // ── Block marker line ────────────────────────────────────────────────
    const rest = line.text.slice(prefix.length);

    if (rest.trim() === '') {
      // Empty marker → EXIT the block.  Clear markers from the full
      // empty-marker run (above + below).
      let runStart = line.number;
      while (runStart > 1) {
        const above = state.doc.line(runStart - 1);
        const p = getBlockPrefix(above.text);
        if (p === null) break;
        if (above.text.slice(p.length).trim() !== '') break;
        runStart--;
      }
      let runEnd = line.number;
      while (runEnd < state.doc.lines) {
        const below = state.doc.line(runEnd + 1);
        const p2 = getBlockPrefix(below.text);
        if (p2 === null) break;
        if (below.text.slice(p2.length).trim() !== '') break;
        runEnd++;
      }
      const from = state.doc.line(runStart).from;
      const lastLine = state.doc.line(runEnd);
      let to = lastLine.to + 1;
      if (to > state.doc.length) to = state.doc.length;
      const cleared = state.doc
        .sliceString(from, to).split('\n')
        .map((l) => { const p = getBlockPrefix(l); return p !== null ? l.slice(p.length) : l; })
        .join('\n');
      view.dispatch({ changes: [{ from, to, insert: cleared }], selection: { anchor: from + cleared.length } });
      lastWasSoftEnter = false;
      return true;
    }

    if (soft) {
      lastWasSoftEnter = true;
      if (prefix.startsWith('>')) {
        const ins = '\n' + prefix;
        view.dispatch({ changes: { from: pos, to: pos, insert: ins }, selection: { anchor: pos + ins.length } });
      } else {
        view.dispatch(state.update(state.replaceSelection('\n')));
      }
      return true;
    }

    let nextPrefix = prefix;
    if (/\[[ xX]\]/.test(nextPrefix)) nextPrefix = nextPrefix.replace(/\[[ xX]\]/, '[ ]');
    nextPrefix = incrementLastNumber(nextPrefix);
    const afterOnLine = line.text.slice(pos - line.from);
    const afterText = afterOnLine.startsWith(prefix) ? afterOnLine.slice(prefix.length) : afterOnLine;

    const atEnd = pos === line.from + line.length && afterText.length === 0;
    if (atEnd) {
      // End of line: paragraph split.  Two empty marker lines so the
      // folding logic hides the first (odd pos) and keeps the second
      // (even pos) → a visible paragraph gap.  Cursor lands at the
      // START of the SECOND empty marker (the one that stays visible).
      // `> AAA` + Enter → `> AAA` ⏎ `> ` ⏎ `> |`
      const ins = '\n' + prefix + '\n' + nextPrefix;
      view.dispatch({ changes: { from: pos, to: pos, insert: ins }, selection: { anchor: pos + 2 + prefix.length } });
    } else {
      // Mid-line split: `> A|BC` → `> A` ⏎ `> BC`
      const ins = '\n' + nextPrefix + afterText;
      view.dispatch({ changes: { from: pos, to: line.to, insert: ins }, selection: { anchor: pos + 1 + nextPrefix.length } });
    }
    lastWasSoftEnter = false;
    return true;
  }

  // ── Plain text ──────────────────────────────────────────────────────────
  if (soft) { lastWasSoftEnter = true; view.dispatch(state.update(state.replaceSelection('\n'))); return true; }

  // Shift+Enter then Enter → single \n (README req #2).
  if (lastWasSoftEnter) { lastWasSoftEnter = false; view.dispatch(state.update(state.replaceSelection('\n'))); return true; }

  // Paragraph split: `\n\n` — two newlines, cursor on the middle blank.
  // Folding compacts both to zero-height; the content line above gets
  // `cm-md-para-gap` padding as the visual gap.
  view.dispatch({ changes: { from: pos, to: pos, insert: '\n\n' }, selection: { anchor: pos + 2 } });
  lastWasSoftEnter = false;
  return true;
}

// ── Keymap ──────────────────────────────────────────────────────────────────

/**
 * Wire into the liveEdit extension bundle.  `Prec.highest` ensures our
 * Enter/Shift-Enter run before `insertNewlineAndIndent` from defaultKeymap
 * and `insertNewlineContinueMarkup` from @codemirror/lang-markdown.
 * Backspace/Delete are NOT bound: default CM6 behaviour joins lines, then
 * the paragraph-spacing folding re-compacts them — simple and predictable.
 */
export function liveEnterExtension() {
  return [
    Prec.highest(
      keymap.of([
        { key: 'Enter', run: handleEnter, preventDefault: true },
        { key: 'Shift-Enter', run: handleSoftEnter, preventDefault: true },
      ]),
    ),
    EditorView.domEventHandlers({
      keydown(e) { if (e.key !== 'Enter') lastWasSoftEnter = false; return false; },
    }),
  ];
}
