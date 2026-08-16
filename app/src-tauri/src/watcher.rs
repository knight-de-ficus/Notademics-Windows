// 目录监视 —— 多目录监听，外部增删改时推送 `fs://change` 事件给渲染进程。
// 自保存防回环：write_file 成功后登记写入记录，过滤窗口内的同名 modify 事件被忽略。

use std::collections::HashMap;
use std::path::Path;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use notify::{Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use serde::Serialize;
use tauri::{AppHandle, Emitter, State};

/// 自保存回环过滤窗口：窗口期内与写入记录同名的 modify 事件视为回环。
const LOOP_GUARD_WINDOW: Duration = Duration::from_secs(2);

pub struct WatcherState {
    /// 正在监视的目录 → 对应的 watcher 句柄（Arc 便于线程内克隆）
    watchers: Arc<Mutex<HashMap<String, RecommendedWatcher>>>,
    /// 最近自保存写入记录（路径 → 时间），供 watcher 线程过滤回环事件
    recent_writes: Arc<Mutex<HashMap<String, Instant>>>,
}

impl Default for WatcherState {
    fn default() -> Self {
        Self {
            watchers: Arc::new(Mutex::new(HashMap::new())),
            recent_writes: Arc::new(Mutex::new(HashMap::new())),
        }
    }
}

impl WatcherState {
    /// 登记一次自保存写入；记录过多时先清理过期项防止无限增长。
    pub fn record_write(&self, path: &str) {
        let mut map = self.recent_writes.lock().unwrap();
        if map.len() >= 512 {
            map.retain(|_, t| t.elapsed() < LOOP_GUARD_WINDOW);
        }
        map.insert(normalize(path), Instant::now());
    }
}

/// Windows 路径大小写不敏感，统一转小写便于比对。
fn normalize(path: &str) -> String {
    path.to_lowercase()
}

#[derive(Serialize, Clone)]
pub struct FsChange {
    pub kind: String,
    pub paths: Vec<String>,
}

fn kind_name(kind: &EventKind) -> &'static str {
    match kind {
        EventKind::Create(_) => "create",
        EventKind::Remove(_) => "remove",
        EventKind::Modify(_) => "modify",
        EventKind::Any => "any",
        _ => "other",
    }
}

/// 启动一个递归 watcher，事件经 `fs://change` 推送。
fn spawn_watcher(app: &AppHandle, state: &WatcherState, path: &str) -> Result<RecommendedWatcher, String> {
    let handle = app.clone();
    let recent = state.recent_writes.clone();
    let mut watcher = notify::recommended_watcher(move |res: notify::Result<Event>| {
        let Ok(event) = res else { return };
        if matches!(event.kind, EventKind::Access(_)) {
            return;
        }
        // 自保存产生的 modify 事件在过滤窗口内直接丢弃
        if matches!(event.kind, EventKind::Modify(_)) {
            let map = recent.lock().unwrap();
            if event.paths.iter().any(|p| map.contains_key(&normalize(&p.to_string_lossy()))) {
                return;
            }
        }
        let payload = FsChange {
            kind: kind_name(&event.kind).into(),
            paths: event.paths.iter().map(|p| p.to_string_lossy().to_string()).collect(),
        };
        let _ = handle.emit("fs://change", payload);
    })
    .map_err(|e| e.to_string())?;

    watcher
        .watch(Path::new(path), RecursiveMode::Recursive)
        .map_err(|e| format!("watch failed: {e}"))?;
    Ok(watcher)
}

/// 开始监视一个目录（递归）。同一路径重复调用会被忽略。
#[tauri::command]
pub fn watch_directory(app: AppHandle, state: State<'_, WatcherState>, path: String) -> Result<(), String> {
    if state.watchers.lock().unwrap().contains_key(&path) {
        return Ok(());
    }
    let watcher = spawn_watcher(&app, &state, &path)?;
    state.watchers.lock().unwrap().insert(path, watcher);
    Ok(())
}

/// 兼容旧接口：与 watch_directory 等价。
#[tauri::command]
pub fn watch_path(app: AppHandle, state: State<'_, WatcherState>, path: String) -> Result<(), String> {
    watch_directory(app, state, path)
}

/// 停止监视单个目录。
#[tauri::command]
pub fn unwatch_directory(app: AppHandle, state: State<'_, WatcherState>, path: String) -> Result<(), String> {
    let _ = app;
    if let Some(mut w) = state.watchers.lock().unwrap().remove(&path) {
        let _ = w.unwatch(Path::new(&path));
    }
    Ok(())
}

/// 停止全部监视。
#[tauri::command]
pub fn unwatch_all(app: AppHandle, state: State<'_, WatcherState>) -> Result<(), String> {
    let _ = app;
    let mut map = state.watchers.lock().unwrap();
    for (p, mut w) in map.drain() {
        let _ = w.unwatch(Path::new(&p));
    }
    Ok(())
}

/// 兼容旧接口：停止全部监视。
#[tauri::command]
pub fn unwatch_path(app: AppHandle, state: State<'_, WatcherState>) -> Result<(), String> {
    unwatch_all(app, state)
}
