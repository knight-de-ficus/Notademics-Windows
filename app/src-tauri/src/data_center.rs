// 用户数据中心 —— 图片目录、上传器配置等，以 JSON 存于应用配置目录。

use serde::{Deserialize, Serialize};
use tauri::Manager;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(default)]
pub struct UserData {
    pub image_folder_path: Option<String>,
    pub screenshot_folder_path: Option<String>,
    pub web_images: Vec<serde_json::Value>,
    pub cloud_images: Vec<serde_json::Value>,
    pub current_uploader: Option<String>,
    pub cli_script: Option<String>,
}

fn data_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    app.path()
        .app_config_dir()
        .map(|d| d.join("data.json"))
        .map_err(|e| format!("app_config_dir failed: {e}"))
}

#[tauri::command]
pub fn get_user_data(app: tauri::AppHandle) -> UserData {
    let Ok(p) = data_path(&app) else { return UserData::default() };
    std::fs::read_to_string(p)
        .ok()
        .and_then(|raw| serde_json::from_str(&raw).ok())
        .unwrap_or_default()
}

#[tauri::command]
pub fn set_user_data(app: tauri::AppHandle, data: UserData) -> Result<(), String> {
    let p = data_path(&app)?;
    if let Some(dir) = p.parent() {
        std::fs::create_dir_all(dir).map_err(|e| format!("mkdir failed: {e}"))?;
    }
    let raw = serde_json::to_string_pretty(&data).map_err(|e| e.to_string())?;
    std::fs::write(p, raw).map_err(|e| format!("write failed: {e}"))
}
