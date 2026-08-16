export interface CancellablePromise<T> extends Promise<T> {
  cancel: () => void
}

export const delay = (time: number): CancellablePromise<void> => {
  let timerId: ReturnType<typeof setTimeout> | null
  let rejectFn: ((reason?: unknown) => void) | null
  const p = new Promise<void>((resolve, reject) => {
    rejectFn = reject
    timerId = setTimeout(() => {
      ;(p as CancellablePromise<void>).cancel = () => {}
      rejectFn = null
      resolve()
    }, time)
  }) as CancellablePromise<void>

  p.cancel = () => {
    if (timerId) clearTimeout(timerId)
    timerId = null
    if (rejectFn) rejectFn()
    rejectFn = null
  }
  return p
}

const ID_PREFIX = 'mt-'
let id = 0

export interface Cursor {
  line: number
  ch: number
}

type GetLineFn = (line: number) => string | undefined

const getNearestAvailableCursor = (
  cursor: Cursor,
  getLine: GetLineFn | undefined,
  lineCount: number
): Cursor => {
  if (typeof getLine === 'function' && lineCount > 0) {
    const currentLine = Math.min(Math.max(cursor.line, 0), lineCount - 1)
    const currentText = getLine(currentLine)

    if (typeof currentText === 'string' && /\S/.test(currentText)) {
      return {
        line: currentLine,
        ch: Math.min(cursor.ch, currentText.length)
      }
    }

    for (let distance = 1; distance < lineCount; distance++) {
      const candidates = [currentLine - distance, currentLine + distance]

      for (const lineNumber of candidates) {
        const text = getLine(lineNumber)

        if (typeof text === 'string' && /\S/.test(text)) {
          return {
            line: lineNumber,
            ch: lineNumber < currentLine ? text.length : 0
          }
        }
      }
    }
  }

  return {
    line: Math.max(cursor.line, 0),
    ch: 0
  }
}

export const adjustCursor = (
  cursor: Cursor,
  preline: string | undefined,
  line: string | undefined,
  nextline: string | undefined,
  getLine?: GetLineFn,
  lineCount = 0
): Cursor => {
  // 光标位于空白行或不可用行时需要调整。
  if (typeof line !== 'string' || !/\S/.test(line)) {
    const nearestCursor = getNearestAvailableCursor(cursor, getLine, lineCount)
    const nearestLine = typeof getLine === 'function' ? getLine(nearestCursor.line) : ''
    const nearestPreLine = typeof getLine === 'function' ? getLine(nearestCursor.line - 1) : ''
    const nearestNextLine = typeof getLine === 'function' ? getLine(nearestCursor.line + 1) : ''

    if (typeof nearestLine === 'string' && /\S/.test(nearestLine)) {
      return adjustCursor(
        nearestCursor,
        nearestPreLine,
        nearestLine,
        nearestNextLine,
        getLine,
        lineCount
      )
    }

    return nearestCursor
  }

  const newCursor: Cursor = { line: cursor.line, ch: cursor.ch }
  // 光标位于表格行首/行尾时需要调整。
  if (/\|[^|]+\|.+\|\s*$/.test(line)) {
    if (/\|\s*:?-+:?\s*\|[:-\s|]+\|\s*$/.test(line)) {
      // 光标位于表格第二行（`| --- | :---: |` 分隔行）时
      if (typeof nextline === 'string' && /\S/.test(nextline)) {
        newCursor.line += 1 // 跳到下一行
        newCursor.ch = nextline.indexOf('|') + 1
      }
    } else {
      // 光标不在表格第二行（分隔行）时
      if (cursor.ch <= line.indexOf('|')) newCursor.ch = line.indexOf('|') + 1
      if (cursor.ch >= line.lastIndexOf('|')) newCursor.ch = line.lastIndexOf('|') - 1
    }
  }

  // 光标位于代码/公式块的首行或末行时需要调整。
  if (/```[\S]*/.test(line) || /^\$\$$/.test(line)) {
    if (typeof nextline === 'string' && /\S/.test(nextline)) {
      newCursor.line += 1
      newCursor.ch = 0
    } else if (typeof preline === 'string' && /\S/.test(preline)) {
      newCursor.line -= 1
      newCursor.ch = preline.length
    }
  }

  // 光标位于列表起始位置时需要调整。
  if (/[*+-]\s.+/.test(line) && newCursor.ch <= 1) {
    newCursor.ch = 2
  }

  return newCursor
}

export const animatedScrollTo = function(
  element: HTMLElement,
  to: number,
  duration: number,
  callback?: () => void
): void {
  const start = element.scrollTop
  const change = to - start
  const animationStart = +new Date()

  // 距离很小或时长为 0 时直接跳转，不做动画。
  if (Math.abs(change) <= 6 || duration === 0) {
    element.scrollTop = to
    return
  }

  const easeInOutQuad = function(t: number, b: number, c: number, d: number): number {
    t /= d / 2
    if (t < 1) return (c / 2) * t * t + b
    t--
    return (-c / 2) * (t * (t - 2) - 1) + b
  }

  const animateScroll = function(): void {
    const now = +new Date()
    const val = Math.floor(easeInOutQuad(now - animationStart, start, change, duration))

    element.scrollTop = val

    if (now > animationStart + duration) {
      element.scrollTop = to
      if (callback) {
        callback()
      }
    } else {
      requestAnimationFrame(animateScroll)
    }
  }

  requestAnimationFrame(animateScroll)
}

export const getUniqueId = (): string => {
  return `${ID_PREFIX}${id++}`
}

export const hasKeys = (obj: object): boolean => Object.keys(obj).length > 0

/**
 * 浅拷贝对象。
 *
 * @param obj 要拷贝的对象
 * @param inheritFromObject 克隆结果是否继承自 `Object`（否则为无原型对象）
 */
export const cloneObject = <T extends object>(obj: T, inheritFromObject = true): T => {
  return Object.assign(inheritFromObject ? {} : Object.create(null), obj)
}

/**
 * 深拷贝对象（JSON 序列化实现，仅支持可序列化数据）。
 *
 * @param obj 要拷贝的对象
 */
export const deepClone = <T>(obj: T): T => {
  return JSON.parse(JSON.stringify(obj))
}

// 平台判断与 config.ts 保持一致（Tauri 下无 window.electron，由 config 内部退回 userAgent）。
export { isLinux, isOsx, isWindows } from '../config'
