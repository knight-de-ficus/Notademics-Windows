# Notademics — Windows 应用源代码

Notademics 的 Windows 桌面应用：Tauri 2 + Rust + React 19，基于 Muya（`@muyajs/core`）WYSIWYG Markdown 引擎。

## 结构

```
app/
  src/                 React 前端
    components/        编辑器 / 文件树 / 标签栏 / 工具栏 / 状态栏 / 查找条
    lib/               Tauri 命令封装、markdown 渲染、设置 store
    styles/            应用主题 + Muya 引擎样式
  src-tauri/           Rust 后端
    src/               main.rs / lib.rs / commands.rs / watcher.rs / menu.rs / settings.rs
    icons/             Notademics 品牌图标
    capabilities/      Tauri 权限声明
```

## 命令

```bash
npm install
npm run dev:app    # 开发
npm run build      # 前端构建
npm run check:rs   # Rust cargo check
npm run tauri build  # 打包 NSIS 安装程序
```

## 后端命令（Rust）

| 命令 | 说明 |
|---|---|
| `read_file` / `write_file` | 读/写文件（编码检测、原子写） |
| `list_dir` / `path_exists` / `mkdir` / `rename_path` / `trash_path` | 文件系统操作 |
| `get_settings` / `set_settings` | 偏好设置（JSON 持久化） |
| `watch_path` / `unwatch_path` | 目录监视（推送 `fs://change` 事件） |

## 事件（Rust → 前端）

| 事件 | 说明 |
|---|---|
| `menu://action` | 原生菜单点击（id 见 `src-tauri/src/menu.rs`） |
| `open-file` | 命令行 / 第二实例传入的文件路径 |
| `tauri://drag-drop` | 拖放文件到窗口 |
| `fs://change` | 监视目录内文件增删改 |

## 品牌

- 产品名：**Notademics**
- 图标：`src-tauri/icons/`（源自 Notademics 项目官方 logo）
- 标识符：`app.notademics`
