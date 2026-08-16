// 图片上传 —— 预留的 CLI 上传器接口（PicGo 等集成后续再做）。

/// 执行 `{cliScript} {path}` 并取 stdout 作为返回的图片 URL。
#[tauri::command]
pub fn upload_image(req: serde_json::Value) -> Result<String, String> {
    let path = req
        .get("path")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "missing path".to_string())?;
    let Some(script) = req
        .get("cliScript")
        .and_then(|v| v.as_str())
        .filter(|s| !s.is_empty())
    else {
        return Err("no uploader configured".to_string());
    };

    let out = std::process::Command::new(script)
        .arg(path)
        .output()
        .map_err(|e| format!("spawn uploader failed: {e}"))?;
    if !out.status.success() {
        return Err(format!("uploader exited with status {}", out.status));
    }
    let url = String::from_utf8_lossy(&out.stdout).trim().to_string();
    if url.is_empty() {
        return Err("uploader returned empty url".to_string());
    }
    Ok(url)
}
