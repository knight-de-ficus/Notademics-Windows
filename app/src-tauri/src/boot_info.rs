// 启动信息 —— 渲染进程启动时一次性拉取的环境与路径快照。

use serde::Serialize;
use tauri::Manager;

#[derive(Serialize)]
pub struct BootPaths {
    pub resources: String,
    #[serde(rename = "userData")]
    pub user_data: String,
    pub cwd: String,
    #[serde(rename = "ripgrepBinary")]
    pub ripgrep_binary: String,
}

#[derive(Serialize)]
pub struct BootInfo {
    pub platform: String,
    pub arch: String,
    /// 简化版版本信息：process 版本 + tauri 版本
    pub versions: serde_json::Value,
    /// 环境变量白名单
    pub env: serde_json::Value,
    pub paths: BootPaths,
    #[serde(rename = "MARKDOWN_INCLUSIONS")]
    pub markdown_inclusions: Vec<String>,
}

fn path_or_empty(r: Result<std::path::PathBuf, tauri::Error>) -> String {
    r.map(|p| p.to_string_lossy().to_string()).unwrap_or_default()
}

#[tauri::command]
pub fn boot_info(app: tauri::AppHandle) -> BootInfo {
    let platform = if cfg!(target_os = "windows") {
        "win32"
    } else if cfg!(target_os = "macos") {
        "darwin"
    } else {
        "linux"
    }
    .to_string();

    let mut env = serde_json::Map::new();
    for key in ["NODE_ENV", "MARKTEXT_VERSION", "NOTADEMICS_VERSION"] {
        if let Ok(v) = std::env::var(key) {
            env.insert(key.to_string(), serde_json::Value::String(v));
        }
    }

    BootInfo {
        platform,
        arch: std::env::consts::ARCH.to_string(),
        versions: serde_json::json!({
            "process": env!("CARGO_PKG_VERSION"),
            "tauri": tauri::VERSION,
        }),
        env: serde_json::Value::Object(env),
        paths: BootPaths {
            resources: path_or_empty(app.path().resource_dir()),
            user_data: path_or_empty(app.path().app_data_dir()),
            cwd: std::env::current_dir().map(|c| c.to_string_lossy().to_string()).unwrap_or_default(),
            ripgrep_binary: String::new(),
        },
        markdown_inclusions: vec![
            "md".into(),
            "markdown".into(),
            "mdown".into(),
            "mkd".into(),
            "mdx".into(),
            "txt".into(),
            "text".into(),
        ],
    }
}
