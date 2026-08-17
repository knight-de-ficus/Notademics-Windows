// 静态命令列表 —— 移植 marktext src/commands/index.ts。
// execute 内通过 bus.emit 分发（'mt::*' 通道与 marktext 一致）或直接调用 Tauri API。
// 说明：marktext 中由主进程处理的命令（open-file / open-folder 等）这里统一
// emit 同名 bus 通道，由后续任务接入组件/菜单逻辑。
import bus from '../bus'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { openUrl } from '@tauri-apps/plugin-opener'
import { t } from '../i18n'
import { usePreferencesStore } from '../store/preferences'

// 窗口缩放级别（zoomIn/zoomOut 用；Tauri 2 的 Webview.setZoom 需要显式因子）
let zoomLevel = 1.0

export interface CommandSubcommand {
  id: string
  description?: string
  value?: unknown
  execute?: () => void | Promise<void>
}

export interface CommandDescriptor {
  id: string
  description?: string
  shortcut?: string[]
  subcommands?: CommandSubcommand[]
  execute?: () => void | Promise<void>
  executeSubcommand?: (commandId: string, value?: unknown) => void | Promise<void>
}

export class RootCommand {
  id: string
  description: string
  subcommands: CommandSubcommand[]
  subcommandSelectedIndex: number

  constructor(subcommands: CommandSubcommand[] = []) {
    this.id = '#'
    this.description = '#'
    this.subcommands = subcommands
    this.subcommandSelectedIndex = -1
  }

  async run(): Promise<void> {}
  async unload(): Promise<void> {}

  async execute(): Promise<void> {
    throw new Error('Root command.')
  }
}

/** 先聚焦编辑器再执行，保证选区恢复（移植 marktext） */
const focusEditorAndExecute = (fn: () => void): void => {
  setTimeout(() => bus.emit('editor-focus'), 10)
  setTimeout(() => fn(), 150)
}

const delay = (time: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, time))

/**
 * 命令 id → i18n 键映射（移植 marktext commands/descriptions.ts 的 COMMAND_KEY_MAP，
 * 仅收录本文件声明的命令）。
 */
const COMMAND_KEY_MAP: Record<string, string> = {
  'file.new-tab': 'commands.file.newTab',
  'file.new-window': 'commands.file.newWindow',
  'file.open-file': 'commands.file.openFile',
  'file.open-folder': 'commands.file.openFolder',
  'file.save': 'commands.file.save',
  'file.save-as': 'commands.file.saveAs',
  'file.close-tab': 'commands.file.closeTab',
  'file.close-window': 'commands.file.closeWindow',
  'file.toggle-auto-save': 'commands.file.toggleAutoSave',
  'file.move-file': 'commands.file.moveFile',
  'file.rename-file': 'commands.file.renameFile',
  'file.export-file': 'commands.file.exportFile',
  'file.zoom': 'commands.file.zoom',
  'file.preferences': 'commands.file.preferences',
  'file.quit': 'commands.file.quit',
  'edit.undo': 'commands.edit.undo',
  'edit.redo': 'commands.edit.redo',
  'edit.duplicate': 'commands.edit.duplicate',
  'edit.create-paragraph': 'commands.edit.createParagraph',
  'edit.delete-paragraph': 'commands.edit.deleteParagraph',
  'edit.find': 'commands.edit.find',
  'edit.replace': 'commands.edit.replace',
  'edit.find-in-folder': 'commands.edit.findInFolder',
  'paragraph.heading-1': 'commands.paragraph.heading1',
  'paragraph.heading-2': 'commands.paragraph.heading2',
  'paragraph.heading-3': 'commands.paragraph.heading3',
  'paragraph.heading-4': 'commands.paragraph.heading4',
  'paragraph.heading-5': 'commands.paragraph.heading5',
  'paragraph.heading-6': 'commands.paragraph.heading6',
  'paragraph.upgrade-heading': 'commands.paragraph.upgradeHeading',
  'paragraph.degrade-heading': 'commands.paragraph.degradeHeading',
  'paragraph.table': 'commands.paragraph.table',
  'paragraph.code-fence': 'commands.paragraph.codeFence',
  'paragraph.quote-block': 'commands.paragraph.quoteBlock',
  'paragraph.math-formula': 'commands.paragraph.mathFormula',
  'paragraph.html-block': 'commands.paragraph.htmlBlock',
  'paragraph.order-list': 'commands.paragraph.orderList',
  'paragraph.bullet-list': 'commands.paragraph.bulletList',
  'paragraph.task-list': 'commands.paragraph.taskList',
  'paragraph.loose-list-item': 'commands.paragraph.looseListItem',
  'paragraph.paragraph': 'commands.paragraph.paragraph',
  'paragraph.reset-paragraph': 'commands.paragraph.resetParagraph',
  'paragraph.horizontal-line': 'commands.paragraph.horizontalLine',
  'paragraph.front-matter': 'commands.paragraph.frontMatter',
  'format.strong': 'commands.format.strong',
  'format.emphasis': 'commands.format.emphasis',
  'format.underline': 'commands.format.underline',
  'format.highlight': 'commands.format.highlight',
  'format.superscript': 'commands.format.superscript',
  'format.subscript': 'commands.format.subscript',
  'format.inline-code': 'commands.format.inlineCode',
  'format.inline-math': 'commands.format.inlineMath',
  'format.strike': 'commands.format.strike',
  'format.hyperlink': 'commands.format.hyperlink',
  'format.image': 'commands.format.image',
  'format.clear-format': 'commands.format.clearFormat',
  'window.minimize': 'commands.window.minimize',
  'window.toggle-always-on-top': 'commands.window.toggleAlwaysOnTop',
  'window.toggle-full-screen': 'commands.window.toggleFullScreen',
  'window.change-theme': 'commands.window.changeTheme',
  'view.source-code-mode': 'commands.view.sourceCodeMode',
  'view.typewriter-mode': 'commands.view.typewriterMode',
  'view.focus-mode': 'commands.view.focusMode',
  'view.toggle-sidebar': 'commands.view.toggleSidebar',
  'view.toggle-tabbar': 'commands.view.toggleTabbar',
  'view.text-direction': 'commands.view.textDirection',
  'docs.user-guide': 'commands.docs.userGuide',
  'docs.markdown-syntax': 'commands.docs.markdownSyntax',
  'tabs.cycleForward': 'commands.tabs.cycleForward',
  'tabs.cycleBackward': 'commands.tabs.cycleBackward'
}

/**
 * 命令描述：经 i18n 键查文案（支持动态语言切换），
 * 未收录或缺失翻译时回退原始 id。
 */
export const getCommandDescriptionById = (id: string): string => {
  const key = COMMAND_KEY_MAP[id]
  if (!key) return id
  const translated = t(key)
  return translated === key ? id : translated
}

const commands: CommandDescriptor[] = [
  // --------------------------------------------------------------------------
  // File
  // --------------------------------------------------------------------------

  {
    id: 'file.new-tab',
    execute: async () => {
      bus.emit('mt::new-untitled-tab', { selected: true, markdown: '' })
    }
  },
  {
    id: 'file.new-window',
    execute: async () => {
      const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow')
      new WebviewWindow(`main-${Date.now()}`, { url: window.location.pathname })
    }
  },
  {
    id: 'file.new-window',
    execute: async () => {
      const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow')
      new WebviewWindow(`main-${Date.now()}`, { url: window.location.pathname })
    }
  },
  {
    id: 'file.open-file',
    execute: async () => {
      const { open } = await import('@tauri-apps/plugin-dialog')
      const s = await open({
        multiple: false,
        filters: [
          { name: 'Markdown', extensions: ['md', 'mdx', 'markdown', 'mdown', 'mkd'] },
          { name: 'Plain Text', extensions: ['txt'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      })
      if (s && typeof s === 'string') {
        bus.emit('sideBar::open-file', s)
      }
    }
  },
  {
    id: 'file.open-folder',
    execute: async () => {
      const { open } = await import('@tauri-apps/plugin-dialog')
      const s = await open({ directory: true, multiple: false, title: 'Open Folder' })
      if (s && typeof s === 'string') {
        bus.emit('sideBar::open-workspace', s)
      }
    }
  },
  {
    id: 'file.save',
    execute: async () => {
      bus.emit('mt::editor-ask-file-save')
    }
  },
  {
    id: 'file.save-as',
    execute: async () => {
      bus.emit('mt::editor-ask-file-save-as')
    }
  },
  {
    id: 'file.close-tab',
    execute: async () => {
      bus.emit('mt::editor-close-tab', null)
    }
  },
  {
    id: 'file.close-window',
    execute: async () => {
      await getCurrentWindow().close()
    }
  },
  {
    id: 'file.toggle-auto-save',
    execute: async () => {
      bus.emit('mt::cmd-toggle-autosave')
    }
  },
  {
    id: 'file.move-file',
    execute: async () => {
      const { useEditorStore } = await import('../store/editor')
      const file = useEditorStore.getState().currentFile
      if (file) bus.emit('rename', { id: file.id, pathname: file.pathname, filename: file.filename })
    }
  },
  {
    id: 'file.rename-file',
    execute: async () => {
      const { useEditorStore } = await import('../store/editor')
      const file = useEditorStore.getState().currentFile
      if (file) bus.emit('rename', { id: file.id, pathname: file.pathname, filename: file.filename })
    }
  },
  {
    id: 'file.export-file',
    subcommands: [
      {
        id: 'file.export-file-html',
        description: 'Export as HTML',
        execute: async () => {
          await delay(50)
          bus.emit('showExportDialog', 'styledHtml')
        }
      },
      {
        id: 'file.export-file-pdf',
        description: 'Export as PDF',
        execute: async () => {
          await delay(50)
          bus.emit('showExportDialog', 'pdf')
        }
      }
    ]
  },
  {
    id: 'file.zoom',
    shortcut: ['Ctrl', 'Scroll'],
    subcommands: [
      { id: 'file.zoom-0', description: '62.5%', value: 0.625 },
      { id: 'file.zoom-1', description: '75%', value: 0.75 },
      { id: 'file.zoom-2', description: '87.5%', value: 0.875 },
      { id: 'file.zoom-3', description: '100%', value: 1.0 },
      { id: 'file.zoom-4', description: '112.5%', value: 1.125 },
      { id: 'file.zoom-5', description: '125%', value: 1.25 },
      { id: 'file.zoom-6', description: '137.5%', value: 1.375 },
      { id: 'file.zoom-7', description: '150%', value: 1.5 },
      { id: 'file.zoom-8', description: '162.5%', value: 1.625 },
      { id: 'file.zoom-9', description: '175%', value: 1.75 },
      { id: 'file.zoom-10', description: '187.5%', value: 1.875 },
      { id: 'file.zoom-11', description: '200%', value: 2.0 }
    ],
    executeSubcommand: async (_commandId, value) => {
      bus.emit('mt::window-zoom', value)
    }
  },
  {
    id: 'file.preferences',
    execute: async () => {
      window.location.hash = '#/preference/general'
    }
  },
  {
    id: 'file.quit',
    execute: async () => {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window')
        await getCurrentWindow().close()
      } catch {
        /* ignore */
      }
    }
  },

  // --------------------------------------------------------------------------
  // Edit
  // --------------------------------------------------------------------------

  {
    id: 'edit.undo',
    execute: async () => {
      focusEditorAndExecute(() => bus.emit('undo', 'undo'))
    }
  },
  {
    id: 'edit.redo',
    execute: async () => {
      focusEditorAndExecute(() => bus.emit('redo', 'redo'))
    }
  },
  {
    id: 'edit.duplicate',
    execute: async () => {
      focusEditorAndExecute(() => bus.emit('duplicate', 'duplicate'))
    }
  },
  {
    id: 'edit.create-paragraph',
    execute: async () => {
      focusEditorAndExecute(() => bus.emit('createParagraph', 'createParagraph'))
    }
  },
  {
    id: 'edit.delete-paragraph',
    execute: async () => {
      focusEditorAndExecute(() => bus.emit('deleteParagraph', 'deleteParagraph'))
    }
  },
  {
    id: 'edit.find',
    execute: async () => {
      await delay(150)
      bus.emit('find', 'find')
    }
  },
  {
    id: 'edit.replace',
    execute: async () => {
      await delay(150)
      bus.emit('replace', 'replace')
    }
  },
  {
    id: 'edit.findNext',
    execute: async () => {
      await delay(150)
      bus.emit('find-action', 'next')
    }
  },
  {
    id: 'edit.findPrevious',
    execute: async () => {
      await delay(150)
      bus.emit('find-action', 'previous')
    }
  },
  {
    id: 'edit.selectAll',
    execute: async () => {
      focusEditorAndExecute(() => bus.emit('selectAll', 'selectAll'))
    }
  },

  // --------------------------------------------------------------------------
  // Paragraph
  // --------------------------------------------------------------------------

  {
    id: 'paragraph.heading-1',
    execute: async () => {
      focusEditorAndExecute(() => bus.emit('paragraph', 'heading 1'))
    }
  },
  {
    id: 'paragraph.heading-2',
    execute: async () => {
      focusEditorAndExecute(() => bus.emit('paragraph', 'heading 2'))
    }
  },
  {
    id: 'paragraph.heading-3',
    execute: async () => {
      focusEditorAndExecute(() => bus.emit('paragraph', 'heading 3'))
    }
  },
  {
    id: 'paragraph.heading-4',
    execute: async () => {
      focusEditorAndExecute(() => bus.emit('paragraph', 'heading 4'))
    }
  },
  {
    id: 'paragraph.heading-5',
    execute: async () => {
      focusEditorAndExecute(() => bus.emit('paragraph', 'heading 5'))
    }
  },
  {
    id: 'paragraph.heading-6',
    execute: async () => {
      focusEditorAndExecute(() => bus.emit('paragraph', 'heading 6'))
    }
  },
  { id: 'paragraph.upgrade-heading', execute: async () => focusEditorAndExecute(() => bus.emit('paragraph', 'upgrade heading')) },
  { id: 'paragraph.degrade-heading', execute: async () => focusEditorAndExecute(() => bus.emit('paragraph', 'degrade heading')) },
  { id: 'paragraph.upgrade-heading', execute: async () => focusEditorAndExecute(() => bus.emit('paragraph', 'upgrade heading')) },
  { id: 'paragraph.degrade-heading', execute: async () => focusEditorAndExecute(() => bus.emit('paragraph', 'degrade heading')) },
  {
    id: 'paragraph.table',
    execute: async () => {
      focusEditorAndExecute(() => bus.emit('paragraph', 'table'))
    }
  },
  {
    id: 'paragraph.code-fence',
    execute: async () => {
      focusEditorAndExecute(() => bus.emit('paragraph', 'pre'))
    }
  },
  {
    id: 'paragraph.quote-block',
    execute: async () => {
      focusEditorAndExecute(() => bus.emit('paragraph', 'blockquote'))
    }
  },
  {
    id: 'paragraph.math-formula',
    execute: async () => {
      focusEditorAndExecute(() => bus.emit('paragraph', 'mathblock'))
    }
  },
  { id: 'paragraph.html-block', execute: async () => focusEditorAndExecute(() => bus.emit('paragraph', 'html')) },
  { id: 'paragraph.html-block', execute: async () => focusEditorAndExecute(() => bus.emit('paragraph', 'html')) },
  {
    id: 'paragraph.order-list',
    execute: async () => {
      focusEditorAndExecute(() => bus.emit('paragraph', 'ol-bullet'))
    }
  },
  {
    id: 'paragraph.bullet-list',
    execute: async () => {
      focusEditorAndExecute(() => bus.emit('paragraph', 'ul-bullet'))
    }
  },
  {
    id: 'paragraph.task-list',
    execute: async () => {
      focusEditorAndExecute(() => bus.emit('paragraph', 'ul-task'))
    }
  },
  { id: 'paragraph.loose-list-item', execute: async () => focusEditorAndExecute(() => bus.emit('paragraph', 'loose-list-item')) },
  { id: 'paragraph.front-matter', execute: async () => focusEditorAndExecute(() => bus.emit('paragraph', 'frontmatter')) },
  { id: 'paragraph.loose-list-item', execute: async () => focusEditorAndExecute(() => bus.emit('paragraph', 'loose-list-item')) },
  { id: 'paragraph.front-matter', execute: async () => focusEditorAndExecute(() => bus.emit('paragraph', 'frontmatter')) },
  {
    id: 'paragraph.paragraph',
    execute: async () => {
      focusEditorAndExecute(() => bus.emit('paragraph', 'paragraph'))
    }
  },
  {
    id: 'paragraph.reset-paragraph',
    execute: async () => {
      focusEditorAndExecute(() => bus.emit('paragraph', 'reset-to-paragraph'))
    }
  },
  {
    id: 'paragraph.horizontal-line',
    execute: async () => {
      focusEditorAndExecute(() => bus.emit('paragraph', 'hr'))
    }
  },

  // --------------------------------------------------------------------------
  // Format
  // --------------------------------------------------------------------------

  {
    id: 'format.strong',
    execute: async () => {
      focusEditorAndExecute(() => bus.emit('format', 'strong'))
    }
  },
  {
    id: 'format.emphasis',
    execute: async () => {
      focusEditorAndExecute(() => bus.emit('format', 'em'))
    }
  },
  { id: 'format.underline', execute: async () => focusEditorAndExecute(() => bus.emit('format', 'u')) },
  { id: 'format.superscript', execute: async () => focusEditorAndExecute(() => bus.emit('format', 'sup')) },
  { id: 'format.subscript', execute: async () => focusEditorAndExecute(() => bus.emit('format', 'sub')) },
  { id: 'format.highlight', execute: async () => focusEditorAndExecute(() => bus.emit('format', 'mark')) },
  { id: 'format.underline', execute: async () => focusEditorAndExecute(() => bus.emit('format', 'u')) },
  { id: 'format.superscript', execute: async () => focusEditorAndExecute(() => bus.emit('format', 'sup')) },
  { id: 'format.subscript', execute: async () => focusEditorAndExecute(() => bus.emit('format', 'sub')) },
  { id: 'format.highlight', execute: async () => focusEditorAndExecute(() => bus.emit('format', 'mark')) },
  {
    id: 'format.inline-code',
    execute: async () => {
      focusEditorAndExecute(() => bus.emit('format', 'inline_code'))
    }
  },
  {
    id: 'format.inline-math',
    execute: async () => {
      focusEditorAndExecute(() => bus.emit('format', 'inline_math'))
    }
  },
  {
    id: 'format.strike',
    execute: async () => {
      focusEditorAndExecute(() => bus.emit('format', 'del'))
    }
  },
  {
    id: 'format.hyperlink',
    execute: async () => {
      focusEditorAndExecute(() => bus.emit('format', 'link'))
    }
  },
  {
    id: 'format.image',
    execute: async () => {
      focusEditorAndExecute(() => bus.emit('format', 'image'))
    }
  },
  {
    id: 'format.clear-format',
    execute: async () => {
      focusEditorAndExecute(() => bus.emit('format', 'clear'))
    }
  },

  // --------------------------------------------------------------------------
  // Window
  // --------------------------------------------------------------------------

  { id: 'window.minimize', execute: async () => getCurrentWindow().minimize() },
  {
    id: 'window.toggle-always-on-top',
    execute: async () => {
      const win = getCurrentWindow()
      await win.setAlwaysOnTop(!(await win.isAlwaysOnTop()))
    }
  },
  {
    id: 'window.toggle-full-screen',
    execute: async () => {
      const win = getCurrentWindow()
      await win.setFullscreen(!(await win.isFullscreen()))
    }
  },

  { id: 'window.minimize', execute: async () => getCurrentWindow().minimize() },
  {
    id: 'window.toggle-always-on-top',
    execute: async () => {
      const win = getCurrentWindow()
      await win.setAlwaysOnTop(!(await win.isAlwaysOnTop()))
    }
  },
  {
    id: 'window.toggle-full-screen',
    execute: async () => {
      const win = getCurrentWindow()
      await win.setFullscreen(!(await win.isFullscreen()))
    }
  },

  {
    id: 'window.change-theme',
    subcommands: [
      { id: 'window.change-theme-light', description: 'Cadmium Light', value: 'light' },
      { id: 'window.change-theme-dark', description: 'Dark', value: 'dark' },
      { id: 'window.change-theme-graphite', description: 'Graphite', value: 'graphite' },
      { id: 'window.change-theme-material-dark', description: 'Material Dark', value: 'material-dark' },
      { id: 'window.change-theme-one-dark', description: 'One Dark', value: 'one-dark' },
      { id: 'window.change-theme-ulysses', description: 'Ulysses', value: 'ulysses' }
    ],
    executeSubcommand: async (_commandId, theme) => {
      bus.emit('mt::set-user-preference', { theme })
    }
  },

  // --------------------------------------------------------------------------
  // View
  // --------------------------------------------------------------------------

  {
    id: 'view.source-code-mode',
    execute: async () => {
      bus.emit('view:toggle-view-entry', 'sourceCode')
    }
  },
  {
    id: 'view.typewriter-mode',
    execute: async () => {
      focusEditorAndExecute(() => bus.emit('view:toggle-view-entry', 'typewriter'))
    }
  },
  {
    id: 'view.focus-mode',
    execute: async () => {
      focusEditorAndExecute(() => bus.emit('view:toggle-view-entry', 'focus'))
    }
  },
  {
    id: 'view.toggle-sidebar',
    execute: async () => {
      bus.emit('view:toggle-layout-entry', 'showSideBar')
    }
  },
  {
    id: 'view.toggle-tabbar',
    execute: async () => {
      bus.emit('view:toggle-layout-entry', 'showTabBar')
    }
  },
  {
    id: 'view.toggleTheme',
    execute: async () => {
      const p = usePreferencesStore.getState()
      const next = p.theme === 'dark' ? 'light' : 'dark'
      p.SET_SINGLE_PREFERENCE('theme', next)
    }
  },
  {
    id: 'view.text-direction',
    subcommands: [
      { id: 'view.text-direction-ltr', description: 'Left to Right', value: 'ltr' },
      { id: 'view.text-direction-rtl', description: 'Right to Left', value: 'rtl' }
    ],
    executeSubcommand: async (_commandId, value) => {
      bus.emit('mt::set-user-preference', { textDirection: value })
    }
  },

  // --------------------------------------------------------------------------
  // Docs
  // --------------------------------------------------------------------------

  {
    id: 'docs.user-guide',
    execute: async () => {
      await openUrl('https://marktext.me/docs/basics')
    }
  },
  {
    id: 'docs.markdown-syntax',
    execute: async () => {
      await openUrl('https://marktext.me/docs/markdown-syntax')
    }
  },

  // --------------------------------------------------------------------------
  // Tabs
  // --------------------------------------------------------------------------

  {
    id: 'tabs.cycleForward',
    execute: async () => {
      bus.emit('mt::tabs-cycle-right')
    }
  },
  {
    id: 'tabs.cycleBackward',
    execute: async () => {
      bus.emit('mt::tabs-cycle-left')
    }
  },

  // --------------------------------------------------------------------------
  // 对齐 marktext 菜单的补充命令（File / Edit / Paragraph / Format / Window / View / Theme / Help）
  // --------------------------------------------------------------------------

  // ---- File ----
  {
    id: 'file.import',
    execute: async () => {
      bus.emit('importDialog', true)
    }
  },
  {
    id: 'file.print',
    execute: async () => {
      console.warn('[command] print not supported (excluded by requirement)')
    }
  },

  // ---- Edit ----
  {
    id: 'edit.cut',
    execute: async () => {
      bus.emit('cut', 'cut')
    }
  },
  {
    id: 'edit.copy',
    execute: async () => {
      bus.emit('copy', 'copy')
    }
  },
  {
    id: 'edit.paste',
    execute: async () => {
      bus.emit('paste', 'paste')
    }
  },
  {
    id: 'edit.copyAsRich',
    execute: async () => {
      focusEditorAndExecute(() => bus.emit('copyAsRich'))
    }
  },
  {
    id: 'edit.copyAsHtml',
    execute: async () => {
      focusEditorAndExecute(() => bus.emit('copyAsHtml'))
    }
  },
  {
    id: 'edit.pasteAsPlainText',
    execute: async () => {
      focusEditorAndExecute(() => bus.emit('pasteAsPlainText'))
    }
  },
  {
    id: 'edit.screenshot',
    execute: async () => {
      console.warn('[command] screenshot not supported on Windows')
    }
  },
  {
    id: 'edit.line-ending-crlf',
    execute: async () => {
      bus.emit('mt::set-line-ending', 'crlf')
    }
  },
  {
    id: 'edit.line-ending-lf',
    execute: async () => {
      bus.emit('mt::set-line-ending', 'lf')
    }
  },

  // ---- Paragraph 补充 ----

  // ---- Format 补充 ----

  // ---- Window ----
  {
    id: 'window.zoomIn',
    execute: async () => {
      const { getCurrentWebview } = await import('@tauri-apps/api/webview')
      zoomLevel = Math.min(2, zoomLevel + 0.1)
      await getCurrentWebview().setZoom(zoomLevel)
    }
  },
  {
    id: 'window.zoomOut',
    execute: async () => {
      const { getCurrentWebview } = await import('@tauri-apps/api/webview')
      zoomLevel = Math.max(0.5, zoomLevel - 0.1)
      await getCurrentWebview().setZoom(zoomLevel)
    }
  },

  // ---- View 补充 ----
  {
    id: 'view.command-palette',
    execute: async () => {
      bus.emit('show-command-palette')
    }
  },
  {
    id: 'view.toggle-toc',
    execute: async () => {
      const { useLayoutStore } = await import('../store/layout')
      const s = useLayoutStore.getState()
      s.SET_LAYOUT({ rightColumn: s.rightColumn === 'toc' ? 'files' : 'toc', showSideBar: true })
    }
  },
  {
    id: 'view.reload-images',
    execute: async () => {
      bus.emit('invalidate-image-cache')
    }
  },
  {
    id: 'view.toggle-dev-tools',
    execute: async () => {
      const { getCurrentWindow } = await import('@tauri-apps/api/window')
      const w = getCurrentWindow() as unknown as { openDevTools?: () => Promise<void> }
      await w.openDevTools?.()
    }
  },
  {
    id: 'view.dev-reload',
    execute: async () => {
      window.location.reload()
    }
  },

  // ---- Theme ----
  {
    id: 'theme.follow-system-theme',
    execute: async () => {
      const { usePreferencesStore } = await import('../store/preferences')
      const p = usePreferencesStore.getState()
      p.SET_SINGLE_PREFERENCE('followSystemTheme', !p.followSystemTheme)
    }
  },

  // ---- Help ----
  {
    id: 'help.markdown-reference',
    execute: async () => {
      await openUrl('https://marktext.me/docs/markdown-syntax')
    }
  },
  {
    id: 'help.changelog',
    execute: async () => {
      await openUrl('https://github.com/marktext/marktext/releases')
    }
  },
  {
    id: 'help.follow-us',
    execute: async () => {
      await openUrl('https://twitter.com/marktextapp')
    }
  },
  {
    id: 'help.support',
    execute: async () => {
      await openUrl('https://github.com/marktext/marktext')
    }
  },
  {
    id: 'help.ask-question',
    execute: async () => {
      await openUrl('https://github.com/marktext/marktext/discussions')
    }
  },
  {
    id: 'help.report-bug',
    execute: async () => {
      await openUrl('https://github.com/marktext/marktext/issues')
    }
  },
  {
    id: 'help.view-source',
    execute: async () => {
      await openUrl('https://github.com/marktext/marktext')
    }
  },
  {
    id: 'help.license',
    execute: async () => {
      await openUrl('https://github.com/marktext/marktext/blob/develop/LICENSE')
    }
  },
  {
    id: 'help.check-updates',
    execute: async () => {
      bus.emit('check-update')
    }
  },
  {
    id: 'help.about',
    execute: async () => {
      bus.emit('aboutDialog')
    }
  }
]

// 初始加载时补齐缺失的描述
for (const item of commands) {
  const { id, description } = item
  if (id && !description) {
    item.description = getCommandDescriptionById(id)
  }
}

/**
 * 获取带完整描述的命令列表（语言切换后由命令中心重新调用刷新描述）。
 */
export const getCommandsWithDescriptions = async (): Promise<CommandDescriptor[]> => {
  const updateDescriptions = (commandList: Array<CommandDescriptor | CommandSubcommand>): void => {
    for (const item of commandList) {
      const { id } = item
      const subcommands = (item as CommandDescriptor).subcommands
      if (id) {
        item.description = getCommandDescriptionById(id)
      }
      if (subcommands && Array.isArray(subcommands)) {
        updateDescriptions(subcommands)
      }
    }
  }

  updateDescriptions(commands)
  return commands
}

export default commands
