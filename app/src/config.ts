// 渲染进程配置常量 —— 对齐 marktext renderer/src/config.ts。
// 平台判断适配 Tauri：无 window.electron 时退回 navigator.userAgent。

export const THEME_STYLE_ID = 'ag-theme'
export const COMMON_STYLE_ID = 'ag-common-style'

export const DEFAULT_EDITOR_FONT_FAMILY =
  '"Open Sans", "Clear Sans", "Helvetica Neue", Helvetica, Arial, sans-serif, Segoe UI Emoji, Apple Color Emoji, "Noto Color Emoji"'
export const DEFAULT_CODE_FONT_FAMILY =
  '"DejaVu Sans Mono", "Source Code Pro", "Droid Sans Mono", monospace'

// 编辑器默认样式（与 marktext 一致）
export const DEFAULT_STYLE = Object.freeze({
  codeFontFamily: DEFAULT_CODE_FONT_FAMILY,
  codeFontSize: '14px',
  hideScrollbar: false,
  theme: 'light'
})

// 使用 railscasts CodeMirror 主题的暗色主题列表
export const railscastsThemes: readonly string[] = Object.freeze([
  'dark',
  'material-dark',
  // gogh 深色主题
  'dracula',
  'nord',
  'catppuccin-mocha',
  'gruvbox-dark',
  'tokyo-night',
  'tokyo-night-storm',
  'solarized-dark',
  'ayu-dark',
  'ayu-mirage',
  'everforest-dark',
  'rose-pine',
  'rose-pine-moon',
  'monokai-pro',
  'synthwave-84',
  'horizon-dark',
  'palenight',
  'oxocarbon-dark',
  'kanagawa',
  'nightfox',
  'cyberdream'
])

// 使用 one-dark CodeMirror 主题的暗色主题列表
export const oneDarkThemes: readonly string[] = Object.freeze(['one-dark'])

// ---- 基础正则（参考 marktext）----
export const LINE_ENDING_REG = /(?:\r\n|\n)/g
export const LF_LINE_ENDING_REG = /(?:[^\r]\n)|(?:^\n$)/
export const CRLF_LINE_ENDING_REG = /\r\n/

// http(s):// 域名 / IPv4 / localhost / IPv6 [端口] / 路径
export const URL_REG =
  /^http(s)?:\/\/([a-z0-9\-._~]+\.[a-z]{2,}|[0-9.]+|localhost|\[[a-f0-9.:]+\])(:[0-9]{1,5})?(\/[\S]+)?/i

// Notademics 项目主页（暂无公开仓库时为 about 对话框显示用）
export const GITHUB_REPO_URL = 'https://github.com/notademics/notademics'

// ---- 平台判断 ----
interface ElectronLikeWindow extends Window {
  electron?: { process?: { platform?: string } }
}

const getPlatform = (): string => {
  // 优先取 Electron 平台（与 marktext 兼容），Tauri 下退回 userAgent 判断
  const electronPlatform = (window as ElectronLikeWindow).electron?.process?.platform
  if (electronPlatform) return electronPlatform
  const ua = navigator.userAgent.toLowerCase()
  if (/win32|win64|windows/.test(ua)) return 'win32'
  if (/mac os x|macintosh/.test(ua)) return 'darwin'
  if (/linux/.test(ua)) return 'linux'
  return ''
}

const platform = getPlatform()
export const isWindows = platform === 'win32'
export const isOsx = platform === 'darwin'
export const isLinux = platform === 'linux'

// 路径分隔符（Tauri 下无 window.path，按平台取）
export const PATH_SEPARATOR: string = isWindows ? '\\' : '/'
