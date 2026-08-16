// 命令中心 store —— 持有根命令树，注册 / 排序 / 执行命令。
// 对齐 marktext store/commandCenter.ts：
// - 'cmd::register-command'、'cmd::execute'、'cmd::sort-commands' 走 bus
// - Tauri event 'execute-command-by-id' 由后端菜单直接执行命令
import { create } from 'zustand'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import bus from '../bus'
import staticCommands, {
  RootCommand,
  getCommandsWithDescriptions,
  type CommandDescriptor
} from '../commands'

type Command = CommandDescriptor
type Root = { subcommands: Command[] }

interface CommandCenterState {
  rootCommand: Root
  REGISTER_COMMAND: (command: Command) => void
  SORT_COMMANDS: () => void
  LISTEN_COMMAND_CENTER_BUS: () => Promise<() => void>
}

export const useCommandCenterStore = create<CommandCenterState>((set, get) => ({
  rootCommand: new RootCommand(staticCommands as unknown as CommandDescriptor[]) as Root,

  REGISTER_COMMAND: (command) => {
    set((state) => ({ rootCommand: { subcommands: [...state.rootCommand.subcommands, command] } }))
  },

  SORT_COMMANDS: () => {
    set((state) => ({
      rootCommand: {
        subcommands: [...state.rootCommand.subcommands].sort((a, b) =>
          (a.description ?? '').localeCompare(b.description ?? '')
        )
      }
    }))
  },

  LISTEN_COMMAND_CENTER_BUS: async () => {
    // 初始加载：用带描述的完整命令列表替换静态列表，再按描述排序
    set({ rootCommand: { subcommands: await getCommandsWithDescriptions() } })
    get().SORT_COMMANDS()

    // mitt 的 on 不返回退订函数，无需收集；仅收集 Tauri listen 的退订
    // 语言切换后命令描述需要重新翻译
    bus.on('language-changed', async () => {
      set({ rootCommand: { subcommands: await getCommandsWithDescriptions() } })
      get().SORT_COMMANDS()
    })

    bus.on('cmd::sort-commands', () => {
      get().SORT_COMMANDS()
    })

    // 注册运行时动态创建的命令（如编辑器相关命令）
    bus.on('cmd::register-command', (command) => {
      get().REGISTER_COMMAND(command as Command)
    })

    // 其他组件通过 bus 按 id 执行命令
    bus.on('cmd::execute', (commandId) => {
      executeCommand(get().rootCommand, String(commandId))
    })

    // 后端菜单 / 快捷键经 Tauri event 请求执行命令
    const unlistenExecute = await listen<string>('execute-command-by-id', (e) => {
      executeCommand(get().rootCommand, e.payload)
    })

    return () => {
      unlistenExecute()
    }
  }
}))

const executeCommand = (root: Root, commandId: string): void => {
  const { subcommands } = root
  const command = subcommands.find((c) => c.id === commandId)
  if (!command) {
    console.error(`Cannot execute command "${commandId}" because it's missing.`)
    return
  }
  void command.execute?.()
}
