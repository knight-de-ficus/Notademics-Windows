/**
 * mermaid-stub.mjs — 测试环境的 mermaid 替换实现。
 *
 * 真实应用里 mermaid（app/node_modules/mermaid）在浏览器 webview 中把
 * ```mermaid 围栏渲染成 SVG；它依赖大量浏览器 API（fetch、ResizeObserver…），
 * 在 jsdom + Node 下初始化不稳定。本 stub 提供同形的 `render(id, source)`
 * 接口，返回带转义源码的占位 SVG，让 Live 渲染管线（cm-live-blocks 的
 * MermaidWidget + relayout 事件）可以完整走通 —— 验证的是"块被折叠成
 * widget、SVG 缓存填充后 widget 显示 SVG"这条链路，而不是 mermaid 本身的
 * 图渲染（那是 mermaid 库的职责）。
 */
export default {
  async render(id, source) {
    const safe = String(source)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    return {
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="180" viewBox="0 0 420 180"><rect x="4" y="4" width="412" height="172" rx="10" fill="#f6f8fa" stroke="#d1d9e0"/><text x="20" y="30" font-family="ui-monospace,Consolas,monospace" font-size="13" fill="#57606a">mermaid stub · ${id}</text><text x="20" y="56" font-family="ui-monospace,Consolas,monospace" font-size="12" fill="#1f2328">${safe.split('\n').slice(0, 4).join('\n')}</text></svg>`,
    };
  },
};
