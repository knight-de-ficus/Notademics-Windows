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
npm run tauri -- build --bundles msi  # 打包 MSI 安装程序
npm run package:windows-release  # 从已完成的 release 构建组装发布附件
npm run clean:rs   # 清除可再生成的 Rust/Cargo 构建缓存
```

## 构建产物与磁盘占用

`src-tauri/target/` 是 Cargo 构建缓存，不是需要发布的应用目录。其中的
`deps/`、`build/`、`incremental/`、`.lib` 和 `.pdb` 用于编译和链接，体积
可以达到数 GB。Windows 发布时只需要：

```text
src-tauri/target/release/bundle/msi/*.msi
```

需要释放空间时，先关闭正在运行的 Notademics，再执行 `npm run clean:rs`。

GitHub Release 由 `.github/workflows/release.yml` 自动构建。发布前将
`package.json`、`src-tauri/tauri.conf.json` 和 `src-tauri/Cargo.toml` 的版本号
保持一致，然后推送对应标签，例如：

```bash
git tag v0.2.0
git push origin v0.2.0
```

每个 GitHub Release 包含五个文件：

```text
Notademics_<版本>_x64.msi
Notademics_<版本>_x64.msi.md5
Notademics_<版本>_x64-portable.zip
Notademics_<版本>_x64-portable.zip.md5
Notademics_<版本>_source.zip
```

免安装 ZIP 包含 `Notademics.exe`、`resources/`、许可证和使用说明。应用设置与
恢复数据仍保存在当前 Windows 用户的应用数据目录，不会写入 ZIP 解压目录。
源码 ZIP 通过 `git archive HEAD:app` 生成，只包含对应标签中已提交的 `app/`
目录内容，不包含仓库其他目录、依赖目录或构建缓存。

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
