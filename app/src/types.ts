export type Language = 'markdown' | 'plaintext';
// View modes for the editor.
//
// `code`     — pure source editing, no rendering (notepad style)
// `liveEdit` — WYSIWYG inline rendering (Typora / Obsidian style). **Default.**
// `split`    — editor + preview side-by-side with bidirectional scroll sync.
// `preview`  — full-pane read-only rendered preview.
export type ViewMode = 'code' | 'liveEdit' | 'split' | 'preview';

/** Tab info — one open document. */
export interface TabInfo {
  id: string;
  path: string | null;
  fileName: string;
  content: string;
  savedContent: string;
  encoding: string;
  language: Language;
}

export type Theme =
  | 'light'
  | 'dark'
  | 'nord'
  | 'solarized-light'
  | 'solarized-dark'
  | 'monokai'
  | 'github-light'
  | 'dracula';

export interface Tab {
  id: string;
  filePath?: string;
  fileName: string;
  content: string;
  savedContent: string;
  encoding: string;
  language: Language;
  hadBom: boolean;
  // Line-ending of the file on disk. CodeMirror normalizes everything to
  // LF internally, so we track the original here and re-apply on save —
  // otherwise a Windows file (CRLF) would silently become LF the moment
  // the user touches the editor (and the dirty flag would lock in even
  // without edits because content drifts from savedContent).
  lineEnding?: 'lf' | 'crlf';
  showOutline?: boolean;
}

export interface FileReadResult {
  content: string;
  encoding: string;
  language: Language;
  had_bom: boolean;
}

// ---- Tile layout (split editor) ----

export type SplitDirection = 'horizontal' | 'vertical';

export interface TileLeaf {
  type: 'leaf';
  id: string;
  activeTabId: string;
}

export interface TileBranch {
  type: 'branch';
  id: string;
  direction: SplitDirection;
  sizes: [number, number]; // percentages summing to 100
  children: [TileNode, TileNode];
}

export type TileNode = TileLeaf | TileBranch;
