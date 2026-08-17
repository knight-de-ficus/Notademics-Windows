// 主 store —— 平台 / 应用版本 / 窗口激活态 / 初始化标记。
// 对齐 marktext store/index.ts；窗口事件改用 Tauri event 监听。
import { create } from 'zustand'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'

/** 从 UA 推断平台（渲染进程无 Node process） */
const detectPlatform = (): string => {
  const ua = navigator.userAgent
  if (/windows/i.test(ua)) return 'win32'
  if (/mac os/i.test(ua)) return 'darwin'
  if (/linux/i.test(ua)) return 'linux'
  return typeof navigator.platform === 'string' ? navigator.platform : ''
}

interface MainState {
  platform: string
  appVersion: string
  /** 当前窗口是否处于激活/聚焦状态 */
  windowActive: boolean
  /** 应用是否已完成初始化（bootstrap-editor 事件） */
  init: boolean
  SET_WIN_STATUS: (status: boolean) => void
  SET_INITIALIZED: () => void
  /** 监听 Tauri event 'window-active-status'（payload: { status: boolean }），返回取消函数 */
  LISTEN_WIN_STATUS: () => Promise<UnlistenFn>
}

export const useMainStore = create<MainState>((set) => ({
  platform: detectPlatform(),
  // 后端暂无版本查询命令，后续可由主代理补充 invoke('get_app_version')
  appVersion: '',
  windowActive: true,
  init: false,

  SET_WIN_STATUS: (status) => set({ windowActive: status }),

  SET_INITIALIZED: () => set({ init: true }),

  LISTEN_WIN_STATUS: async () =>
    listen<{ status?: boolean }>('window-active-status', (e) => {
      // 后端按 IPC 契约发送 `{ status: boolean }` —— 在边界处收窄
      set({ windowActive: !!e.payload?.status })
    })
}))
