/**
 * tldraw-stub.mjs — 测试环境的 tldraw / tldraw-runtime 替换实现。
 *
 * cm-live-blocks 动态 import('./tldraw-runtime') → 真 tldraw（React/canvas，
 * 打包体积巨大）。本测试文档不含 tldraw 围栏，TldrawWidget 不会实例化，
 * 这里只是让 esbuild 打包时绕过整条依赖链，并提供最小 mountBoard 兜底。
 */
export const mountBoard = async () => ({ destroy() {} });
export const TldrawEditor = null;
export default {};
