// 项目（侧边栏文件树）store —— 对齐 marktext store/project.ts，适配 Tauri 命令。
// 树节点结构：{ name, path, isDirectory, children?, opened? }（本工程自有形状）。
import { create } from 'zustand'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import bus from '../bus'
import { listDir, mkdir, pathExists, renamePath, writeFile } from '../lib/tauri'
import { useLayoutStore } from './layout'
import { useEditorStore } from './editor'
import { usePreferencesStore } from './preferences'
import notice from '../services/notification'

export interface TreeNode {
  name: string
  path: string
  isDirectory: boolean
  children?: TreeNode[]
  opened?: boolean
}

export type ProjectTree = TreeNode | null

interface ClipboardEntry {
  type: 'copy' | 'cut' | string
  src: string
  dest?: string
}

interface CreateCacheEntry {
  dirname: string
  type: 'file' | 'directory' | string
}

const PATH_SEPARATOR = '\\' // Windows 平台

/** 递归构建深度上限，避免巨目录导致大量 list_dir 往返 */
const MAX_DEPTH = 10

const basename = (p: string): string => {
  const normalized = p.replace(/\\/g, '/')
  const parts = normalized.split('/')
  return parts[parts.length - 1] || p
}

const dirname = (p: string): string => {
  const normalized = p.replace(/\\/g, '/')
  const i = normalized.lastIndexOf('/')
  return i < 0 ? p : normalized.substring(0, i)
}

const hasMarkdownExtension = (name: string): boolean => /\.(md|mdx|markdown|mdown|mkd)$/i.test(name)

const buildTree = async (path: string, depth = 0): Promise<TreeNode> => {
  const node: TreeNode = {
    name: basename(path) || path,
    path,
    isDirectory: true,
    opened: true,
    children: []
  }
  if (depth >= MAX_DEPTH) {
    console.warn(`[project] 目录过深（超过 ${MAX_DEPTH} 层），停止展开: ${path}`)
    return node
  }

  try {
    const entries = await listDir(path)
    node.children = await Promise.all(
      entries.map(async (e) => {
        if (e.is_dir) {
          return buildTree(e.path, depth + 1)
        }
        return { name: e.name, path: e.path, isDirectory: false }
      })
    )
  } catch (err) {
    console.error(`[project] list_dir 失败: ${path}`, err)
  }
  return node
}

/** 重新列出某个目录并替换其子树（保持 opened 状态），用于文件系统事件刷新 */
const refreshDirectory = async (dirPath: string, root: TreeNode): Promise<void> => {
  const find = (node: TreeNode): TreeNode | null => {
    if (node.path === dirPath) return node
    for (const child of node.children ?? []) {
      if (child.isDirectory) {
        const hit = find(child)
        if (hit) return hit
      }
    }
    return null
  }
  const target = find(root)
  if (!target) return
  const entries = await listDir(dirPath).catch(() => [])
  const wasOpened = !!target.opened
  const next = await buildTree(dirPath)
  target.children = next.children
  target.opened = wasOpened
}

interface ProjectState {
  projectTree: ProjectTree
  activeItem: Record<string, unknown> | null
  clipboard: ClipboardEntry | null
  createCache: CreateCacheEntry | Record<string, never>
  renameCache: string | null
  /** 打开项目：list_dir 建树 + 布局联动 + 持久化 lastOpenedFolder */
  OPEN_PROJECT: (path: string) => Promise<void>
  /** 监听 Tauri event 'update-object-tree' 刷新受影响目录子树 */
  LISTEN_FOR_UPDATE_PROJECT: () => Promise<UnlistenFn>
  /** 新建文件/目录（配合 bus 'SIDEBAR::new' 设定的缓存） */
  CREATE_FILE_DIRECTORY: (name: string) => Promise<void>
  /** 侧边栏重命名（配合 bus 'SIDEBAR::rename' 设定的缓存），并同步打开的标签页 */
  RENAME_IN_SIDEBAR: (name: string) => Promise<void>
  CHANGE_ACTIVE_ITEM: (item: Record<string, unknown> | null) => void
  CHANGE_CLIPBOARD: (data: ClipboardEntry | null) => void
  /** 侧边栏上下文菜单 bus 事件：新建 / 重命名 / 复制剪切 */
  LISTEN_FOR_SIDEBAR_CONTEXT_MENU: () => void
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projectTree: null,
  activeItem: {},
  clipboard: null,
  createCache: {},
  renameCache: null,

  OPEN_PROJECT: async (path) => {
    const tree = await buildTree(path)
    set({ projectTree: tree })

    useLayoutStore.getState().SET_LAYOUT({
      rightColumn: 'files',
      showSideBar: true,
      showTabBar: true
    })

    // 持久化最近打开的文件夹（Rust 端 last_workspace 字段）
    usePreferencesStore.getState().SET_SINGLE_PREFERENCE('lastOpenedFolder', path)
  },

  LISTEN_FOR_UPDATE_PROJECT: async () => {
    return listen<{ type: string; change: { pathname?: string } }>('update-object-tree', (e) => {
      const { projectTree } = get()
      if (!projectTree) return
      const { change } = e.payload ?? {}
      const pathname = change?.pathname
      if (!pathname) return

      // 事件只携带变化的路径；重列其父目录子树即可保持一致
      // （文件与目录事件统一取 dirname(pathname)，因为变化项本身可能已不存在）
      const parentDir = dirname(pathname)
      void refreshDirectory(parentDir, projectTree).then(() => {
        // zustand 原地修改不会触发重渲染，重建引用
        set({ projectTree: { ...projectTree } })
      })
    })
  },

  CREATE_FILE_DIRECTORY: async (name) => {
    const cache = get().createCache as CreateCacheEntry
    const { dirname: parentDir, type } = cache
    if (!parentDir || !type) {
      console.warn('[project] CREATE_FILE_DIRECTORY 缺少缓存（未先触发 SIDEBAR::new）')
      return
    }

    let fileName = name
    if (type === 'file' && !hasMarkdownExtension(fileName)) {
      fileName += '.md'
    }
    const fullName = `${parentDir}${PATH_SEPARATOR}${fileName}`

    // 已存在则拒绝，避免静默覆盖
    if (await pathExists(fullName)) {
      set({ createCache: {} })
      void notice.notify({
        title: 'Error in Side Bar',
        type: 'error',
        message: `A ${type} named "${fileName}" already exists in this folder.`
      })
      return
    }

    try {
      if (type === 'file') {
        await writeFile(fullName, '')
      } else {
        await mkdir(fullName)
      }
      set({ createCache: {} })
      // 文件事件（update-object-tree）到达后由编辑器 store 打开新文件
    } catch (err) {
      void notice.notify({
        title: 'Error in Side Bar',
        type: 'error',
        message: err instanceof Error ? err.message : String(err)
      })
    }
  },

  RENAME_IN_SIDEBAR: async (name) => {
    const src = get().renameCache
    if (!src) return
    const dest = `${dirname(src)}${PATH_SEPARATOR}${name}`
    try {
      await renamePath(src, dest)
      // 同步已打开标签页的 pathname / filename
      useEditorStore.getState().RENAME_IF_NEEDED({ src, dest })
      set({ renameCache: null })
    } catch (err) {
      void notice.notify({
        title: 'Error in Side Bar',
        type: 'error',
        message: err instanceof Error ? err.message : String(err)
      })
    }
  },

  CHANGE_ACTIVE_ITEM: (item) => set({ activeItem: item }),

  CHANGE_CLIPBOARD: (data) => set({ clipboard: data }),

  LISTEN_FOR_SIDEBAR_CONTEXT_MENU: () => {
    bus.on('SIDEBAR::new', (type) => {
      const { activeItem } = get()
      const item = activeItem as Record<string, unknown> | null
      const pathname = (item?.path as string) ?? ''
      const isDirectory = !!item?.isDirectory
      const dir = isDirectory ? pathname : dirname(pathname)
      set({ createCache: { dirname: dir, type: String(type) } })
      bus.emit('SIDEBAR::show-new-input')
    })

    bus.on('SIDEBAR::rename', () => {
      const { activeItem } = get()
      set({ renameCache: ((activeItem as Record<string, unknown>)?.path as string) ?? null })
      bus.emit('SIDEBAR::show-rename-input')
    })

    bus.on('SIDEBAR::copy-cut', (type) => {
      const { activeItem } = get()
      const src = (activeItem as Record<string, unknown>)?.path as string
      set({ clipboard: { type: String(type), src } })
    })
  }
}))

// 供其他模块在运行时获取 store（避免顶层解构造成循环引用求值问题）
export const getProjectStore = (): typeof useProjectStore => useProjectStore
