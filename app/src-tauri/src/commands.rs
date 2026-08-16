// 文件系统与偏好设置命令 —— 渲染进程经 `invoke` 调用的唯一入口。

use std::fs;
use std::path::Path;
use std::time::UNIX_EPOCH;

use serde::Serialize;

use crate::settings::Settings;
use crate::watcher::WatcherState;

#[derive(Serialize)]
pub struct FileReadResult {
    pub content: String,
    pub encoding: String,
}

#[derive(Serialize)]
pub struct DirEntryInfo {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub is_file: bool,
    pub size: u64,
}

// ────────────────────────────────────────────────────────────
// 编码检测
// ────────────────────────────────────────────────────────────

fn decode_bytes(bytes: &[u8]) -> (String, String) {
    use encoding_rs::{UTF_16BE, UTF_16LE, UTF_8};

    // BOM 优先
    if bytes.starts_with(&[0xEF, 0xBB, 0xBF]) {
        return (UTF_8.decode_without_bom_handling(&bytes[3..]).0.to_string(), "UTF-8".into());
    }
    if bytes.starts_with(&[0xFF, 0xFE]) {
        return (UTF_16LE.decode_without_bom_handling(&bytes[2..]).0.to_string(), "UTF-16LE".into());
    }
    if bytes.starts_with(&[0xFE, 0xFF]) {
        return (UTF_16BE.decode_without_bom_handling(&bytes[2..]).0.to_string(), "UTF-16BE".into());
    }
    // 合法 UTF-8 直接返回
    if let Ok(s) = std::str::from_utf8(bytes) {
        return (s.to_string(), "UTF-8".into());
    }
    // 其余交给 chardetng 猜测（GBK/Shift_JIS 等）
    let mut det = chardetng::EncodingDetector::new();
    det.feed(bytes, true);
    let enc = det.guess(None, true);
    let (cow, _, _) = enc.decode(bytes);
    (cow.to_string(), enc.name().to_string())
}

fn encode_bytes(content: &str, encoding: &str) -> Result<Vec<u8>, String> {
    match encoding {
        "UTF-16LE" => {
            let (bytes, _, _) = encoding_rs::UTF_16LE.encode(content);
            let mut out = vec![0xFF, 0xFE];
            out.extend_from_slice(&bytes);
            Ok(out)
        }
        "UTF-16BE" => {
            let (bytes, _, _) = encoding_rs::UTF_16BE.encode(content);
            let mut out = vec![0xFE, 0xFF];
            out.extend_from_slice(&bytes);
            Ok(out)
        }
        _ => {
            // 未知编码一律按 UTF-8 写回
            Ok(content.as_bytes().to_vec())
        }
    }
}

// ────────────────────────────────────────────────────────────
// 文件命令
// ────────────────────────────────────────────────────────────

/// 读取文件并按检测到的编码解码。
#[tauri::command]
pub fn read_file(path: String) -> Result<FileReadResult, String> {
    let bytes = fs::read(&path).map_err(|e| format!("read failed: {e}"))?;
    let (content, encoding) = decode_bytes(&bytes);
    Ok(FileReadResult { content, encoding })
}

/// 原子写入文件：先写临时文件再 rename，避免断电/崩溃产生半截文件。
/// 成功后登记写入记录，供 watcher 过滤自保存回环事件。
#[tauri::command]
pub fn write_file(
    path: String,
    content: String,
    encoding: Option<String>,
    state: tauri::State<'_, WatcherState>,
) -> Result<(), String> {
    let bytes = encode_bytes(&content, encoding.as_deref().unwrap_or("UTF-8"))?;
    let p = Path::new(&path);
    if let Some(dir) = p.parent() {
        if !dir.as_os_str().is_empty() {
            fs::create_dir_all(dir).map_err(|e| format!("mkdir failed: {e}"))?;
        }
    }
    let tmp = p.with_extension(format!("tmp-{}", std::process::id()));
    fs::write(&tmp, &bytes).map_err(|e| format!("write failed: {e}"))?;
    fs::rename(&tmp, p).map_err(|e| format!("rename failed: {e}"))?;
    state.record_write(&path);
    Ok(())
}

/// 列出目录下的一级条目（文件名/路径/类型/大小）。
#[tauri::command]
pub fn list_dir(path: String) -> Result<Vec<DirEntryInfo>, String> {
    let mut out = Vec::new();
    let rd = fs::read_dir(&path).map_err(|e| format!("read_dir failed: {e}"))?;
    for entry in rd.flatten() {
        let p = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        // 跳过隐藏文件与常见缓存目录
        if name.starts_with('.') {
            continue;
        }
        let meta = entry.metadata().map_err(|e| format!("metadata failed: {e}"))?;
        out.push(DirEntryInfo {
            name,
            path: p.to_string_lossy().to_string(),
            is_dir: meta.is_dir(),
            is_file: meta.is_file(),
            size: if meta.is_file() { meta.len() } else { 0 },
        });
    }
    out.sort_by(|a, b| {
        b.is_dir.cmp(&a.is_dir).then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });
    Ok(out)
}

#[tauri::command]
pub fn path_exists(path: String) -> bool {
    Path::new(&path).exists()
}

#[tauri::command]
pub fn mkdir(path: String) -> Result<(), String> {
    fs::create_dir_all(&path).map_err(|e| format!("mkdir failed: {e}"))
}

#[tauri::command]
pub fn rename_path(old_path: String, new_path: String) -> Result<(), String> {
    fs::rename(&old_path, &new_path).map_err(|e| format!("rename failed: {e}"))
}

/// 移入回收站（而不是永久删除）。
#[tauri::command]
pub fn trash_path(path: String) -> Result<(), String> {
    trash::delete(&path).map_err(|e| format!("trash failed: {e}"))
}

// ────────────────────────────────────────────────────────────
// 偏好设置命令
// ────────────────────────────────────────────────────────────

#[tauri::command]
pub fn get_settings(app: tauri::AppHandle) -> Settings {
    Settings::load(&app)
}

#[tauri::command]
pub fn set_settings(app: tauri::AppHandle, settings: Settings) -> Result<(), String> {
    settings.save(&app)
}

// ────────────────────────────────────────────────────────────
// fs 全套命令（对齐 marktext 主进程 fs IPC 命名）
// ────────────────────────────────────────────────────────────

#[derive(Serialize)]
pub struct SerializedStat {
    pub size: u64,
    #[serde(rename = "mtimeMs")]
    pub mtime_ms: f64,
    #[serde(rename = "isFile")]
    pub is_file: bool,
    #[serde(rename = "isDirectory")]
    pub is_directory: bool,
    #[serde(rename = "isSymbolicLink")]
    pub is_symbolic_link: bool,
}

#[tauri::command]
pub fn fs_stat(path: String) -> Result<SerializedStat, String> {
    // 跟随符号链接取目标元数据，与 Node fs.stat 语义一致
    let meta = fs::metadata(&path).map_err(|e| format!("stat failed: {e}"))?;
    // 是否符号链接需要 lstat 语义单独判断
    let is_link = fs::symlink_metadata(&path)
        .map(|m| m.file_type().is_symlink())
        .unwrap_or(false);
    let mtime_ms = meta
        .modified()
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_secs_f64() * 1000.0)
        .unwrap_or(0.0);
    Ok(SerializedStat {
        size: meta.len(),
        mtime_ms,
        is_file: meta.is_file(),
        is_directory: meta.is_dir(),
        is_symbolic_link: is_link,
    })
}

/// 递归复制目录（单文件直接 fs::copy）。
fn copy_recursive(src: &Path, dest: &Path) -> std::io::Result<()> {
    fs::create_dir_all(dest)?;
    for entry in walkdir::WalkDir::new(src) {
        let entry = entry?;
        let target = dest.join(entry.path().strip_prefix(src).unwrap());
        if entry.file_type().is_dir() {
            fs::create_dir_all(&target)?;
        } else {
            if let Some(parent) = target.parent() {
                fs::create_dir_all(parent)?;
            }
            fs::copy(entry.path(), &target)?;
        }
    }
    Ok(())
}

#[tauri::command]
pub fn fs_copy(src: String, dest: String) -> Result<(), String> {
    let s = Path::new(&src);
    if s.is_dir() {
        copy_recursive(s, Path::new(&dest)).map_err(|e| format!("copy failed: {e}"))
    } else {
        fs::copy(s, &dest).map(|_| ()).map_err(|e| format!("copy failed: {e}"))
    }
}

#[tauri::command]
pub fn fs_move(src: String, dest: String) -> Result<(), String> {
    let s = Path::new(&src);
    if fs::rename(&src, &dest).is_ok() {
        return Ok(());
    }
    // 跨卷 rename 会失败（EXDEV），退化为复制后删除
    fs_copy(src.clone(), dest.clone())?;
    let res = if s.is_dir() {
        fs::remove_dir_all(s)
    } else {
        fs::remove_file(s)
    };
    res.map_err(|e| format!("remove failed: {e}"))
}

#[tauri::command]
pub fn fs_ensure_dir(path: String) -> Result<(), String> {
    fs::create_dir_all(&path).map_err(|e| format!("mkdir failed: {e}"))
}

/// 清空目录内容（保留目录本身）。
#[tauri::command]
pub fn fs_empty_dir(path: String) -> Result<(), String> {
    for entry in fs::read_dir(&path).map_err(|e| format!("read_dir failed: {e}"))?.flatten() {
        let ep = entry.path();
        if ep.is_dir() {
            fs::remove_dir_all(&ep).map_err(|e| format!("remove_dir_all failed: {e}"))?;
        } else {
            fs::remove_file(&ep).map_err(|e| format!("remove_file failed: {e}"))?;
        }
    }
    Ok(())
}

/// 删除文件或目录（目录递归删除；符号链接本身删除，不追目标）。
#[tauri::command]
pub fn fs_unlink(path: String) -> Result<(), String> {
    let p = Path::new(&path);
    let meta = fs::symlink_metadata(p).map_err(|e| format!("metadata failed: {e}"))?;
    if meta.is_dir() {
        fs::remove_dir_all(p).map_err(|e| format!("remove failed: {e}"))
    } else {
        fs::remove_file(p).map_err(|e| format!("remove failed: {e}"))
    }
}

/// 二进制写文件（图片等资源落盘），同样登记写入记录防 watcher 回环。
#[tauri::command]
pub fn fs_output_file(
    path: String,
    data: Vec<u8>,
    state: tauri::State<'_, WatcherState>,
) -> Result<(), String> {
    let p = Path::new(&path);
    if let Some(dir) = p.parent() {
        if !dir.as_os_str().is_empty() {
            fs::create_dir_all(dir).map_err(|e| format!("mkdir failed: {e}"))?;
        }
    }
    fs::write(p, &data).map_err(|e| format!("write failed: {e}"))?;
    state.record_write(&path);
    Ok(())
}

#[tauri::command]
pub fn fs_is_file(path: String) -> bool {
    Path::new(&path).is_file()
}

#[tauri::command]
pub fn fs_is_directory(path: String) -> bool {
    Path::new(&path).is_dir()
}

/// 是否可执行：Windows 无执行位，按扩展名判定。
#[tauri::command]
pub fn fs_is_executable(path: String) -> bool {
    let p = Path::new(&path);
    if !p.is_file() {
        return false;
    }
    #[cfg(windows)]
    {
        let ext = p.extension().map(|e| e.to_string_lossy().to_lowercase()).unwrap_or_default();
        matches!(ext.as_str(), "exe" | "com" | "bat" | "cmd" | "ps1" | "msi" | "scr")
    }
    #[cfg(not(windows))]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::metadata(p).map(|m| m.permissions().mode() & 0o111 != 0).unwrap_or(false)
    }
}

/// 列出目录下的条目名（含隐藏项），排序保证确定性。
#[tauri::command]
pub fn fs_readdir(path: String) -> Result<Vec<String>, String> {
    let rd = fs::read_dir(&path).map_err(|e| format!("read_dir failed: {e}"))?;
    let mut names: Vec<String> = rd
        .flatten()
        .map(|e| e.file_name().to_string_lossy().to_string())
        .collect();
    names.sort();
    Ok(names)
}

#[tauri::command]
pub fn fs_read_file_binary(path: String) -> Result<Vec<u8>, String> {
    fs::read(&path).map_err(|e| format!("read failed: {e}"))
}

// ────────────────────────────────────────────────────────────
// paths 命令
// ────────────────────────────────────────────────────────────

/// 按扩展名判断是否为图片（大小写不敏感）。
#[tauri::command]
pub fn paths_is_image(path: String) -> bool {
    const IMAGE_EXTS: [&str; 8] = ["png", "jpg", "jpeg", "gif", "svg", "bmp", "webp", "ico"];
    Path::new(&path)
        .extension()
        .map(|e| e.to_string_lossy().to_lowercase())
        .map(|ext| IMAGE_EXTS.contains(&ext.as_str()))
        .unwrap_or(false)
}

/// Windows 路径比较：大小写不敏感。
#[tauri::command]
pub fn paths_is_same(a: String, b: String) -> bool {
    a.to_lowercase() == b.to_lowercase()
}

// ────────────────────────────────────────────────────────────
// cmd 命令
// ────────────────────────────────────────────────────────────

/// 探测命令是否存在于 PATH。Windows 用内置 `where`，零额外依赖。
#[tauri::command]
pub fn cmd_exists(name: String) -> bool {
    #[cfg(windows)]
    {
        std::process::Command::new("cmd")
            .args(["/c", "where", name.as_str()])
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .status()
            .map(|s| s.success())
            .unwrap_or(false)
    }
    #[cfg(not(windows))]
    {
        false
    }
}
