// 布局 store —— 侧边栏 / 标签栏可见性与宽度。
// 对齐 marktext store/layout.ts；侧边栏宽度沿用 localStorage 持久化。
import { create } from 'zustand'
import { usePreferencesStore } from './preferences'

export type RightColumn = 'files' | 'search' | 'toc' | ''

export interface LayoutPartial {
  rightColumn?: RightColumn
  showSideBar?: boolean
  showTabBar?: boolean
  sideBarWidth?: number | string
}

export interface BufferedLayout {
  rightColumn: RightColumn | undefined
  showSideBar: boolean
  showTabBar: boolean
  sideBarWidth: number
}

const normalizeSideBarWidth = (width: unknown): number => {
  const numericWidth = Number(width)
  return Number.isFinite(numericWidth) ? Math.max(numericWidth, 220) : 280
}

const createBufferedLayoutState = (state: unknown): BufferedLayout | null => {
  if (!state || typeof state !== 'object') return null
  const s = state as LayoutPartial
  return {
    rightColumn: s.rightColumn,
    showSideBar: !!s.showSideBar,
    showTabBar: !!s.showTabBar,
    sideBarWidth: normalizeSideBarWidth(s.sideBarWidth)
  }
}

const initialSideBarWidth = normalizeSideBarWidth(localStorage.getItem('side-bar-width'))

interface LayoutState extends LayoutPartial {
  rightColumn: RightColumn
  showSideBar: boolean
  showTabBar: boolean
  sideBarWidth: number
  SET_LAYOUT: (layout: LayoutPartial) => void
  SET_SIDE_BAR_WIDTH: (width: number | string) => void
  TOGGLE_LAYOUT_ENTRY: (entryName: 'showSideBar' | 'showTabBar') => void
  CREATE_BUFFERED_STATE: () => BufferedLayout | null
  RESTORE_BUFFERED_STATE: (state: unknown) => void
}

export const useLayoutStore = create<LayoutState>((set, get) => ({
  rightColumn: 'files',
  showSideBar: false,
  showTabBar: false,
  sideBarWidth: initialSideBarWidth,

  SET_LAYOUT: (layout) => {
    const next: Partial<LayoutState> = {}
    // 侧边栏可见性需要持久化到偏好（与后端 show_file_tree 联动）
    if (layout.showSideBar !== undefined) {
      next.showSideBar = !!layout.showSideBar
      usePreferencesStore.getState().SET_SINGLE_PREFERENCE('sideBarVisibility', next.showSideBar)
    }
    if (layout.rightColumn !== undefined) next.rightColumn = layout.rightColumn
    if (layout.showTabBar !== undefined) next.showTabBar = !!layout.showTabBar
    if (layout.sideBarWidth !== undefined) {
      next.sideBarWidth = layout.sideBarWidth as number
    }
    set(next)
  },

  SET_SIDE_BAR_WIDTH: (width) => {
    const normalizedWidth = normalizeSideBarWidth(width)
    localStorage.setItem('side-bar-width', String(normalizedWidth))
    set({ sideBarWidth: normalizedWidth })
  },

  TOGGLE_LAYOUT_ENTRY: (entryName) => {
    if (entryName === 'showSideBar') {
      const showSideBar = !get().showSideBar
      set({ showSideBar })
      usePreferencesStore.getState().SET_SINGLE_PREFERENCE('sideBarVisibility', showSideBar)
    } else if (entryName === 'showTabBar') {
      set({ showTabBar: !get().showTabBar })
    }
  },

  CREATE_BUFFERED_STATE: () =>
    createBufferedLayoutState({
      rightColumn: get().rightColumn,
      showSideBar: get().showSideBar,
      showTabBar: get().showTabBar,
      sideBarWidth: get().sideBarWidth
    }),

  RESTORE_BUFFERED_STATE: (state) => {
    const layout = createBufferedLayoutState(state)
    if (!layout) return
    get().SET_SIDE_BAR_WIDTH(layout.sideBarWidth)
    get().SET_LAYOUT({
      rightColumn: layout.rightColumn,
      showSideBar: layout.showSideBar,
      showTabBar: layout.showTabBar
    })
  }
}))

/**
 * 实际渲染的侧边栏宽度：`sideBarWidth` 是右侧栏宽度（≥220），
 * 当 `rightColumn` 为空时侧边栏收窄为 45px 图标条；未显示时返回 0。
 * 消费方（需要从视口宽度中扣除侧边栏）应使用此函数而非裸 sideBarWidth。
 */
export const selectEffectiveSideBarWidth = (s: Pick<LayoutState, 'showSideBar' | 'rightColumn' | 'sideBarWidth'>): number => {
  if (!s.showSideBar) return 0
  if (!s.rightColumn) return 45
  return s.sideBarWidth
}
