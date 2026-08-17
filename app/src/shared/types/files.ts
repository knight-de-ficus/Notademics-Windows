// 前后端共享类型 —— 对齐 marktext 的 shared/types，适配 Tauri 命令。

export type LineEnding = 'lf' | 'crlf'

export type ExportType = 'pdf' | 'html' | 'styledHtml' | 'png' | 'jpeg'

export interface SerializedStat {
  size: number
  mtimeMs: number
  isFile: boolean
  isDirectory: boolean
  isSymbolicLink?: boolean
}

export interface MarkdownDocument {
  markdown: string
  filename: string
  pathname: string | null
  encoding?: string
  lineEnding?: LineEnding
  adjustLineEndingOnSave?: boolean
  trimTrailingNewline?: number
  isMixedLineEndings?: boolean
}

export interface FileEncoding {
  encoding: string
  isBom: boolean
}

export interface FileWordCount {
  paragraph: number
  word: number
  character: number
  all: number
}

export interface FileSearchMatches {
  index: number
  matches: unknown[]
  value: string
}

export interface FileHistory {
  stack: HistoryStackEntry[]
  index: number
  lastEditIndex?: number
  lastInitIndex?: number
}

export interface HistoryStackEntry {
  id: number | string
  [key: string]: unknown
}

/** 单标签页状态 —— 与 marktext IFileState 形状一致 */
export interface IFileState {
  id: string
  filename: string
  pathname: string
  markdown: string
  isSaved: boolean
  encoding: FileEncoding
  lineEnding: LineEnding | string
  adjustLineEndingOnSave: boolean
  trimTrailingNewline: number
  history: FileHistory
  cursor: unknown
  wordCount: FileWordCount
  searchMatches: FileSearchMatches
  scrollTop: number
  muyaIndexCursor: unknown
  notifications: FileNotification[]
  lastSavedHistoryId?: number
  blocks?: unknown
  isMixedLineEndings?: boolean
}

export interface FileNotification {
  msg: string
  showConfirm: boolean
  style: string
  exclusiveType: string
  action: (status?: unknown) => void
}

export type ITab = IFileState

export interface FileChangeDetail {
  pathname: string
  type?: string
  [key: string]: unknown
}

export interface TabOptions {
  selected?: boolean
  [key: string]: unknown
}

export interface SaveOptions {
  encoding?: FileEncoding | string
  lineEnding?: LineEnding | string
  adjustLineEndingOnSave?: boolean
  trimTrailingNewline?: number
}

export interface BootstrapEditorConfig {
  isNewWindow?: boolean
  addBlankTab?: boolean
  markdownList: string[]
  lineEnding: LineEnding
  sideBarVisibility: boolean
  tabBarVisibility: boolean
  sourceCodeModeEnabled: boolean
  preferences?: unknown
  userKeybindings?: unknown
  recentlyUsedFiles?: string[]
  windowId?: number
  [key: string]: unknown
}

export interface BootInfo {
  platform: string
  arch: string
  versions: Record<string, string>
  env: Record<string, string>
  paths: {
    resources: string
    userData: string
    cwd: string
    ripgrepBinary: string
  }
  MARKDOWN_INCLUSIONS: string[]
}
