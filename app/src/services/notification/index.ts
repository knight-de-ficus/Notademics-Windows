// 通知服务 —— 移植 marktext src/services/notification/index.ts。
// DOM 实现：把模板渲染进一个 div 并插入 body，支持 hover 荧光效果、确认模式与自动关闭。
// 样式见 src/styles/marktext/notification.css（复制自 marktext services/notification/index.css）。
import '../../styles/marktext/notification.css'

export type NotificationType = 'primary' | 'error' | 'warning' | 'info'

const ICON_HASH: Record<NotificationType, string> = {
  primary: 'icon-message',
  error: 'icon-error',
  warning: 'icon-warn',
  info: 'icon-info'
}
const TYPE_HASH: Record<NotificationType, string> = {
  primary: 'mt-primary',
  error: 'mt-error',
  warning: 'mt-warn',
  info: 'mt-info'
}

/** 模板中的图标符号需要全局 icon sprite（marktext 由 iconfont 提供）；缺失时仅图标不显示 */
const TEMPLATE = `
<div class="mt-notification">
  <div class="notice-bg"></div>
  <div class="fluent-container">
    <div class="fluent"></div>
  </div>
  <div class="content">
    <div class="title">
      <div class="icon-wrapper">
        <svg class="icon" aria-hidden="true">
          <use xlink:href="#{{icon}}"></use>
        </svg>
      </div>
      <span>{{title}}</span>
      <svg class="icon close" aria-hidden="true">
        <use xlink:href="#icon-close"></use>
      </svg>
    </div>
    <div class="body">
      <div class="left-text">{{message}}</div>
      <div class="confirm icon-wrapper">
        <svg class="icon" aria-hidden="true">
          <use xlink:href="#icon-confirm"></use>
        </svg>
      </div>
    </div>
  </div>
</div>`

/** 最小化 HTML 转义，防止通知文案注入脚本 */
const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const fillTemplate = (type: NotificationType, title: string, message: string): string =>
  TEMPLATE.replace('{{icon}}', ICON_HASH[type])
    .replace('{{title}}', escapeHtml(title))
    .replace('{{message}}', escapeHtml(message))

export interface NotifyOptions {
  time?: number
  title?: string
  message?: string
  type?: NotificationType
  showConfirm?: boolean
}

interface NoticeCacheEntry {
  remove: () => void
}

interface NotificationService {
  name: string
  noticeCache: Record<string, NoticeCacheEntry>
  clear(): void
  notify(opts: NotifyOptions): Promise<void>
}

let noticeId = 0
const getUniqueId = (): string => `nt-${Date.now()}-${noticeId++}`

const notification: NotificationService = {
  name: 'notify',
  noticeCache: {},

  clear() {
    Object.keys(this.noticeCache).forEach((key) => {
      this.noticeCache[key].remove()
    })
  },

  notify({
    time = 10000,
    title = '',
    message = '',
    type = 'primary',
    showConfirm = false
  }: NotifyOptions): Promise<void> {
    let resolveFn: (() => void) | undefined
    let rejectFn: (() => void) | undefined
    let timer: ReturnType<typeof setTimeout> | null = null
    const id = getUniqueId()

    const fragment = document.createElement('div')
    fragment.innerHTML = fillTemplate(type, title, message)

    const noticeContainer = fragment.querySelector('.mt-notification') as HTMLElement
    const bgNotice = noticeContainer.querySelector('.notice-bg') as HTMLElement
    const contentContainer = noticeContainer.querySelector('.content') as HTMLElement
    const fluent = noticeContainer.querySelector('.fluent') as HTMLElement
    const close = noticeContainer.querySelector('.close') as HTMLElement
    const { offsetHeight } = noticeContainer
    let target: HTMLElement = noticeContainer

    if (showConfirm) {
      noticeContainer.classList.add('mt-confirm')
      target = noticeContainer.querySelector('.confirm') as HTMLElement
    }

    noticeContainer.classList.add(TYPE_HASH[type])
    contentContainer.classList.add(TYPE_HASH[type])
    bgNotice.classList.add(TYPE_HASH[type])

    fluent.style.height = `${offsetHeight * 2}px`
    fluent.style.width = `${offsetHeight * 2}px`

    const setCloseTimer = (): void => {
      if (typeof time === 'number' && time > 0) {
        timer = setTimeout(() => {
          remove()
        }, time)
      }
    }

    const mousemoveHandler = (event: MouseEvent): void => {
      const { left, top } = noticeContainer.getBoundingClientRect()
      const x = event.pageX
      const y = event.pageY
      fluent.style.left = `${x - left}px`
      fluent.style.top = `${y - top}px`
      fluent.style.opacity = '1'
      fluent.style.height = `${noticeContainer.offsetHeight * 2}px`
      fluent.style.width = `${noticeContainer.offsetHeight * 2}px`
      if (timer) clearTimeout(timer)
    }

    const mouseleaveHandler = (_event: MouseEvent): void => {
      fluent.style.opacity = '0'
      fluent.style.height = `${noticeContainer.offsetHeight * 4}px`
      fluent.style.width = `${noticeContainer.offsetHeight * 4}px`
      if (timer) clearTimeout(timer)
      setCloseTimer()
    }

    const clickHandler = (event: MouseEvent): void => {
      event.preventDefault()
      event.stopPropagation()
      remove()
      resolveFn?.()
    }

    const closeHandler = (event: MouseEvent): void => {
      event.preventDefault()
      event.stopPropagation()
      remove()
      rejectFn?.()
    }

    const rePositionNotices = (): void => {
      const notices = document.querySelectorAll('.mt-notification')
      let hx = 0
      for (let i = 0; i < notices.length; i++) {
        const el = notices[i] as HTMLElement
        el.style.transform = `translate(0, -${hx}px)`
        el.style.zIndex = String(10000 - i)
        hx += el.offsetHeight + 10
      }
    }

    const remove = (): void => {
      fluent.style.filter = 'blur(10px)'
      fluent.style.opacity = '0'
      fluent.style.height = `${noticeContainer.offsetHeight * 5}px`
      fluent.style.width = `${noticeContainer.offsetHeight * 5}px`

      noticeContainer.style.opacity = '0'
      noticeContainer.style.right = '-400px'

      setTimeout(() => {
        noticeContainer.removeEventListener('mousemove', mousemoveHandler)
        noticeContainer.removeEventListener('mouseleave', mouseleaveHandler)
        target.removeEventListener('click', clickHandler)
        close.removeEventListener('click', closeHandler)
        noticeContainer.remove()
        rePositionNotices()
        if (notification.noticeCache[id]) {
          delete notification.noticeCache[id]
        }
      }, 100)
    }

    notification.noticeCache[id] = { remove }

    noticeContainer.addEventListener('mousemove', mousemoveHandler)
    noticeContainer.addEventListener('mouseleave', mouseleaveHandler)
    target.addEventListener('click', clickHandler)
    close.addEventListener('click', closeHandler)

    setTimeout(() => {
      bgNotice.style.width = `${noticeContainer.offsetWidth * 3.5}px`
      bgNotice.style.height = `${noticeContainer.offsetWidth * 3.5}px`
      rePositionNotices()
    }, 50)

    setCloseTimer()

    document.body.prepend(noticeContainer)

    return new Promise<void>((resolve, reject) => {
      resolveFn = resolve
      rejectFn = reject
    })
  }
}

export default notification
