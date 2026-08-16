// 窗口控制 —— 对主窗口的常见操作，供前端自绘标题栏使用。

use tauri::Manager;

fn main_window(app: &tauri::AppHandle) -> Result<tauri::WebviewWindow, String> {
    app.get_webview_window("main")
        .ok_or_else(|| "main window not found".to_string())
}

// 无参、返回 () 的窗口操作统一用宏生成
macro_rules! win_cmd {
    ($name:ident, $method:ident) => {
        #[tauri::command]
        pub fn $name(app: tauri::AppHandle) -> Result<(), String> {
            main_window(&app)?
                .$method()
                .map_err(|e| format!("{} failed: {}", stringify!($method), e))
        }
    };
}

win_cmd!(win_minimize, minimize);
win_cmd!(win_maximize, maximize);
win_cmd!(win_unmaximize, unmaximize);
win_cmd!(win_close, close);

#[tauri::command]
pub fn win_toggle_maximize(app: tauri::AppHandle) -> Result<(), String> {
    let win = main_window(&app)?;
    if win.is_maximized().map_err(|e| format!("is_maximized failed: {e}"))? {
        win.unmaximize().map_err(|e| format!("unmaximize failed: {e}"))
    } else {
        win.maximize().map_err(|e| format!("maximize failed: {e}"))
    }
}

#[tauri::command]
pub fn win_is_maximized(app: tauri::AppHandle) -> Result<bool, String> {
    main_window(&app)?
        .is_maximized()
        .map_err(|e| format!("is_maximized failed: {e}"))
}

#[tauri::command]
pub fn win_set_fullscreen(app: tauri::AppHandle, flag: bool) -> Result<(), String> {
    main_window(&app)?
        .set_fullscreen(flag)
        .map_err(|e| format!("set_fullscreen failed: {e}"))
}

#[tauri::command]
pub fn win_toggle_fullscreen(app: tauri::AppHandle) -> Result<(), String> {
    let win = main_window(&app)?;
    let target = !win.is_fullscreen().map_err(|e| format!("is_fullscreen failed: {e}"))?;
    win.set_fullscreen(target)
        .map_err(|e| format!("set_fullscreen failed: {e}"))
}
