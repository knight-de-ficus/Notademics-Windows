// 全局事件总线 —— 与 marktext 相同：mitt 单例（string → unknown 载荷）。
// 组件与 store 之间通过它解耦通信（如 'file-changed'、'mt::*' 命令通道）。
import mitt, { type Emitter } from 'mitt'

const emitter: Emitter<Record<string, unknown>> = mitt()

export default emitter
