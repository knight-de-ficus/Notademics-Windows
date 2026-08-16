// 通知 store —— 监听后端 'show-notification' 事件并转调 notification 服务。
import { create } from 'zustand'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import notice, { type NotifyOptions } from '../services/notification'
import { t } from '../i18n'

interface NotificationState {
  /** 注册监听（App 挂载时调用），返回取消函数 */
  listenForNotification: () => Promise<UnlistenFn>
}

export const useNotificationStore = create<NotificationState>(() => ({
  listenForNotification: async () => {
    const DEFAULT_OPTS = {
      title: t('notifications.defaultTitle'),
      type: 'primary' as const,
      time: 10000,
      message: t('notifications.defaultMessage')
    }

    return listen<Partial<NotifyOptions>>('show-notification', (e) => {
      const options = Object.assign({ ...DEFAULT_OPTS }, e.payload ?? {})
      void notice.notify(options)
    })
  }
}))
