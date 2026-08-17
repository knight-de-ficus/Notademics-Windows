// 编辑器缓冲状态存储 —— 整个 payload 原样存于应用数据目录。

use tauri::Manager;

fn store_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|d| d.join("editor_buffer_store.json"))
        .map_err(|e| format!("app_data_dir failed: {e}"))
}

#[tauri::command]
pub fn save_buffer_state(app: tauri::AppHandle, payload: serde_json::Value) -> Result<(), String> {
    let p = store_path(&app)?;
    if let Some(dir) = p.parent() {
        std::fs::create_dir_all(dir).map_err(|e| format!("mkdir failed: {e}"))?;
    }
    let raw = serde_json::to_string_pretty(&payload).map_err(|e| e.to_string())?;
    std::fs::write(p, raw).map_err(|e| format!("write failed: {e}"))
}

#[tauri::command]
pub fn load_buffer_state(app: tauri::AppHandle) -> Option<serde_json::Value> {
    let p = store_path(&app).ok()?;
    let raw = std::fs::read_to_string(p).ok()?;
    serde_json::from_str(&raw).ok()
}
