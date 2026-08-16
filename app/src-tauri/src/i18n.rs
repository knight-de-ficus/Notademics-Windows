// 国际化 —— 从资源目录加载语言包 JSON。

use tauri::Manager;

/// 读取 `resources/locales/{language}.json` 并解析为 JSON 返回。
#[tauri::command]
pub fn i18n_load(app: tauri::AppHandle, language: String) -> Result<serde_json::Value, String> {
    let dir = app
        .path()
        .resource_dir()
        .map_err(|e| format!("resource_dir failed: {e}"))?;
    let file = dir.join("locales").join(format!("{language}.json"));
    let raw = std::fs::read_to_string(&file).map_err(|e| format!("load locale failed: {e}"))?;
    serde_json::from_str(&raw).map_err(|e| format!("parse locale failed: {e}"))
}
