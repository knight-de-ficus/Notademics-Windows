// 文档状态工厂（非 store）—— 移植 marktext store/help.ts：
// 提供默认 IFileState、空白标签、以及从 IPC 载荷构造文档状态的函数。
import type { IFileState } from '../shared/types/files'

/** 生成单调递增的唯一 id（对齐 marktext util.getUniqueId） */
let idCounter = 0
const ID_PREFIX = 'mt-'
export const getUniqueId = (): string => `${ID_PREFIX}${idCounter++}`

/** 深拷贝（JSON 序列化，够用于纯数据状态） */
export const deepClone = <T>(obj: T): T => JSON.parse(JSON.stringify(obj)) as T

/** 默认文档状态 —— 每个真实标签页都必须通过 getBlankFileState / createDocumentState 分配唯一 id */
const defaultFileStateWithoutId = {
  isSaved: true,
  pathname: '',
  filename: 'Untitled-1',
  markdown: '',
  encoding: {
    encoding: 'utf8',
    isBom: false
  },
  lineEnding: 'lf',
  trimTrailingNewline: 3,
  adjustLineEndingOnSave: false,
  history: {
    stack: [] as IFileState['history']['stack'],
    index: -1
  },
  cursor: null,
  wordCount: {
    paragraph: 0,
    word: 0,
    character: 0,
    all: 0
  },
  searchMatches: {
    index: -1,
    matches: [] as unknown[],
    value: ''
  },
  scrollTop: 0,
  muyaIndexCursor: null,
  notifications: []
} satisfies Omit<IFileState, 'id'>

export const defaultFileState: Omit<IFileState, 'id'> = defaultFileStateWithoutId

/** 提取保存时需要的文件选项（编码/换行等） */
export const getOptionsFromState = (
  file: IFileState
): {
  encoding: IFileState['encoding']
  lineEnding: IFileState['lineEnding']
  adjustLineEndingOnSave: boolean
  trimTrailingNewline: number
} => {
  const { encoding, lineEnding, adjustLineEndingOnSave, trimTrailingNewline } = file
  return { encoding, lineEnding, adjustLineEndingOnSave, trimTrailingNewline }
}

const documentStateKeys = [
  'isSaved',
  'pathname',
  'filename',
  'markdown',
  'encoding',
  'lineEnding',
  'trimTrailingNewline',
  'adjustLineEndingOnSave',
  'history',
  'cursor',
  'wordCount',
  'searchMatches',
  'scrollTop',
  'muyaIndexCursor',
  'notifications'
] as const satisfies ReadonlyArray<keyof IFileState>

/** 创建空白（未命名）标签页；编号取自现有空白标签的最大序号 + 1 */
export const getBlankFileState = (
  tabs: Array<{ pathname: string; filename: string }>,
  defaultEncoding: string = defaultFileStateWithoutId.encoding.encoding,
  lineEnding: string = defaultFileStateWithoutId.lineEnding,
  markdown: string | null = defaultFileStateWithoutId.markdown
): IFileState => {
  const fileState = deepClone(defaultFileStateWithoutId) as Omit<IFileState, 'id'>
  const defaultFilenamePrefix = defaultFileStateWithoutId.filename.split('-')[0]
  let untitleId = Math.max(
    ...tabs.map((f) => {
      if (f.pathname === '') {
        return +f.filename.split('-')[1]
      }
      return 0
    }),
    0
  )

  const id = getUniqueId()
  if (markdown == null) {
    markdown = defaultFileStateWithoutId.markdown
  }

  fileState.encoding.encoding = defaultEncoding
  return Object.assign(fileState, {
    lineEnding,
    adjustLineEndingOnSave: lineEnding.toLowerCase() === 'crlf',
    id,
    filename: `${defaultFilenamePrefix}-${++untitleId}`,
    markdown,
    // 新文档即其磁盘基线；引擎在 setContent 时清空撤销栈，
    // 基线撤销深度（合成保存追踪 id）为 0 —— 即使从未保存，撤销回基线也能清除脏标记。
    lastSavedHistoryId: 0
  }) as IFileState
}

/**
 * 从给定数据构造文档状态。接受松散输入（IPC 载荷、部分状态），
 * 只拷贝 documentStateKeys 声明的键。
 */
export const createDocumentState = (
  markdownDocument: Partial<IFileState> | Record<string, unknown> | null | undefined = {},
  id: string = getUniqueId()
): IFileState => {
  const src = (markdownDocument || {}) as Record<string, unknown>
  const docState = deepClone(defaultFileStateWithoutId) as Omit<IFileState, 'id'>

  for (const key of documentStateKeys) {
    if (src[key] !== undefined) {
      ;(docState as Record<string, unknown>)[key] = src[key]
    }
  }

  return Object.assign(docState, {
    id,
    // 同 getBlankFileState：加载的文档是其自身干净基线，基线撤销深度为 0
    lastSavedHistoryId: 0
  }) as IFileState
}

export const getFileStateFromData = (
  data: Partial<IFileState> | Record<string, unknown> | null | undefined
): IFileState => createDocumentState(data)
