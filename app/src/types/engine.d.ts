// 引擎（@muyajs/core）与第三方库的无类型模块声明 —— 与 marktext types/shims.d.ts 对齐。
declare module 'prismjs/plugins/keep-markup/prism-keep-markup';
declare module 'joplin-turndown-plugin-gfm';
declare module 'fuzzaldrin';
// `codemirror`（裸模块）由 @types/codemirror 提供类型；以下子模块无声明，shim 为 any。
declare module 'codemirror/keymap/*';
declare module 'codemirror/lib/*';
declare module 'codemirror/mode/*';
declare module 'codemirror/addon/*';
