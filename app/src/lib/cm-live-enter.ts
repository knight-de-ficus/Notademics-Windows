/**
 * cm-live-enter.ts — Live-edit Enter handling.
 *
 * In live-edit mode Enter does NOT just insert "\n". It keeps the document
 * in "canonical Markdown paragraph shape": any two paragraphs (an empty
 * line run counts as paragraphs at positions 2, 4, 6, …) must be separated
 * by an ODD number of blank lines, so the `blank-line ↔ paragraph`
 * alternation always holds.
 *
 * Enter algorithm (single caret; a multi-line selection is deleted first):
 *   1. Basic split — insert TWO newlines before the caret; if there is
 *      following content (rest of the current line, or another line after
 *      it), insert ONE newline after the caret too. The caret lands on the
 *      middle blank line (the new empty paragraph waiting for input).
 *        - mid-line `abc|def`          → `abc` ⏎ ⏎ ⏎ `def` (3 blanks)
 *        - end-of-line, no following   → `abc` ⏎ ⏎ (1 blank)
 *        - end-of-line, text follows   → `abc` ⏎ ⏎ ⏎ `next` (3 blanks)
 *   2. Odd-gap guarantee — locate the nearest non-blank line above (U) and
 *      below (D) the caret. If the number of blank lines between U and D is
 *      EVEN, insert one more "\n" right after the caret.
 *
 * Shift+Enter inserts a single "\n" (soft break). Enter pressed immediately
 * after a Shift+Enter also inserts just one "\n" (the next hard-break
 * intent), but the odd-gap guarantee still runs.
 *
 * Block-marker continuation: when the caret line carries a block marker
 * (blockquote `>`, unordered `-`/`*`/`+`, ordered `1.`, task `- [ ]`),
 * Enter CONTINUES the marker instead of splitting into an empty paragraph
 * (splitting would break the block — the exact bug this fixes):
 *
 *   - content line, end-of-line  `> a`        → `> a` ⏎ `> `  (marker kept)
 *   - content line, mid-line     `> ab|c`     → `> ab` ⏎ `> c`
 *   - ordered list               `1. item`    → `1. item` ⏎ `2. ` (increments)
 *   - task list                  `- [x] a`    → `- [x] a` ⏎ `- [ ] ` (reset)
 *   - empty marker line          `> ` ⏎ Enter → exits the block: new line has
 *     no marker (back to normal paragraph behaviour)
 *   - inside a fenced code block → default behaviour (single "\n"), markers
 *     never continued there
 */

import { keymap, EditorView } from '@codemirror/view';
import { Prec, type Text } from '@codemirror/state';

// True right after a Shift+Enter, so the very next plain Enter only inserts
// one newline instead of performing the full paragraph split. Cleared on
// any other keydown and by Enter itself.
let lastWasSoftEnter = false;

/** Structural blank line: empty/whitespace-only, or a quote-only line
 *  (`> ` — the `>` MUST be followed by whitespace to count; a bare `>`
 *  at end-of-line is NOT a blockquote, matching the renderer rule). */
export function isStructuralBlank(text: string): boolean {
  return /^\s*$/.test(text) || /^\s*>\s+$/.test(text);
}

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
 *   - content line, any position   → full paragraph split WITH markers:
 *     `> a|b` → `> a` ⏎ `> ` ⏎ `> b`  (empty marker paragraph in the middle).
 *     Task markers reset to `[ ]`, ordered numbers increment on the content
 *     line only. Cursor on the blank marker line.
 * Pure — unit-tested.
 */
export function computeBlockEnter(doc: Text, pos: number): BlockEnterResult | null {
  const line = doc.lineAt(pos);
  const prefix = getBlockPrefix(line.text);
  if (prefix === null) return null;

  const rest = line.text.slice(prefix.length);
  if (rest.trim() === '') {
    // Empty marker line → EXIT the block. Instead of just inserting a "\n"
    // (which leaves the old `> ` line AND a fresh blank line — i.e. "keep
    // typing on two more blank lines"), clear the `> ` marker from the
    // current line and every consecutive empty-marker line above it, so the
    // whole run becomes plain blank lines and no further `> ` appears:
    //   > a
    //   >        ← Enter here
    //   > |      ← caret here
    // becomes
    //   > a
    //            ← plain blank lines (no more `> `), caret on the last one
    let runStart = line.number;
    while (runStart > 1) {
      const above = doc.line(runStart - 1);
      const p = getBlockPrefix(above.text);
      if (p === null) break;
      if (above.text.slice(p.length).trim() !== '') break;
      runStart--;
    }
    const from = doc.line(runStart).from;
    const lastLine = doc.line(line.number);
    // Cross the newline that ends the last marker line, clamped to the doc
    // end (the last line of the doc has no trailing newline).
    let to = lastLine.to + 1;
    if (to > doc.length) to = doc.length;
    // Strip ANY block marker (quote `>`, bullet `-`/`*`/`+`, ordered `1.`,
    // task `- [ ]`) — not just the quote marker. A bare `.replace(/^> /,'')`
    // silently did nothing for list lines, so Enter on an empty list item
    // left the document unchanged (the "nothing happens" bug).
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

  let blankPrefix = prefix;
  // Task marker always resets to unchecked.
  if (/\[[ xX]\]/.test(blankPrefix)) blankPrefix = blankPrefix.replace(/\[[ xX]\]/, '[ ]');
  const nextPrefix = incrementLastNumber(blankPrefix);
  // Full paragraph split: newline + blank marker line + newline + next marker.
  // Cursor sits at the END of the new content line (last line, after nextPrefix).
  const insert = '\n' + blankPrefix + '\n' + nextPrefix;
  const caret = pos + insert.length;
  return { changes: [{ from: pos, to: pos, insert }], caret };
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

/** Nearest content line above (dir = -1) or below (dir = 1), or null. */
export function nearestContent(doc: Text, fromLine: number, dir: 1 | -1): number | null {
  let ln = fromLine + dir;
  while (ln >= 1 && ln <= doc.lines) {
    if (!isStructuralBlank(doc.line(ln).text)) return ln;
    ln += dir;
  }
  return null;
}

export interface SplitResult {
  changes: { from: number; to?: number; insert: string }[];
  caret: number;
}

/**
 * Basic Enter split at `pos` (single caret; caller must have deleted any
 * multi-line selection already):
 *
 *   - following content (rest of the line, or a next line) → insert
 *     "\n\n\n" — the two newlines before the caret plus one after it
 *     (user rule) — and put the caret on the middle blank line.
 *   - end of document          → insert "\n\n" (the "two Enter presses"
 *     that create one blank line).
 *
 * The whole insertion is a SINGLE change: CM6 applies multiple changes in
 * one transaction against the ORIGINAL coordinates (parallel), so a second
 * change at `pos + 2` would land after the wrong character. Pure —
 * unit-tested via `npx tsx test-self.mjs`.
 */
export function computeEnterSplit(doc: Text, pos: number): SplitResult {
  const line = doc.lineAt(pos);
  const afterOnLine = line.text.slice(pos - line.from);
  const hasFollowing = afterOnLine.length > 0 || line.number < doc.lines;
  const insert = hasFollowing ? '\n\n\n' : '\n\n';
  const caret = pos + 2; // middle of the three, or after the two
  return { changes: [{ from: pos, to: pos, insert }], caret };
}

/**
 * Odd-gap guarantee after a split: if the nearest content lines above (U)
 * and below (D) the caret are separated by an EVEN number of blank lines,
 * return a change that inserts one more "\n" right after `pos`; otherwise
 * null. When there is no content line below (end of document) there are no
 * two paragraphs to balance, so nothing is inserted. Pure — unit-tested.
 */
export function computeOddGapFix(doc: Text, pos: number): { from: number; to: number; insert: string } | null {
  const cursorLine = doc.lineAt(pos).number;
  const u = nearestContent(doc, cursorLine, -1);
  if (u === null) return null; // nothing above — no paragraph pair to balance
  const d = nearestContent(doc, cursorLine, 1);
  if (d === null) return null; // nothing below — nothing to balance against
  const gap = d - u - 1; // blank lines strictly between U and D
  if (gap % 2 === 0) {
    return { from: pos, to: pos, insert: '\n' };
  }
  return null;
}

function ensureOddGap(view: EditorView, pos: number): void {
  const fix = computeOddGapFix(view.state.doc, pos);
  if (fix) {
    // Keep the caret exactly where it was (it may sit ON the insertion
    // point — the "middle blank line" — and must not slide to the next).
    view.dispatch({ changes: [fix], selection: { anchor: pos } });
  }
}

function handleEnter(view: EditorView): boolean {
  // Enter right after Shift+Enter: only a single "\n" (still odd-gap checked).
  if (lastWasSoftEnter) {
    lastWasSoftEnter = false;
    view.dispatch(view.state.update(view.state.replaceSelection('\n')));
    ensureOddGap(view, view.state.selection.main.anchor);
    return true;
  }

  let state = view.state;
  let sel = state.selection.main;

  // Multi-line selection: replace it with a single caret first, so the
  // split changes below apply against a clean single-caret document.
  if (sel.from !== sel.to) {
    view.dispatch({
      changes: { from: sel.from, to: sel.to, insert: '' },
      selection: { anchor: sel.from },
    });
    state = view.state;
    sel = state.selection.main;
  }

  const pos = sel.anchor;

  // Inside a fenced code block: default behaviour (single "\n"), markers
  // are never continued there ("代码段不影响").
  if (inCodeBlock(state, pos)) {
    view.dispatch(state.update(state.replaceSelection('\n')));
    return true;
  }

  // Block marker (quote / list / task): continue the marker instead of
  // splitting into an empty paragraph.
  const block = computeBlockEnter(state.doc, pos);
  if (block) {
    view.dispatch({ changes: block.changes, selection: { anchor: block.caret } });
    lastWasSoftEnter = false;
    return true;
  }

  const split = computeEnterSplit(state.doc, pos);
  view.dispatch({
    changes: split.changes,
    selection: { anchor: split.caret },
  });
  ensureOddGap(view, split.caret);
  lastWasSoftEnter = false;
  return true;
}

function handleSoftEnter(view: EditorView): boolean {
  lastWasSoftEnter = true;
  let state = view.state;
  let sel = state.selection.main;
  // Multi-line selection: replace with a single caret first.
  if (sel.from !== sel.to) {
    view.dispatch({
      changes: { from: sel.from, to: sel.to, insert: '' },
      selection: { anchor: sel.from },
    });
    state = view.state;
    sel = state.selection.main;
  }
  const pos = sel.anchor;
  // Blockquote Shift+Enter: a soft break that KEEPS the quote marker on the
  // new line — `> abc` + Shift+Enter → `> abc` ⏎ `> ` (caret after the `> `).
  // Nested/list-inside-quote prefixes (`> > a`, `> - a`) keep their full
  // prefix. Everything else keeps the plain single-"\n" soft break.
  const line = state.doc.lineAt(pos);
  const prefix = getBlockPrefix(line.text);
  if (prefix && prefix.startsWith('>')) {
    const insert = '\n' + prefix;
    view.dispatch({
      changes: { from: pos, to: pos, insert },
      selection: { anchor: pos + insert.length },
    });
    return true;
  }
  view.dispatch(state.update(state.replaceSelection('\n')));
  return true;
}

// ---------------------------------------------------------------------------
// Structural blank run collapse (Backspace / Delete)
// ---------------------------------------------------------------------------

/** Find the structural blank run containing `lineNo`. Returns `{ start, end }`
 *  (1-based line numbers, inclusive), or null if the line is not a structural
 *  blank. Only looks above/below — no code-block awareness (code lines aren't
 *  structural blanks anyway). Exported for unit tests. */
export function findBlankRun(doc: Text, lineNo: number): { start: number; end: number } | null {
  if (lineNo < 1 || lineNo > doc.lines) return null;
  if (!isStructuralBlank(doc.line(lineNo).text)) return null;
  let start = lineNo;
  while (start > 1 && isStructuralBlank(doc.line(start - 1).text)) start--;
  let end = lineNo;
  while (end < doc.lines && isStructuralBlank(doc.line(end + 1).text)) end++;
  return { start, end };
}

/**
 * Collapse a structural blank run to exactly 1 blank line.  `removeLine` is
 * the 1-based line number of the blank the cursor is on (will be removed
 * along with `runLen - 1` siblings). Cursor moves to the end of the
 * content line just above the (original) run.
 *
 * Because we use a SINGLE change (CM6 parallel-applies within one
 * transaction), the range to delete is:
 *   from = doc.line(start).from           (first byte of the run)
 *   to   = doc.line(start + 1).from       (first byte of the 2nd blank line)
 *     … we keep exactly ONE blank line (the first), delete the rest.
 *
 *   kept = doc.line(start)                (the sole survivor blank line)
 *   cursor goes to the end of the content line just above the run.
 */
function collapseBlankRun(view: EditorView, run: { start: number; end: number }, cursorLine: number): void {
  const doc = view.state.doc;
  const runLen = run.end - run.start + 1;
  if (runLen < 2) return;

  // Keep the first blank line of the run; delete all others.
  const keepLine = doc.line(run.start);
  const delFrom = doc.line(run.start + 1).from; // first char of 2nd blank
  // delTo must point one past the `\n` that ends the last blank line —
  // `doc.line(run.end).to` is the position of that `\n`, so +1 crosses it.
  // BUT when the run reaches the very END of the document there is no
  // trailing `\n` (the last line has no newline), so `to + 1` would exceed
  // `doc.length` and CM throws "Invalid change range". Clamp to doc.length.
  const delTo = Math.min(doc.line(run.end).to + 1, doc.length);

  // Cursor to the end of the content line just above the run (or stay at run
  // start - 1 if run starts at line 1 — can't happen in practice).
  const aboveLine = run.start > 1 ? doc.line(run.start - 1) : null;
  const caret = aboveLine ? aboveLine.from + aboveLine.length : keepLine.from;

  view.dispatch({
    changes: delTo > delFrom ? [{ from: delFrom, to: delTo, insert: '' }] : [],
    selection: { anchor: caret },
  });
}

function handleBackspace(view: EditorView): boolean {
  const sel = view.state.selection.main;
  if (sel.from !== sel.to) return false; // selection: default behaviour
  const doc = view.state.doc;
  const line = doc.lineAt(sel.anchor);

  // Only intercept when cursor is at the VERY START of a structural blank
  // line (the natural position after pressing Enter in a block).
  if (sel.anchor !== line.from) return false;

  const run = findBlankRun(doc, line.number);
  if (!run || run.end - run.start + 1 < 2) return false;

  collapseBlankRun(view, run, line.number);
  return true;
}

function handleDelete(view: EditorView): boolean {
  const sel = view.state.selection.main;
  if (sel.from !== sel.to) return false;
  const doc = view.state.doc;
  const line = doc.lineAt(sel.anchor);

  // Cursor must be at the END of its line (or the line is the last one).
  if (sel.anchor !== line.from + line.length) return false;

  // The run starts on the NEXT line.
  const nextLine = line.number + 1;
  if (nextLine > doc.lines) return false;
  const run = findBlankRun(doc, nextLine);
  if (!run || run.end - run.start + 1 < 2) return false;

  collapseBlankRun(view, run, nextLine);
  return true;
}

/**
 * Live-edit Enter/Shift-Enter keymap + the soft-enter state reset.
 * Wire into the liveEdit extension bundle only (code/split modes keep the
 * default CodeMirror behaviour).
 *
 * MUST be `Prec.highest`: CodeMirror MERGES bindings for the same key from
 * every keymap and runs them in registration order until one returns true.
 * `defaultKeymap` (registered earlier in Editor.tsx) binds Enter to
 * `insertNewlineAndIndent`, which returns true — and `@codemirror/lang-markdown`'s
 * `markdown()` ALSO injects `markdownKeymap` (`Prec.high`) whose
 * `insertNewlineContinueMarkup` continues blockquote/list markers on Enter
 * based on the lezer parse — which treats `>abc` as a valid blockquote and
 * would insert `> ` (a continuation the user does NOT want for bare `>abc`).
 * Without `highest` our handler would lose to one of those, or its behaviour
 * would silently depend on extension registration order. `highest` guarantees
 * our Enter/Shift-Enter always run first; Backspace/Delete still fall through
 * to `deleteMarkupBackward` when they return false.
 */
export function liveEnterExtension() {
  return [
    Prec.highest(
      keymap.of([
        { key: 'Enter', run: handleEnter, preventDefault: true },
        { key: 'Shift-Enter', run: handleSoftEnter, preventDefault: true },
        { key: 'Backspace', run: handleBackspace },
        { key: 'Delete', run: handleDelete },
      ]),
    ),
    EditorView.domEventHandlers({
      keydown(e) {
        if (e.key !== 'Enter') lastWasSoftEnter = false;
        return false;
      },
    }),
  ];
}
