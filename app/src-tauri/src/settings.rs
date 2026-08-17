// 应用偏好设置 —— 以 JSON 形式存于应用配置目录。

use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use tauri::Manager;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct Settings {
    /// 明暗主题：light | dark
    pub theme: String,
    /// 编辑器字号（px）
    pub font_size: f64,
    /// 编辑器行高
    pub line_height: f64,
    /// 代码块字号（px）
    pub code_font_size: f64,
    /// Tab 宽度（空格数）
    pub tab_size: u8,
    /// 是否自动保存
    pub auto_save: bool,
    /// 打开文件夹后是否显示文件树
    pub show_file_tree: bool,
    /// 上次打开的工作区目录
    pub last_workspace: Option<String>,
    pub editor_background_image: String,
    pub editor_background_position: String,
    pub editor_background_fit: String,
    pub editor_background_opacity: f64,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            theme: "light".into(),
            font_size: 16.0,
            line_height: 1.6,
            code_font_size: 14.0,
            tab_size: 4,
            auto_save: false,
            show_file_tree: true,
            last_workspace: None,
            editor_background_image: String::new(),
            editor_background_position: "center".into(),
            editor_background_fit: "cover".into(),
            editor_background_opacity: 0.2,
        }
    }
}

impl Settings {
    fn path(app: &tauri::AppHandle) -> PathBuf {
        app.path().app_config_dir().unwrap_or_else(|_| PathBuf::from("."))
            .join("settings.json")
    }

    pub fn load(app: &tauri::AppHandle) -> Self {
        let p = Self::path(app);
        match fs::read_to_string(&p) {
            Ok(raw) => serde_json::from_str(&raw).unwrap_or_default(),
            Err(_) => Settings::default(),
        }
    }

    pub fn save(&self, app: &tauri::AppHandle) -> Result<(), String> {
        let p = Self::path(app);
        if let Some(dir) = p.parent() {
            fs::create_dir_all(dir).map_err(|e| format!("mkdir failed: {e}"))?;
        }
        let raw = serde_json::to_string_pretty(self).map_err(|e| e.to_string())?;
        fs::write(p, raw).map_err(|e| format!("write failed: {e}"))
    }
}
