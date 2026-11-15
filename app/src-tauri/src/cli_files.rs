// 冷启动命令行文件（"Open with" / `notademics file.md`）——
// 参考 Typora Docs「Use Typora From Shell or cmd」：启动参数里的文件在
// 渲染进程注册好监听后打开。路径只在此处收集一次，由前端 `get_cli_files` 取走。
use serde::Serialize;

#[derive(Default, Serialize)]
pub struct CliFiles(pub Vec<String>);

#[tauri::command]
pub fn get_cli_files(state: tauri::State<'_, CliFiles>) -> Vec<String> {
    state.0.clone()
}

/// 收集启动参数中真实存在的文件；忽略选项与不存在的路径。
pub fn collect() -> CliFiles {
    let mut files = Vec::new();
    for arg in std::env::args().skip(1) {
        if arg.starts_with('-') {
            continue;
        }
        if std::path::Path::new(&arg).is_file() {
            files.push(arg);
        }
    }
    CliFiles(files)
}
