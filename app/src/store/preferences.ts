// 偏好设置 store —— 字段与默认值对齐 marktext store/preferences.ts（约 60 个字段），
// 持久化走 Tauri 命令：invoke('set_settings') 写入、invoke('get_settings') 读取。
// Rust 端 Settings 结构是 marktext 字段的子集（snake_case），在边界处做映射。
import { create } from 'zustand'
import { invoke } from '@tauri-apps/api/core'
import { setLanguage } from '../i18n'

// ---------- 有限取值联合类型（与 marktext 一致） ----------
export type EndOfLine = 'default' | 'lf' | 'crlf'
export type TitleBarStyle = 'custom' | 'native'
export type StartUpAction = 'restoreAll' | 'lastSession' | 'blank'
export type TextDirection = 'ltr' | 'rtl'
export type BulletListMarker = '*' | '+' | '-'
export type OrderListDelimiter = '.' | ')'
export type PreferHeadingStyle = 'atx' | 'setext'
export type FrontmatterType = '-' | ';' | '{' | '+'
export type SequenceTheme = 'hand' | 'simple'
export type ImageInsertAction = 'folder' | 'path' | 'upload'
export type ImageRelativeDirectoryBase = 'file' | 'root'
export type EditorBackgroundPosition = 'top-left' | 'top' | 'top-right' | 'left' | 'center' | 'right' | 'bottom-left' | 'bottom' | 'bottom-right'
export type EditorBackgroundFit = 'cover' | 'contain' | 'stretch' | 'tile'

export interface PreferencesState {
  // ----- General -----
  autoSave: boolean
  autoSaveDelay: number
  titleBarStyle: TitleBarStyle | string
  openFilesInNewWindow: boolean
  openFolderInNewWindow: boolean
  zoom: number
  hideScrollbar: boolean
  wordWrapInToc: boolean
  fileSortBy: string
  fileSortOrder: string
  startUpAction: StartUpAction | string
  restoreLayoutState: boolean
  defaultDirectoryToOpen: string
  lastOpenedFolder: string
  treePathExcludePatterns: string[]
  language: string

  // ----- Editor / typography -----
  editorFontFamily: string
  fontSize: number
  lineHeight: number
  codeFontSize: number
  codeFontFamily: string
  codeBlockLineNumbers: boolean
  trimUnnecessaryCodeBlockEmptyLines: boolean
  wrapCodeBlocks: boolean
  editorLineWidth: string

  // ----- Markdown editing -----
  autoPairBracket: boolean
  autoPairMarkdownSyntax: boolean
  autoPairQuote: boolean
  endOfLine: EndOfLine | string
  defaultEncoding: string
  autoGuessEncoding: boolean
  autoNormalizeLineEndings: boolean
  trimTrailingNewline: number
  textDirection: TextDirection | string
  hideQuickInsertHint: boolean
  imageInsertAction: ImageInsertAction | string
  imagePreferRelativeDirectory: boolean
  imageRelativeDirectoryBase: ImageRelativeDirectoryBase | string
  imageRelativeDirectoryName: string
  hideLinkPopup: boolean
  autoCheck: boolean
  preferLooseListItem: boolean
  bulletListMarker: BulletListMarker | string
  orderListDelimiter: OrderListDelimiter | string
  preferHeadingStyle: PreferHeadingStyle | string
  tabSize: number
  listIndentation: number
  frontmatterType: FrontmatterType | string
  superSubScript: boolean
  footnote: boolean
  isHtmlEnabled: boolean
  isGitlabCompatibilityEnabled: boolean
  sequenceTheme: SequenceTheme | string
  plantumlServer: string

  // ----- Theme -----
  theme: string
  followSystemTheme: boolean
  lightModeTheme: string
  darkModeTheme: string
  customCss: string
  editorBackgroundImage: string
  editorBackgroundPosition: EditorBackgroundPosition
  editorBackgroundFit: EditorBackgroundFit
  editorBackgroundOpacity: number

  // ----- Spellchecker -----
  spellcheckerEnabled: boolean
  spellcheckerNoUnderline: boolean
  spellcheckerLanguage: string

  // ----- Side bar / tab bar visibility -----
  sideBarVisibility: boolean
  tabBarVisibility: boolean
  sourceCodeModeEnabled: boolean
  openedFilesInSidebar: boolean

  // ----- Search -----
  searchExclusions: string[]
  searchMaxFileSize: string
  searchIncludeHidden: boolean
  searchNoIgnore: boolean
  searchFollowSymlinks: boolean

  watcherUsePolling: boolean

  // ----- Edit modes（每窗口，不持久化） -----
  typewriter: boolean
  focus: boolean
  sourceCode: boolean

  // ----- User config -----
  imageFolderPath: string
  webImages: unknown[]
  cloudImages: unknown[]
  currentUploader: string
  cliScript: string
}

export interface ModeTogglePayload {
  type: keyof PreferencesState | 'typewriter' | 'focus' | 'sourceCode'
  checked: boolean
}

const DEFAULT_STATE: PreferencesState = {
  autoSave: false,
  autoSaveDelay: 5000,
  titleBarStyle: 'native',
  openFilesInNewWindow: false,
  openFolderInNewWindow: false,
  zoom: 1.0,
  hideScrollbar: false,
  wordWrapInToc: false,
  fileSortBy: 'created',
  fileSortOrder: 'asc',
  startUpAction: 'restoreAll',
  restoreLayoutState: true,
  defaultDirectoryToOpen: '',
  lastOpenedFolder: '',
  treePathExcludePatterns: [],
  language: 'en',

  editorFontFamily: 'Open Sans',
  fontSize: 16,
  lineHeight: 1.6,
  codeFontSize: 14,
  codeFontFamily: 'DejaVu Sans Mono',
  codeBlockLineNumbers: false,
  trimUnnecessaryCodeBlockEmptyLines: true,
  wrapCodeBlocks: false,
  editorLineWidth: '',

  autoPairBracket: true,
  autoPairMarkdownSyntax: true,
  autoPairQuote: true,
  endOfLine: 'default',
  defaultEncoding: 'utf8',
  autoGuessEncoding: true,
  autoNormalizeLineEndings: false,
  trimTrailingNewline: 2,
  textDirection: 'ltr',
  hideQuickInsertHint: false,
  imageInsertAction: 'folder',
  imagePreferRelativeDirectory: false,
  imageRelativeDirectoryBase: 'file',
  imageRelativeDirectoryName: 'assets',
  hideLinkPopup: false,
  autoCheck: false,

  preferLooseListItem: true,
  bulletListMarker: '-',
  orderListDelimiter: '.',
  preferHeadingStyle: 'atx',
  tabSize: 4,
  listIndentation: 1,
  frontmatterType: '-',
  superSubScript: false,
  footnote: false,
  isHtmlEnabled: true,
  isGitlabCompatibilityEnabled: false,
  sequenceTheme: 'hand',
  plantumlServer: 'https://www.plantuml.com/plantuml',

  theme: 'light',
  followSystemTheme: true,
  lightModeTheme: 'light',
  darkModeTheme: 'dark',
  customCss: '',
  editorBackgroundImage: '',
  editorBackgroundPosition: 'center',
  editorBackgroundFit: 'cover',
  editorBackgroundOpacity: 0.2,

  spellcheckerEnabled: false,
  spellcheckerNoUnderline: false,
  spellcheckerLanguage: 'en-US',

  sideBarVisibility: false,
  tabBarVisibility: false,
  sourceCodeModeEnabled: false,
  openedFilesInSidebar: true,

  searchExclusions: [],
  searchMaxFileSize: '',
  searchIncludeHidden: false,
  searchNoIgnore: false,
  searchFollowSymlinks: true,

  watcherUsePolling: false,

  // 编辑模式（窗口级，非持久化设置）
  typewriter: false,
  focus: false,
  sourceCode: false,

  // 用户配置
  imageFolderPath: '',
  webImages: [],
  cloudImages: [],
  currentUploader: 'picgo',
  cliScript: ''
}

// ---------- 与 Rust Settings 结构（snake_case）的双向映射 ----------
// Rust 端 Settings 只含 8 个字段；其余 marktext 字段暂不落盘，仅在内存维护。

const RUST_SETTINGS_MAP: Record<string, keyof PreferencesState> = {
  theme: 'theme',
  font_size: 'fontSize',
  line_height: 'lineHeight',
  code_font_size: 'codeFontSize',
  tab_size: 'tabSize',
  auto_save: 'autoSave',
  show_file_tree: 'sideBarVisibility',
  last_workspace: 'lastOpenedFolder',
  editor_background_image: 'editorBackgroundImage',
  editor_background_position: 'editorBackgroundPosition',
  editor_background_fit: 'editorBackgroundFit',
  editor_background_opacity: 'editorBackgroundOpacity'
}

const fromRustSettings = (rust: Record<string, unknown>): Partial<PreferencesState> => {
  const prefs: Partial<PreferencesState> = {}
  for (const [rustKey, prefKey] of Object.entries(RUST_SETTINGS_MAP)) {
    if (rust[rustKey] !== undefined) {
      ;(prefs as Record<string, unknown>)[prefKey] = rust[rustKey]
    }
  }
  return prefs
}

const toRustSettings = (p: PreferencesState): Record<string, unknown> => {
  const out: Record<string, unknown> = {}
  for (const [rustKey, prefKey] of Object.entries(RUST_SETTINGS_MAP)) {
    out[rustKey] = (p as unknown as Record<string, unknown>)[prefKey]
  }
  return out
}

/** 先读当前磁盘设置再合并写入，避免 set_settings 覆盖掉未映射字段（如 last_workspace） */
const persistSettings = async (next: PreferencesState): Promise<void> => {
  try {
    const current = (await invoke<Record<string, unknown>>('get_settings')) ?? {}
    await invoke('set_settings', { settings: { ...current, ...toRustSettings(next) } })
  } catch (err) {
    console.error('[preferences] set_settings 持久化失败:', err)
  }
}

interface PreferencesStateShape extends PreferencesState {
  SET_SINGLE_PREFERENCE: (key: keyof PreferencesState, value: unknown) => void
  SET_USER_PREFERENCE: (preference: Partial<PreferencesState> | Record<string, unknown>) => void
  SET_MODE: (payload: ModeTogglePayload) => void
  TOGGLE_VIEW_MODE: (entryName: keyof PreferencesState | string) => void
  ASK_FOR_USER_PREFERENCE: () => Promise<void>
}

export const usePreferencesStore = create<PreferencesStateShape>((set, get) => ({
  ...DEFAULT_STATE,

  /** 设置单项偏好：本地更新 + 语言联动 + invoke('set_settings') 持久化 */
  SET_SINGLE_PREFERENCE: (key, value) => {
    const next = { ...get(), [key]: value } as unknown as PreferencesState
    set({ [key]: value } as unknown as Partial<PreferencesState>)

    // 语言变更联动 i18n
    if (key === 'language' && typeof value === 'string') {
      void setLanguage(value)
    }

    void persistSettings(next)
  },

  /** 批量合并偏好（来自 get_settings / 后端推送） */
  SET_USER_PREFERENCE: (preference) => {
    const oldLanguage = get().language
    const next: Partial<PreferencesState> = {}

    Object.keys(preference).forEach((key) => {
      const incoming = (preference as Record<string, unknown>)[key]
      const self = get() as unknown as Record<string, unknown>
      if (typeof incoming !== 'undefined' && typeof self[key] !== 'undefined') {
        ;(next as Record<string, unknown>)[key] = incoming
      }
    })

    set(next)

    const lang = (preference as { language?: string }).language
    if (lang && lang !== oldLanguage) {
      void setLanguage(lang)
    }
  },

  /** 编辑模式开关（typewriter / focus / sourceCode），仅内存态 */
  SET_MODE: ({ type, checked }) => {
    set({ [type]: checked } as unknown as Partial<PreferencesState>)
  },

  TOGGLE_VIEW_MODE: (entryName) => {
    const self = get() as unknown as Record<string, unknown>
    set({ [entryName]: !self[entryName] } as unknown as Partial<PreferencesState>)
  },

  /** 从后端读取已持久化设置并合并进本地状态（snake_case → camelCase 映射） */
  ASK_FOR_USER_PREFERENCE: async () => {
    try {
      const rust = (await invoke<Record<string, unknown>>('get_settings')) ?? {}
      const preference = fromRustSettings(rust)
      get().SET_USER_PREFERENCE(preference)
      await setLanguage(preference.language ?? get().language)
    } catch (err) {
      console.error('[preferences] get_settings 读取失败:', err)
    }
  }
}))
