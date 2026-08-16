// 服务注册表 —— 移植 marktext src/services/index.ts。
// 每个服务形如 { name, notify }；`notify` 具名导出供注册方直接引用。
import notification from './notification'

export const notify = notification

export const services = [notification]

export default services
