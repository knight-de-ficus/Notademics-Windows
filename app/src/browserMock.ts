// 浏览器调试 mock —— 对齐 marktext 的 browserMock.ts。
// 当 renderer 在纯浏览器（http://localhost:1420，无 Tauri 运行时）打开时，
// mock window.__TAURI_INTERNALS__ 使 @tauri-apps/api 的 invoke/listen 可用：
// 文件系统返回示例数据，其余命令空实现并 console 记录。
// 仅在非 Tauri 环境注入（window.__TAURI_INTERNALS__ 已存在则跳过）。

const isTauri = (): boolean => {
  try {
    return !!(window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__
  } catch {
    return false
  }
}

const MOCK_MARKDOWN = `# Notademics

The Art of Minimal Markdown.

## Features

- WYSIWYG editing with the Muya engine
- Source code mode (CodeMirror)
- Multiple tabs
- File tree sidebar
- Find & Replace
- Light/Dark themes

\`\`\`js
console.log('hello, Notademics')
\`\`\`

> Type your own markdown here.
`

interface MockInvokeArgs {
  [key: string]: unknown
}

const mockInvoke = async (cmd: string, args?: MockInvokeArgs): Promise<unknown> => {
  // 在浏览器里对常用命令返回假数据，保证 UI 可渲染
  switch (cmd) {
    case 'get_settings':
      return {
        theme: 'light',
        fontSize: 16,
        lineHeight: 1.6,
        codeFontSize: 14,
        tabSize: 4,
        autoSave: false,
        showFileTree: true,
        lastWorkspace: null
      }
    case 'set_settings':
      return null
    case 'i18n_load':
      return {}
    case 'read_file':
      return { content: MOCK_MARKDOWN, encoding: 'UTF-8' }
    case 'write_file':
      return null
    case 'list_dir':
      return []
    case 'path_exists':
      return false
    case 'search_in_folder':
      return []
    case 'fonts_list':
      return ['Microsoft YaHei', 'Segoe UI', 'Consolas', 'SimSun']
    case 'win_is_maximized':
      return false
    case 'win_is_fullscreen':
      return false
    case 'boot_info':
      return {
        platform: 'win32',
        arch: 'x64',
        versions: { tauri: 'mock' },
        env: { NODE_ENV: 'development' },
        paths: { resources: '', userData: '', cwd: '', ripgrepBinary: '' },
        MARKDOWN_INCLUSIONS: ['md', 'markdown', 'mdown', 'mkd', 'mdx', 'txt', 'text']
      }
    default:
      console.warn('[browserMock] invoke not mocked:', cmd, args)
      return null
  }
}

const mockListen = (_event: string, handler: (event: { payload: unknown }) => void): Promise<() => void> => {
  return Promise.resolve(() => {})
}

const mock = (): void => {
  if (isTauri()) return
  const internals = {
    invoke: mockInvoke,
    transformCallback: (callback: unknown) => callback as number,
    convertFileSrc: (path: string) => path,
    listen: mockListen,
    once: mockListen,
    emit: () => {},
    removeEventListener: () => {}
  }
  ;(window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = internals
}

mock()
