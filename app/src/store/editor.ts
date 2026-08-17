// 编辑器核心 store —— 标签页 / 当前文件 / 保存 / 内容变更 / 文件监听。
// 对齐 marktext store/editor.ts 的 action 行为，但：
// - IPC 改用 Tauri 命令（read_file / write_file）与 Tauri event（listen）
// - 不可变更新（zustand + React），通过 updateTab 统一替换标签对象
// - 未命名标签的保存确认、未保存关闭确认等 UI 流程通过 bus 事件交给上层组件
import { create } from 'zustand'
import { listen } from '@tauri-apps/api/event'
import { save as saveDialog } from '@tauri-apps/plugin-dialog'
import bus from '../bus'
import { readFile, writeFile } from '../lib/tauri'
import { createDocumentState, getBlankFileState, getOptionsFromState } from './help'
import type { IFileState } from '../shared/types/files'
import type {
  FileEncoding,
  FileHistory,
  FileWordCount,
  LineEnding,
  MarkdownDocument,
  TabOptions
} from '../shared/types/files'
import { usePreferencesStore } from './preferences'
import { useLayoutStore } from './layout'
import { useMainStore } from '.'
import notice from '../services/notification'
import { t } from '../i18n'

// registerListeners 的模块级状态（防重复注册 + 收集 Tauri listen 退订）
let registered = false
let disposeFns: Array<() => void> = []

// ---------------------------------------------------------------------------
// TOC 树构建（移植 marktext util/listToTree）
// ---------------------------------------------------------------------------

interface TocItem {
  slug?: string
  githubSlug?: string
  content?: string
  lvl: number | null
  [key: string]: unknown
}

interface TocTreeNode {
  parent: TocTreeNode | null
  lvl: number | null
  label: unknown
  slug: unknown
  githubSlug: unknown
  children: TocTreeNode[]
}

class Node implements TocTreeNode {
  parent: TocTreeNode | null
  lvl: number | null
  label: unknown
  slug: unknown
  githubSlug: unknown
  children: TocTreeNode[]

  constructor(item: {
    parent: TocTreeNode | null
    lvl: number | null
    content?: unknown
    slug?: unknown
    githubSlug?: unknown
  }) {
    const { parent, lvl, content, slug, githubSlug } = item
    this.parent = parent
    this.lvl = lvl
    this.label = content
    this.slug = slug
    this.githubSlug = githubSlug
    this.children = []
  }
}

const findParent = (
  item: TocItem,
  lastNode: TocTreeNode | null,
  rootNode: TocTreeNode
): TocTreeNode => {
  if (!lastNode) return rootNode
  const { lvl: lastLvl } = lastNode
  const { lvl } = item
  if (lvl === null || lastLvl === null) return rootNode
  if (lvl < lastLvl) return findParent(item, lastNode.parent, rootNode)
  if (lvl === lastLvl) return lastNode.parent ?? rootNode
  return lastNode
}

const listToTree = (list: TocItem[]): TocTreeNode[] => {
  const rootNode = new Node({ parent: null, lvl: null, content: null, slug: null })
  let lastNode: TocTreeNode | null = null
  for (const item of list) {
    const parent = findParent(item, lastNode, rootNode)
    const node = new Node({ parent, ...item })
    parent.children.push(node)
    lastNode = node
  }
  return rootNode.children
}

/** 轻量深比较（TOC 相等性判断用） */
const equal = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b)

/** 按 trimTrailingNewlineOption 裁剪/补齐结尾换行（移植 marktext） */
const adjustTrailingNewlines = (markdown: string, trimTrailingNewlineOption: number): string => {
  if (!markdown) return ''
  switch (trimTrailingNewlineOption) {
    case 0:
      return markdown.replace(/[\r?\n]+$/, '')
    case 1: {
      const lastIndex = markdown.length - 1
      if (markdown[lastIndex] === '\n') {
        if (markdown.length === 1) return ''
        if (markdown[lastIndex - 1] !== '\n') return markdown
      }
      markdown = markdown.replace(/[\r?\n]+$/, '')
      if (markdown.length === 0) return ''
      return markdown + '\n'
    }
    default:
      return markdown
  }
}

const basename = (p: string): string => {
  const parts = p.replace(/\\/g, '/').split('/')
  return parts[parts.length - 1] || p
}

// ---------------------------------------------------------------------------
// 类型
// ---------------------------------------------------------------------------

export interface ContentChangePayload {
  id: string
  markdown: string
  wordCount?: FileWordCount
  cursor?: unknown
  muyaIndexCursor?: unknown
  history?: FileHistory
  toc?: TocItem[]
  blocks?: unknown
}

export interface FileChangePayload {
  pathname: string
  data: {
    isMixedLineEndings?: boolean
    lineEnding?: LineEnding | string
    adjustLineEndingOnSave?: boolean
    trimTrailingNewline?: number
    encoding?: FileEncoding
    markdown: string
    filename: string
  }
}

interface PushTabNotificationPayload {
  tabId: string
  msg: string
  showConfirm?: boolean
  style?: string
  exclusiveType?: string
  action?: (status?: unknown) => void
}

interface AutoSavePayload {
  id: string
  filename: string
  pathname: string
  markdown: string
  options: ReturnType<typeof getOptionsFromState>
}

export interface EditorState {
  currentFile: IFileState | null
  tabs: IFileState[]
  tabIdToIndex: Record<string, number>
  listToc: TocItem[]
  toc: TocTreeNode[]
}

export interface EditorActions {
  NEW_UNTITLED_TAB: (opts: { markdown?: string; selected?: boolean }) => void
  NEW_TAB_WITH_CONTENT: (opts: {
    markdownDocument: MarkdownDocument | null | undefined
    options?: TabOptions
    selected?: boolean
  }) => void
  UPDATE_CURRENT_FILE: (file: IFileState) => void
  CLOSE_TAB: (file?: IFileState | null) => void
  FORCE_CLOSE_TAB: (file: IFileState) => void
  CLOSE_UNSAVED_TAB: (file: IFileState) => void
  CLOSE_ALL_TABS: () => void
  CYCLE_TABS: (direction: boolean) => void
  SWITCH_TAB_BY_INDEX: (index: number) => void
  EXCHANGE_TABS_BY_ID: (ids: { fromId: string; toId: string | null }) => void
  RENAME_IF_NEEDED: (ids: { src: string; dest: string }) => void
  SET_SAVE_STATUS_WHEN_REMOVE: (ids: { pathname: string }) => void
  FILE_SAVE: () => Promise<void>
  FILE_SAVE_AS: () => Promise<void>
  HANDLE_AUTO_SAVE: (payload: AutoSavePayload) => void
  ASK_FOR_SAVE_ALL: (closeTabs: boolean) => Promise<void>
  UPDATE_TOC: (toc: TocItem[]) => void
  LISTEN_FOR_CONTENT_CHANGE: (payload: ContentChangePayload) => void
  loadChange: (change: FileChangePayload) => void
  handleFsChange: (payload: { kind: string; paths: string[] }) => Promise<void>
  CREATE_BUFFERED_STATE: () => BufferedEditorState
  RESTORE_BUFFERED_STATE: (state: unknown) => void
}

export type EditorStore = EditorState & EditorActions

interface BufferedEditorState {
  currentFileId: string | null
  tabs: Array<Partial<IFileState> & { id: string }>
}

/** 每个标签页独立的自动保存防抖定时器 */
const autoSaveTimers = new Map<string, ReturnType<typeof setTimeout>>()

const computeTabIdToIndex = (tabs: IFileState[]): Record<string, number> =>
  tabs.reduce<Record<string, number>>((map, tab, index) => {
    map[tab.id] = index
    return map
  }, {})

export const useEditorStore = create<EditorStore>()((set, get) => {
  /**
   * 不可变更新单个标签：拷贝 → mutate → 替换 tabs 数组，
   * 若为当前文件则同步 currentFile 引用，保证 React 能感知变更。
   */
  const updateTab = (id: string, mutate: (tab: IFileState) => void): void => {
    set((state) => {
      const index = state.tabIdToIndex[id]
      if (index === undefined) return state
      const old = state.tabs[index]
      const next: IFileState = { ...old }
      mutate(next)
      const tabs = [...state.tabs]
      tabs[index] = next
      const patch: Partial<EditorState> = { tabs }
      if (state.currentFile?.id === id) patch.currentFile = next
      return patch as Partial<EditorState>
    })
  }

  const pushTabNotification = (data: PushTabNotificationPayload): void => {
    const defaultAction: (status?: unknown) => void = () => {}
    const { tabId, msg } = data
    const action = data.action || defaultAction
    const showConfirm = data.showConfirm || false
    const style = data.style || 'info'
    const exclusiveType = data.exclusiveType || ''

    if (get().tabIdToIndex[tabId] === undefined) {
      console.error(t('store.editor.tabNotFound'))
      return
    }

    updateTab(tabId, (tab) => {
      const { notifications } = tab
      // 同一 exclusiveType 只保留一条通知（先移除旧的再入栈）
      if (exclusiveType) {
        const index = notifications.findIndex((n) => n.exclusiveType === exclusiveType)
        if (index >= 0) notifications.splice(index, 1)
      }
      notifications.push({ msg, showConfirm, style, exclusiveType, action })
    })
  }

  const markTabSaved = (id: string): void => {
    updateTab(id, (tab) => {
      const lastEditIndex = tab.history.lastEditIndex
      if (
        typeof lastEditIndex === 'number' &&
        lastEditIndex >= 0 &&
        lastEditIndex < tab.history.stack.length
      ) {
        const entry = tab.history.stack[lastEditIndex]
        if (entry && typeof entry.id === 'number') {
          tab.lastSavedHistoryId = entry.id
        }
      }
      tab.isSaved = true
    })
    bus.emit('tab-saved', id)
  }

  return {
    currentFile: null,
    tabs: [],
    tabIdToIndex: {},
    listToc: [],
    toc: [],

    // ------------------------------------------------------------------
    // 标签操作
    // ------------------------------------------------------------------

    NEW_UNTITLED_TAB: ({ markdown: markdownString, selected }) => {
      const isSelected = selected ?? true
      const { defaultEncoding, endOfLine } = usePreferencesStore.getState()
      const fileState = getBlankFileState(
        get().tabs.map((f) => ({ pathname: f.pathname, filename: f.filename })),
        defaultEncoding,
        endOfLine,
        markdownString ?? null
      )

      if (isSelected) {
        const { id, markdown } = fileState
        get().UPDATE_CURRENT_FILE(fileState)
        bus.emit('file-loaded', { id, markdown })
      } else {
        set((state) => ({
          tabs: [...state.tabs, fileState],
          tabIdToIndex: computeTabIdToIndex([...state.tabs, fileState])
        }))
      }
    },

    NEW_TAB_WITH_CONTENT: ({ markdownDocument, options = {}, selected }) => {
      if (!markdownDocument) {
        console.warn('Cannot create a file tab without a markdown document!')
        get().NEW_UNTITLED_TAB({})
        return
      }

      const isSelected = selected ?? true
      const { tabs, currentFile } = get()
      const { pathname } = markdownDocument

      // 同路径已打开 —— 直接切换过去
      const existingTab = pathname ? tabs.find((tab) => tab.pathname === pathname) : undefined
      if (existingTab) {
        get().UPDATE_CURRENT_FILE(existingTab)
        return
      }

      // 当前是"已保存的空白标签"时复用它（不保留标签栏状态）
      if (currentFile && currentFile.isSaved && !currentFile.pathname) {
        get().FORCE_CLOSE_TAB(currentFile)
      }

      const docState = createDocumentState(
        Object.assign(
          {},
          markdownDocument as unknown as Record<string, unknown>,
          options as Record<string, unknown>
        )
      )
      const { id, cursor } = docState

      if (isSelected) {
        get().UPDATE_CURRENT_FILE(docState)
        bus.emit('file-loaded', { id, markdown: docState.markdown, cursor })
      } else {
        set((state) => ({
          tabs: [...state.tabs, docState],
          tabIdToIndex: computeTabIdToIndex([...state.tabs, docState])
        }))
      }

      if (markdownDocument.isMixedLineEndings && typeof markdownDocument.lineEnding === 'string') {
        const { filename, lineEnding } = markdownDocument
        pushTabNotification({
          tabId: id,
          msg: t('store.editor.mixedLineEndingsNormalized', {
            name: filename,
            lineEnding: lineEnding.toUpperCase()
          })
        })
      }
    },

    UPDATE_CURRENT_FILE: (currentFile) => {
      const state = get()
      const oldCurrentFile = state.currentFile

      if (oldCurrentFile == null || oldCurrentFile.id !== currentFile.id) {
        const { id, markdown, cursor, history, pathname, scrollTop, blocks, muyaIndexCursor } =
          currentFile
        // 切换前 flush 旧标签的待写编辑，避免内容归属错误
        if (oldCurrentFile) {
          bus.emit('flush-active-editor')
        }

        const tabs = [...state.tabs]
        if (!tabs.some((file) => file.id === currentFile.id)) {
          tabs.push(currentFile)
        }
        set({ tabs, currentFile, tabIdToIndex: computeTabIdToIndex(tabs) })

        bus.emit('file-changed', {
          id,
          markdown,
          cursor,
          muyaIndexCursor,
          renderCursor: true,
          history,
          scrollTop,
          blocks
        })
      }
    },

    CLOSE_TAB: (file = null) => {
      const target = file ?? get().currentFile
      if (target === null) return
      if (target.isSaved) {
        get().FORCE_CLOSE_TAB(target)
      } else {
        get().CLOSE_UNSAVED_TAB(target)
      }
    },

    CLOSE_UNSAVED_TAB: (file) => {
      // marktext 将未保存标签交给主进程弹确认框；Tauri 无主进程流程，
      // 改由 UI 层监听此事件决定保存/放弃/取消，再调用 FORCE_CLOSE_TAB。
      const { id, pathname, filename, markdown } = file
      bus.emit('editor:close-unsaved-tab', {
        id,
        pathname,
        filename,
        markdown,
        options: getOptionsFromState(file)
      })
    },

    FORCE_CLOSE_TAB: (file) => {
      const { tabs: rawTabs, currentFile } = get()
      const tabs = [...rawTabs]
      const index = tabs.findIndex((f) => f.id === file.id)
      if (index > -1) {
        tabs.splice(index, 1)
      }

      if (file.id && autoSaveTimers.has(file.id)) {
        const timer = autoSaveTimers.get(file.id)
        if (timer) clearTimeout(timer)
        autoSaveTimers.delete(file.id)
      }

      let nextCurrentFile = currentFile
      if (currentFile && file.id === currentFile.id) {
        nextCurrentFile = tabs[index] ?? tabs[index - 1] ?? tabs[0] ?? null
        if (nextCurrentFile && typeof nextCurrentFile.markdown === 'string') {
          const { id, markdown, cursor, history, pathname, scrollTop, blocks, muyaIndexCursor } =
            nextCurrentFile
          bus.emit('file-changed', {
            id,
            markdown,
            cursor,
            muyaIndexCursor,
            renderCursor: true,
            history,
            scrollTop,
            blocks
          })
        }
      }

      const emptyToc = tabs.length === 0 ? { listToc: [], toc: [] } : {}
      set({ tabs, currentFile: nextCurrentFile, tabIdToIndex: computeTabIdToIndex(tabs), ...emptyToc })
    },

    CLOSE_ALL_TABS: () => {
      get()
        .tabs.slice()
        .forEach((tab) => {
          get().CLOSE_TAB(tab)
        })
    },

    CYCLE_TABS: (direction) => {
      const { tabs, currentFile } = get()
      if (tabs.length <= 1) return

      const currentIndex = tabs.findIndex((f) => f.id === currentFile?.id)
      if (currentIndex === -1) {
        console.error('CYCLE_TABS: Cannot find current tab index.')
        return
      }

      const nextTabIndex = !direction
        ? currentIndex === 0
          ? tabs.length - 1
          : currentIndex - 1
        : (currentIndex + 1) % tabs.length
      const nextTab = tabs[nextTabIndex]
      if (!nextTab || !nextTab.id) {
        console.error(`CYCLE_TABS: Cannot find next tab (index="${nextTabIndex}").`)
        return
      }
      get().UPDATE_CURRENT_FILE(nextTab)
    },

    SWITCH_TAB_BY_INDEX: (nextTabIndex) => {
      const { tabs } = get()
      if (nextTabIndex < 0 || nextTabIndex >= tabs.length) {
        console.warn('Invalid tab index:', nextTabIndex)
        return
      }
      const nextTab = tabs[nextTabIndex]
      if (!nextTab || !nextTab.id) {
        console.error(`Cannot find tab by index="${nextTabIndex}".`)
        return
      }
      get().UPDATE_CURRENT_FILE(nextTab)
    },

    EXCHANGE_TABS_BY_ID: ({ fromId, toId }) => {
      const tabs = [...get().tabs]

      const moveItem = <T>(arr: T[], from: number, to: number): boolean => {
        if (from === to) return true
        const len = arr.length
        const [item] = arr.splice(from, 1)
        if (item === undefined) return false
        arr.splice(to, 0, item)
        return arr.length === len
      }

      const fromIndex = tabs.findIndex((f) => f.id === fromId)
      if (fromIndex === -1) return

      if (!toId) {
        moveItem(tabs, fromIndex, tabs.length - 1)
      } else {
        const toIndex = tabs.findIndex((f) => f.id === toId)
        if (toIndex === -1) return
        const realToIndex = fromIndex < toIndex ? toIndex - 1 : toIndex
        moveItem(tabs, fromIndex, realToIndex)
      }
      set({ tabs, tabIdToIndex: computeTabIdToIndex(tabs) })
    },

    /** 侧边栏重命名后同步打开标签的 pathname / filename */
    RENAME_IF_NEEDED: ({ src, dest }) => {
      set((state) => {
        const tabs = state.tabs.map((tab) =>
          tab.pathname === src ? { ...tab, pathname: dest, filename: basename(dest) } : tab
        )
        const patch: Partial<EditorState> = { tabs }
        if (state.currentFile?.pathname === dest) {
          patch.currentFile = tabs.find((f) => f.pathname === dest) ?? state.currentFile
        }
        return patch as Partial<EditorState>
      })
    },

    /** 文件被移除时把匹配标签标记为未保存（供侧边栏 unlink 事件使用） */
    SET_SAVE_STATUS_WHEN_REMOVE: ({ pathname }) => {
      get().tabs.forEach((tab) => {
        if (tab.pathname === pathname) {
          updateTab(tab.id, (next) => {
            next.isSaved = false
          })
        }
      })
    },

    // ------------------------------------------------------------------
    // 保存
    // ------------------------------------------------------------------

    FILE_SAVE: async () => {
      const file = get().currentFile
      if (!file) return
      bus.emit('flush-active-editor')

      if (!file.pathname) {
        // 未命名文件 —— 走另存为
        return get().FILE_SAVE_AS()
      }

      const { id, pathname, markdown, encoding } = file
      try {
        await writeFile(pathname, markdown, encoding.encoding)
        markTabSaved(id)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        pushTabNotification({
          tabId: id,
          msg: t('store.editor.errorWhileSaving', { msg }),
          style: 'crit'
        })
        void notice.notify({
          title: t('dialog.saveFailure'),
          message: msg,
          type: 'error',
          time: 20000,
          showConfirm: false
        })
      }
    },

    FILE_SAVE_AS: async () => {
      const file = get().currentFile
      if (!file) return
      bus.emit('flush-active-editor')

      const defaultPath = file.pathname || `${file.filename || 'Untitled.md'}`
      try {
        const target = await saveDialog({
          defaultPath,
          filters: [
            { name: 'Markdown', extensions: ['md', 'markdown', 'mdx'] },
            { name: 'Plain Text', extensions: ['txt'] }
          ]
        })
        if (!target || typeof target !== 'string') return

        await writeFile(target, file.markdown, file.encoding.encoding)
        updateTab(file.id, (tab) => {
          tab.pathname = target
          tab.filename = basename(target)
          tab.isSaved = true
        })
        bus.emit('tab-saved', file.id)
      } catch (err) {
        console.error('FILE_SAVE_AS failed:', err)
      }
    },

    HANDLE_AUTO_SAVE: ({ id, pathname, markdown, options }) => {
      if (!id || !pathname) {
        throw new Error('HANDLE_AUTO_SAVE: Invalid tab.')
      }

      const { autoSaveDelay } = usePreferencesStore.getState()

      // 防抖：内容持续变化时重置定时器
      if (autoSaveTimers.has(id)) {
        const timer = autoSaveTimers.get(id)
        if (timer) clearTimeout(timer)
        autoSaveTimers.delete(id)
      }

      const timer = setTimeout(() => {
        autoSaveTimers.delete(id)
        const tab = get().tabs.find((f) => f.id === id)
        if (tab && !tab.isSaved) {
          void writeFile(pathname, markdown, options.encoding.encoding)
            .then(() => {
              markTabSaved(id)
            })
            .catch((err) => {
              console.error('Auto save failed:', pathname, err)
            })
        }
      }, autoSaveDelay)
      autoSaveTimers.set(id, timer)
    },

    ASK_FOR_SAVE_ALL: async (closeTabs) => {
      const { tabs } = get()
      const unsaved = tabs.filter((file) => !file.isSaved)

      // 有路径的直接写盘；无路径的保持打开，由 UI 决定
      await Promise.all(
        unsaved
          .filter((file) => file.pathname)
          .map(async (file) => {
            try {
              await writeFile(file.pathname, file.markdown, file.encoding.encoding)
              markTabSaved(file.id)
            } catch (err) {
              console.error('ASK_FOR_SAVE_ALL failed:', file.pathname, err)
            }
          })
      )

      if (closeTabs) {
        get().CLOSE_ALL_TABS()
      }
    },

    // ------------------------------------------------------------------
    // 内容变更
    // ------------------------------------------------------------------

    UPDATE_TOC: (toc) => {
      set({ listToc: toc ?? [], toc: listToTree(toc ?? []) })
    },

    LISTEN_FOR_CONTENT_CHANGE: ({
      id,
      markdown,
      wordCount,
      cursor,
      muyaIndexCursor,
      history,
      toc,
      blocks
    }) => {
      if (!id) {
        throw new Error('Listen for document change but id was not set!')
      }
      if (get().tabs.length === 0) return

      const index = get().tabIdToIndex[id]
      if (index === undefined) {
        // 源编辑器持有一个已关闭标签的陈旧 id —— 安全忽略
        return
      }
      const tab = get().tabs[index]
      if (!tab) return

      const { filename, pathname, markdown: oldMarkdown, trimTrailingNewline } = tab
      const nextMarkdown = adjustTrailingNewlines(markdown, trimTrailingNewline)

      if (oldMarkdown.length === 0 && nextMarkdown.length === 1 && nextMarkdown[0] === '\n') {
        updateTab(id, (next) => {
          next.markdown = nextMarkdown
        })
        return
      }

      let isDirty = false
      updateTab(id, (next) => {
        next.markdown = nextMarkdown
        if (wordCount) next.wordCount = wordCount
        if (cursor) next.cursor = cursor
        if (muyaIndexCursor) next.muyaIndexCursor = muyaIndexCursor
        if (history) next.history = history
        if (blocks) next.blocks = blocks

        const lastEditIndex = next.history.lastEditIndex
        const editEntry =
          typeof lastEditIndex === 'number' && lastEditIndex >= 0
            ? next.history.stack[lastEditIndex]
            : undefined
        const historyMarksDirty =
          (typeof lastEditIndex === 'number' &&
            lastEditIndex >= 0 &&
            editEntry !== undefined &&
            editEntry.id !== next.lastSavedHistoryId) ||
          // 撤销回原始内容（lastEditIndex === -1）时与 lastInitIndex 比较
          (lastEditIndex === -1 &&
            next.lastSavedHistoryId !== -1 &&
            next.lastSavedHistoryId !== next.history.lastInitIndex)

        isDirty = history === undefined ? nextMarkdown !== oldMarkdown : historyMarksDirty
        if (isDirty) {
          next.isSaved = false
        } else if (history !== undefined && next.lastSavedHistoryId !== -1) {
          // 防止覆盖恢复的 isSaved 状态（撤销可能触发）
          next.isSaved = true
        }
      })

      // 仅当前文件更新 TOC（内容未变化时跳过）
      if (id === get().currentFile?.id && toc && !equal(toc, get().listToc)) {
        set({ listToc: toc, toc: listToTree(toc) })
      }

      if (isDirty && pathname) {
        const { autoSave } = usePreferencesStore.getState()
        if (autoSave) {
          const tabAfter = get().tabs[index]
          if (tabAfter) {
            get().HANDLE_AUTO_SAVE({
              id,
              filename,
              pathname,
              markdown: nextMarkdown,
              options: getOptionsFromState(tabAfter)
            })
          }
        }
      }
    },

    // ------------------------------------------------------------------
    // 文件外部变更（fs://change）
    // ------------------------------------------------------------------

    loadChange: (change) => {
      const { tabs, currentFile } = get()
      const { data, pathname } = change
      const {
        isMixedLineEndings,
        lineEnding,
        adjustLineEndingOnSave,
        trimTrailingNewline,
        encoding,
        markdown,
        filename
      } = data

      const newFileState = createDocumentState({
        markdown,
        filename,
        pathname,
        encoding,
        lineEnding,
        adjustLineEndingOnSave,
        trimTrailingNewline
      })

      const tab = tabs.find((f) => f.pathname === pathname)
      if (!tab) {
        console.error('loadChange: Cannot find tab in tab list.')
        void notice.notify({
          title: t('store.editor.errorLoadingTabTitle'),
          message: t('store.editor.errorLoadingTabMessage'),
          type: 'error',
          time: 20000,
          showConfirm: false
        })
        return
      }

      // 备份部分条目（id / 通知 / 滚动位置 / 撤销栈）后整体替换
      const oldId = tab.id
      const oldNotifications = tab.notifications
      const oldScrollTop = tab.scrollTop
      let oldHistory: FileHistory | null = null
      const histIndex = tab.history.index
      if (histIndex >= 0 && tab.history.stack.length >= 1) {
        const entry = tab.history.stack[histIndex]
        if (entry) {
          // 允许撤销回旧文档
          oldHistory = { stack: [entry], index: 0 }
        }
      }

      updateTab(oldId, (next) => {
        Object.assign(next, newFileState)
        next.id = oldId
        next.notifications = oldNotifications
        next.scrollTop = oldScrollTop
        if (oldHistory) next.history = oldHistory
      })

      if (isMixedLineEndings && typeof lineEnding === 'string') {
        pushTabNotification({
          tabId: oldId,
          msg: t('store.editor.mixedLineEndingsNormalized', {
            name: filename,
            lineEnding: lineEnding.toUpperCase()
          }),
          showConfirm: false,
          style: 'info',
          exclusiveType: ''
        })
      }

      // 正在编辑的标签被外部重载 —— 通知编辑器引擎重载内容
      if (currentFile && pathname === currentFile.pathname) {
        const { id, cursor, history, scrollTop, muyaIndexCursor } = newFileState
        bus.emit('file-changed', {
          id,
          markdown,
          muyaIndexCursor,
          cursor,
          renderCursor: true,
          history,
          scrollTop,
          isReload: true
        })
      }
    },

    /** 处理 fs://change 事件（{ kind, paths }）—— 对打开标签做重载或提醒 */
    handleFsChange: async (payload) => {
      const { kind, paths } = payload
      const { autoSave } = usePreferencesStore.getState()

      for (const pathname of paths) {
        const tab = get().tabs.find((f) => f.pathname === pathname)
        if (!tab) continue

        const { id, isSaved, filename } = tab
        const reloadFromDisk = async (): Promise<void> => {
          const result = await readFile(pathname).catch(() => null)
          if (result) {
            get().loadChange({
              pathname,
              data: {
                markdown: result.content,
                filename: basename(pathname),
                encoding: { encoding: result.encoding, isBom: false }
              }
            })
          }
        }

        switch (kind) {
          case 'remove': {
            updateTab(id, (next) => {
              next.isSaved = false
            })
            pushTabNotification({
              tabId: id,
              msg: t('store.editor.fileRemovedOnDisk', { name: filename }),
              style: 'warn',
              showConfirm: false,
              exclusiveType: 'file_changed'
            })
            break
          }
          case 'create':
          case 'modify': {
            if (autoSave && isSaved) {
              // 自动保存开启且标签干净 —— 直接静默重载
              await reloadFromDisk()
              break
            }
            updateTab(id, (next) => {
              next.isSaved = false
            })
            pushTabNotification({
              tabId: id,
              msg: t('store.editor.fileChangedOnDisk', { name: filename }),
              showConfirm: true,
              exclusiveType: 'file_changed',
              action: (status) => {
                if (status) {
                  void reloadFromDisk()
                }
              }
            })
            break
          }
          default:
            break
        }
      }
    },

    // ------------------------------------------------------------------
    // 会话快照
    // ------------------------------------------------------------------

    CREATE_BUFFERED_STATE: () => {
      const { tabs, currentFile } = get()
      return {
        currentFileId: currentFile?.id ?? null,
        tabs: tabs.map((tab) => ({
          id: tab.id,
          pathname: tab.pathname,
          filename: tab.filename,
          markdown: tab.markdown,
          isSaved: tab.isSaved,
          encoding: tab.encoding,
          lineEnding: tab.lineEnding,
          trimTrailingNewline: tab.trimTrailingNewline,
          adjustLineEndingOnSave: tab.adjustLineEndingOnSave,
          cursor: tab.cursor,
          wordCount: tab.wordCount,
          muyaIndexCursor: tab.muyaIndexCursor,
          scrollTop: tab.scrollTop
        }))
      }
    },

    RESTORE_BUFFERED_STATE: (state) => {
      const raw = state as BufferedEditorState | null | undefined
      if (!raw || !Array.isArray(raw.tabs)) {
        console.error('RESTORE_BUFFERED_STATE: Invalid editor buffer state.')
        return
      }

      const oldIdToNewId: Record<string, string> = {}
      const tabs = raw.tabs.map((tab) => {
        const fileState = createDocumentState(tab as unknown as Record<string, unknown>)
        oldIdToNewId[tab.id] = fileState.id
        return fileState
      })

      const currentFileId = raw.currentFileId ? oldIdToNewId[raw.currentFileId] : undefined
      const currentFile = tabs.find((tab) => tab.id === currentFileId) ?? null

      set({ tabs, currentFile, tabIdToIndex: computeTabIdToIndex(tabs), listToc: [], toc: [] })
    }
  }
})

// ---------------------------------------------------------------------------
// 事件监听 —— 一次性注册（App 挂载时调用），返回清理函数
// ---------------------------------------------------------------------------

/** 归一化 'open-new-tab' 事件载荷（可能是包装对象或直接的 MarkdownDocument） */
const normalizeOpenNewTabPayload = (
  payload: unknown
): { markdownDocument: MarkdownDocument | null; options: TabOptions; selected?: boolean } => {
  if (payload && typeof payload === 'object') {
    const p = payload as Record<string, unknown>
    if (typeof p.markdownDocument === 'object' || p.markdownDocument === null) {
      return {
        markdownDocument: (p.markdownDocument as MarkdownDocument) ?? null,
        options: (p.options as TabOptions) ?? {},
        selected: p.selected as boolean | undefined
      }
    }
    if (typeof p.pathname === 'string' || typeof p.markdown === 'string') {
      return { markdownDocument: p as unknown as MarkdownDocument, options: {}, selected: true }
    }
  }
  return { markdownDocument: null, options: {}, selected: true }
}

export const registerListeners = async (): Promise<() => void> => {
  if (registered) return () => {}
  registered = true
  const fns: Array<() => void> = []
  disposeFns = fns

  const editor = useEditorStore

  /** 便捷注册：Tauri event → handler，handler 内通过 store.getState() 取最新状态 */
  const onEvent = <T>(event: string, handler: (payload: T) => void): void => {
    listen<T>(event, (e) => handler(e.payload))
      .then((un) => fns.push(un))
      .catch((err) => {
        console.warn(`[editor] 监听事件 ${event} 失败`, err)
      })
  }

  const onBus = (event: string, handler: (payload?: unknown) => void): void => {
    // mitt 的 on 返回 void（无退订），仅注册
    bus.on(event, handler)
  }

  // ---- 保存 / 另存为（后端菜单事件 + 命令中心 bus 通道）----
  onEvent('editor-ask-file-save', () => {
    void editor.getState().FILE_SAVE()
  })
  onBus('mt::editor-ask-file-save', () => {
    void editor.getState().FILE_SAVE()
  })

  onEvent('editor-ask-file-save-as', () => {
    void editor.getState().FILE_SAVE_AS()
  })
  onBus('mt::editor-ask-file-save-as', () => {
    void editor.getState().FILE_SAVE_AS()
  })

  // ---- 关闭标签 ----
  onEvent('editor-close-tab', () => {
    editor.getState().CLOSE_TAB()
  })
  onBus('mt::editor-close-tab', () => {
    editor.getState().CLOSE_TAB()
  })

  // ---- 新建标签 ----
  onEvent('open-new-tab', (payload) => {
    const { markdownDocument, options, selected } = normalizeOpenNewTabPayload(payload)
    if (markdownDocument) {
      editor.getState().NEW_TAB_WITH_CONTENT({ markdownDocument, options, selected })
    } else {
      editor.getState().NEW_UNTITLED_TAB({})
    }
  })
  onEvent('new-untitled-tab', (payload) => {
    const p = (payload ?? {}) as { selected?: boolean; markdown?: string }
    editor.getState().NEW_UNTITLED_TAB({ markdown: p.markdown ?? '', selected: p.selected })
  })
  onBus('mt::new-untitled-tab', (payload) => {
    const p = (payload ?? {}) as { selected?: boolean; markdown?: string }
    editor.getState().NEW_UNTITLED_TAB({ markdown: p.markdown ?? '', selected: p.selected })
  })

  // ---- 标签循环 / 按索引切换 ----
  onEvent('tabs-cycle-left', () => {
    editor.getState().CYCLE_TABS(false)
  })
  onBus('mt::tabs-cycle-left', () => {
    editor.getState().CYCLE_TABS(false)
  })
  onEvent('tabs-cycle-right', () => {
    editor.getState().CYCLE_TABS(true)
  })
  onBus('mt::tabs-cycle-right', () => {
    editor.getState().CYCLE_TABS(true)
  })
  onEvent('switch-tab-by-index', (index) => {
    editor.getState().SWITCH_TAB_BY_INDEX(Number(index))
  })

  // ---- 文件系统变更（fs://change）----
  onEvent<{ kind: string; paths: string[] }>('fs://change', (payload) => {
    void editor.getState().handleFsChange(payload)
  })

  // ---- 启动引导 ----
  onEvent<Record<string, unknown>>('bootstrap-editor', (config) => {
    const c = config as {
      addBlankTab?: boolean
      markdownList?: string[]
      lineEnding?: string
      sideBarVisibility?: boolean
      tabBarVisibility?: boolean
      sourceCodeModeEnabled?: boolean
    }

    useMainStore.getState().SET_INITIALIZED()
    usePreferencesStore.getState().SET_USER_PREFERENCE({ endOfLine: c.lineEnding ?? 'default' })
    useLayoutStore.getState().SET_LAYOUT({
      rightColumn: 'files',
      showSideBar: !!c.sideBarVisibility,
      showTabBar: !!c.tabBarVisibility
    })
    usePreferencesStore.getState().SET_MODE({
      type: 'sourceCode',
      checked: !!c.sourceCodeModeEnabled
    })

    if (c.addBlankTab) {
      editor.getState().NEW_UNTITLED_TAB({ selected: true })
    } else if (Array.isArray(c.markdownList) && c.markdownList.length) {
      let isFirst = true
      for (const md of c.markdownList) {
        editor.getState().NEW_UNTITLED_TAB({ markdown: md, selected: isFirst })
        isFirst = false
      }
    }
  })

  // ---- 会话恢复 ----
  onEvent('load-state', (state) => {
    editor.getState().RESTORE_BUFFERED_STATE(state)
  })

  // ---- 上下文菜单 ----
  onEvent('cm-copy-as-rich', () => bus.emit('copyAsRich', 'copyAsRich'))
  onEvent('cm-copy-as-html', () => bus.emit('copyAsHtml', 'copyAsHtml'))
  onEvent('cm-paste-as-plain-text', () => bus.emit('pasteAsPlainText', 'pasteAsPlainText'))
  onEvent('cm-insert-paragraph', (location) => bus.emit('insertParagraph', location))

  return () => {
    fns.forEach((fn) => fn())
    fns.length = 0
    registered = false
  }
}

/** 手动清理所有已注册监听（一般由 registerListeners 返回的函数负责） */
export const disposeListeners = (): void => {
  disposeFns.forEach((fn) => fn())
  disposeFns = []
  registered = false
}
