// Notademics — Tauri 后端入口。
// 极简 Windows Markdown 编辑器后端：文件系统、偏好、目录监视、原生菜单。

mod boot_info;
mod buffer_store;
mod commands;
mod data_center;
mod fonts;
mod i18n;
mod menu;
mod search;
mod settings;
mod shell;
mod uploader;
mod watcher;
mod window_ctl;

use tauri::{Emitter, Manager};

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            // 第二个实例：激活已有窗口并把命令行传入的路径交给渲染进程打开。
            let paths: Vec<String> = argv
                .into_iter()
                .filter(|a| !a.starts_with('-') && a != "notademics")
                .collect();
            if !paths.is_empty() {
                let _ = app.emit("open-file", paths);
            }
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.show();
                let _ = win.set_focus();
            }
        }))
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .manage(watcher::WatcherState::default())
        .invoke_handler(tauri::generate_handler![
            // fs / paths / cmd
            commands::read_file,
            commands::write_file,
            commands::fs_stat,
            commands::fs_copy,
            commands::fs_move,
            commands::fs_ensure_dir,
            commands::fs_empty_dir,
            commands::fs_unlink,
            commands::fs_output_file,
            commands::fs_is_file,
            commands::fs_is_directory,
            commands::fs_is_executable,
            commands::fs_readdir,
            commands::fs_read_file_binary,
            commands::list_dir,
            commands::path_exists,
            commands::mkdir,
            commands::rename_path,
            commands::trash_path,
            commands::paths_is_image,
            commands::paths_is_same,
            commands::cmd_exists,
            commands::get_settings,
            commands::set_settings,
            // shell / clipboard
            shell::shell_open_external,
            shell::shell_open_path,
            shell::clipboard_read_text,
            shell::clipboard_write_text,
            shell::clipboard_guess_file_path,
            // fonts / i18n / bootInfo
            fonts::fonts_list,
            i18n::i18n_load,
            boot_info::boot_info,
            // dataCenter / editorBufferStore
            data_center::get_user_data,
            data_center::set_user_data,
            buffer_store::save_buffer_state,
            buffer_store::load_buffer_state,
            // watcher（多目录）
            watcher::watch_path,
            watcher::unwatch_path,
            watcher::watch_directory,
            watcher::unwatch_directory,
            watcher::unwatch_all,
            // menu / window / uploader
            menu::update_editor_menu_state,
            window_ctl::win_minimize,
            window_ctl::win_maximize,
            window_ctl::win_unmaximize,
            window_ctl::win_toggle_maximize,
            window_ctl::win_close,
            window_ctl::win_is_maximized,
            window_ctl::win_set_fullscreen,
            window_ctl::win_toggle_fullscreen,
            uploader::upload_image,
            // 文件夹内搜索
            search::search_in_folder,
        ])
        .on_menu_event(menu::on_menu_event)
        .setup(|app| {
            menu::setup_menu(app)?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Notademics");
}
