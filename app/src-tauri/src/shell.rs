// shell 与剪贴板命令 —— 打开外部链接/路径、读写系统剪贴板。

use std::path::Path;

use tauri_plugin_clipboard_manager::ClipboardExt;

/// 用系统默认浏览器打开 URL。
#[tauri::command]
pub fn shell_open_external(url: String) -> Result<(), String> {
    tauri_plugin_opener::open_url(&url, None::<&str>).map_err(|e| format!("open failed: {e}"))
}

/// 用系统默认应用打开路径（文件或目录）。
#[tauri::command]
pub fn shell_open_path(path: String) -> Result<(), String> {
    tauri_plugin_opener::open_path(&path, None::<&str>).map_err(|e| format!("open failed: {e}"))
}

#[tauri::command]
pub fn clipboard_read_text(app: tauri::AppHandle) -> Result<String, String> {
    app.clipboard()
        .read_text()
        .map_err(|e| format!("clipboard read failed: {e}"))
}

#[tauri::command]
pub fn clipboard_write_text(app: tauri::AppHandle, text: String) -> Result<(), String> {
    app.clipboard()
        .write_text(text)
        .map_err(|e| format!("clipboard write failed: {e}"))
}

/// 猜测剪贴板中的文件路径：剪贴板文本恰好是磁盘上存在的文件时返回它。
#[tauri::command]
pub fn clipboard_guess_file_path(app: tauri::AppHandle) -> Option<String> {
    let Ok(text) = app.clipboard().read_text() else { return None };
    let p = text.trim();
    if !p.is_empty() && Path::new(p).is_file() {
        Some(p.to_string())
    } else {
        None
    }
}
