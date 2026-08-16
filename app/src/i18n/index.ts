// 轻量 i18n 框架 —— 对齐 marktext 的 vue-i18n 机制（t / setLanguage / language-changed），
// 但不引入 vue-i18n / react-i18next，保持零依赖：
// - 文案从后端加载：invoke('i18n_load', { lang }) 返回 locales/ 下的 JSON（嵌套结构会被扁平化）
// - 内置英文 fallback 字典，加载失败或键缺失时回退
// - 通过 Tauri event 'language-changed' 感知后端语言切换
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { useCallback, useEffect, useState } from 'react'

/** 扁平化后的消息表：dotted key → 文案 */
type Messages = Record<string, string>

/**
 * 内置英文兜底字典 —— 只收录当前代码实际用到的键。
 * 键结构参考 marktext static/locales/en.json 的顶层（common / dialog / store / notifications / commands）。
 */
const FALLBACK: Messages = {
  'common.open': 'Open',
  'common.save': 'Save',
  'common.newFile': 'New File',
  'dialog.saveFailure': 'Save failure',
  'notifications.defaultTitle': 'Notification',
  'notifications.defaultMessage': 'Default message',
  'store.editor.anchorLinkCopied': 'Anchor link copied',
  'store.editor.tabNotFound': 'Tab not found',
  'store.editor.tocItemNotFound': 'Table of contents {key} not found',
  'store.editor.errorLoadingTabTitle': 'Error loading tab',
  'store.editor.errorLoadingTabMessage':
    'There was an error while loading the file changes because the tab cannot be found.',
  'store.editor.mixedLineEndingsNormalized':
    '"{name}" has mixed line endings which are automatically normalized to {lineEnding}.',
  'store.editor.errorWhileSaving': 'There was an error while saving: {msg}',
  'store.editor.fileRemovedOnDisk': '"{name}" has been removed on disk.',
  'store.editor.fileChangedOnDisk': '"{name}" has been changed on disk. Do you want to reload it?',
  // 命令描述（commands.*）—— 与 src/commands 的 getCommandDescriptionById 联动
  'commands.file.newTab': 'New Tab',
  'commands.file.newWindow': 'New Window',
  'commands.file.openFile': 'Open File',
  'commands.file.openFolder': 'Open Folder',
  'commands.file.save': 'Save',
  'commands.file.saveAs': 'Save As',
  'commands.file.moveFile': 'Move File',
  'commands.file.renameFile': 'Rename File',
  'commands.file.closeTab': 'Close Tab',
  'commands.file.closeWindow': 'Close Window',
  'commands.file.quit': 'Quit',
  'commands.file.toggleAutoSave': 'Toggle Auto Save',
  'commands.file.exportFile': 'Export File',
  'commands.file.exportFilePdf': 'Export as PDF',
  'commands.file.zoom': 'Zoom',
  'commands.file.preferences': 'Preferences',
  'commands.edit.undo': 'Undo',
  'commands.edit.redo': 'Redo',
  'commands.edit.duplicate': 'Duplicate',
  'commands.edit.createParagraph': 'Create Paragraph',
  'commands.edit.deleteParagraph': 'Delete Paragraph',
  'commands.edit.find': 'Find',
  'commands.edit.replace': 'Replace',
  'commands.edit.findInFolder': 'Find in Folder',
  'commands.paragraph.heading1': 'Heading 1',
  'commands.paragraph.heading2': 'Heading 2',
  'commands.paragraph.heading3': 'Heading 3',
  'commands.paragraph.heading4': 'Heading 4',
  'commands.paragraph.heading5': 'Heading 5',
  'commands.paragraph.heading6': 'Heading 6',
  'commands.paragraph.upgradeHeading': 'Upgrade Heading',
  'commands.paragraph.degradeHeading': 'Degrade Heading',
  'commands.paragraph.table': 'Table',
  'commands.paragraph.codeFence': 'Code Fence',
  'commands.paragraph.quoteBlock': 'Quote Block',
  'commands.paragraph.mathFormula': 'Math Formula',
  'commands.paragraph.htmlBlock': 'HTML Block',
  'commands.paragraph.orderList': 'Ordered List',
  'commands.paragraph.bulletList': 'Bullet List',
  'commands.paragraph.taskList': 'Task List',
  'commands.paragraph.looseListItem': 'Loose List Item',
  'commands.paragraph.paragraph': 'Paragraph',
  'commands.paragraph.horizontalLine': 'Horizontal Line',
  'commands.paragraph.frontMatter': 'Front Matter',
  'commands.paragraph.resetParagraph': 'Reset Paragraph',
  'commands.format.strong': 'Bold',
  'commands.format.emphasis': 'Italic',
  'commands.format.underline': 'Underline',
  'commands.format.superscript': 'Superscript',
  'commands.format.subscript': 'Subscript',
  'commands.format.highlight': 'Highlight',
  'commands.format.inlineCode': 'Inline Code',
  'commands.format.inlineMath': 'Inline Math',
  'commands.format.strike': 'Strikethrough',
  'commands.format.hyperlink': 'Hyperlink',
  'commands.format.image': 'Image',
  'commands.format.clearFormat': 'Clear Format',
  'commands.window.minimize': 'Minimize',
  'commands.window.toggleAlwaysOnTop': 'Toggle Always on Top',
  'commands.window.toggleFullScreen': 'Toggle Full Screen',
  'commands.window.changeTheme': 'Change Theme',
  'commands.view.sourceCodeMode': 'Source Code Mode',
  'commands.view.typewriterMode': 'Typewriter Mode',
  'commands.view.focusMode': 'Focus Mode',
  'commands.view.toggleSidebar': 'Toggle Sidebar',
  'commands.view.toggleTabbar': 'Toggle Tab Bar',
  'commands.view.textDirection': 'Text Direction',
  'commands.tabs.cycleForward': 'Cycle Forward',
  'commands.tabs.cycleBackward': 'Cycle Backward',
  'commands.docs.userGuide': 'User Guide',
  'commands.docs.markdownSyntax': 'Markdown Syntax'
}

/** 按语言缓存的消息表（en 兜底字典作为基底，语言包覆盖其上） */
const localeMessages: Record<string, Messages> = { en: { ...FALLBACK } }

let currentLanguage = 'en'
/** 当前生效的消息表（随 setLanguage 切换） */
let messages: Messages = { ...FALLBACK }

const listeners = new Set<(lang: string) => void>()
let listening = false

/** 把后端返回的嵌套 JSON（如 en.json 的 { menu: { file: {...} } }）扁平化为 dotted key */
const flatten = (obj: unknown, prefix = '', out: Messages = {}): Messages => {
  if (obj === null || typeof obj !== 'object') {
    if (typeof obj === 'string') out[prefix] = obj
    return out
  }
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key
    flatten(value, path, out)
  }
  return out
}

/**
 * 翻译函数：查当前语言消息表 → 英文兜底 → 原样返回 key。
 * 支持 `{name}` 占位符替换。
 */
export const t = (key: string, args?: Record<string, unknown>): string => {
  let text = messages[key] ?? FALLBACK[key] ?? key
  if (args) {
    for (const [k, v] of Object.entries(args)) {
      text = text.replaceAll(`{${k}}`, String(v))
    }
  }
  return text
}

/**
 * 切换语言：首次调用时经 invoke('i18n_load') 从资源目录 locales/ 加载 JSON，
 * 与英文兜底合并后缓存；失败则静默回退英文。
 */
export const setLanguage = async (lang: string): Promise<void> => {
  if (!lang) return

  if (!localeMessages[lang]) {
    try {
      const raw = await invoke<unknown>('i18n_load', { lang })
      localeMessages[lang] = { ...FALLBACK, ...flatten(raw) }
    } catch (err) {
      console.warn(`[i18n] 加载语言 "${lang}" 失败，回退英文`, err)
      localeMessages[lang] = { ...FALLBACK }
    }
  }

  messages = localeMessages[lang]
  currentLanguage = lang
  listeners.forEach((cb) => cb(lang))
}

/** 当前语言（getter 函数，随 setLanguage 更新） */
export const language = (): string => currentLanguage

export const getLanguage = (): string => currentLanguage

/** 订阅语言变化，返回取消订阅函数 */
export const onLanguageChanged = (cb: (lang: string) => void): (() => void) => {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

// 一次性注册后端语言切换事件（Tauri event 'language-changed'）
if (!listening) {
  listening = true
  listen<string>('language-changed', (e) => {
    void setLanguage(e.payload)
  }).catch((err) => {
    console.warn('[i18n] 监听 language-changed 失败', err)
  })
}

/**
 * React hook：{ t, language, setLanguage }。
 * 语言变化时触发重渲染（useState + onLanguageChanged 订阅）。
 */
export const useI18n = (): {
  t: typeof t
  language: string
  setLanguage: typeof setLanguage
} => {
  const [lang, setLang] = useState<string>(getLanguage())

  useEffect(() => onLanguageChanged((next) => setLang(next)), [])

  return { t, language: lang, setLanguage: useCallback((l: string) => setLanguage(l), []) }
}
