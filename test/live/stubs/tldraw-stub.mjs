/**
 * tldraw-stub.mjs — 测试环境的 tldraw / tldraw-runtime 替换实现。
 *
 * 真实应用里 ```tldraw 围栏通过 tldraw-runtime.ts 动态 import 真 tldraw 库
 * 挂载白板画布（React + canvas，无法在 jsdom 中运行）。本测试文档不含
 * tldraw 围栏，TldrawWidget 不会实例化 —— 这里只是让 esbuild 打包时绕过
 * 真 tldraw（及其 radix-ui/tiptap 依赖树），并提供最小 `mountBoard` 兜底。
 */
export const mountBoard = async () => ({ destroy() {} });
export const TldrawEditor = null;
export default {};
