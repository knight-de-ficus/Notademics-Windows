// 原生应用菜单 —— 菜单项点击通过 `menu://action` 事件转发给渲染进程，
// 由命令中心统一路由（菜单 id 与 commands/index.ts 的命令 id 一致）。
// 对齐 marktext 的 File / Edit / Format / Paragraph / View 菜单结构与快捷键。

use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{App, AppHandle, Emitter};

pub fn setup_menu(app: &App) -> tauri::Result<()> {
    // ---- File ----
    let file_new = MenuItem::with_id(app, "file.new", "New Tab", true, Some("CmdOrCtrl+N"))?;
    let file_open = MenuItem::with_id(app, "file.open", "Open File…", true, Some("CmdOrCtrl+O"))?;
    let file_open_folder =
        MenuItem::with_id(app, "file.openFolder", "Open Folder…", true, Some("CmdOrCtrl+Shift+O"))?;
    let file_save = MenuItem::with_id(app, "file.save", "Save", true, Some("CmdOrCtrl+S"))?;
    let file_save_as =
        MenuItem::with_id(app, "file.saveAs", "Save As…", true, Some("CmdOrCtrl+Shift+S"))?;
    let file_close_tab = MenuItem::with_id(app, "file.close-tab", "Close Tab", true, Some("CmdOrCtrl+W"))?;
    let file_close_window = MenuItem::with_id(app, "file.close-window", "Close Window", true, Some("CmdOrCtrl+Shift+W"))?;
    let quit = MenuItem::with_id(app, "file.quit", "Exit", true, Some("Alt+F4"))?;

    // ---- Edit ----
    let edit_undo = MenuItem::with_id(app, "edit.undo", "Undo", true, Some("CmdOrCtrl+Z"))?;
    let edit_redo = MenuItem::with_id(app, "edit.redo", "Redo", true, Some("CmdOrCtrl+Y"))?;
    let edit_find = MenuItem::with_id(app, "edit.find", "Find…", true, Some("CmdOrCtrl+F"))?;
    let edit_replace = MenuItem::with_id(app, "edit.replace", "Replace…", true, Some("CmdOrCtrl+H"))?;
    let edit_find_next = MenuItem::with_id(app, "edit.findNext", "Find Next", true, Some("F3"))?;
    let edit_find_prev = MenuItem::with_id(app, "edit.findPrevious", "Find Previous", true, Some("Shift+F3"))?;
    let edit_select_all = MenuItem::with_id(app, "edit.selectAll", "Select All", true, Some("CmdOrCtrl+A"))?;

    // ---- Format（对齐 marktext 格式菜单与快捷键）----
    let fmt_strong = MenuItem::with_id(app, "format.strong", "Bold", true, Some("CmdOrCtrl+B"))?;
    let fmt_em = MenuItem::with_id(app, "format.emphasis", "Italic", true, Some("CmdOrCtrl+I"))?;
    let fmt_strike = MenuItem::with_id(app, "format.strike", "Strikethrough", true, Some("CmdOrCtrl+D"))?;
    let fmt_code = MenuItem::with_id(app, "format.inline-code", "Inline Code", true, Some("CmdOrCtrl+`"))?;
    let fmt_math = MenuItem::with_id(app, "format.inline-math", "Inline Math", true, Some("CmdOrCtrl+M"))?;
    let fmt_link = MenuItem::with_id(app, "format.hyperlink", "Hyperlink", true, Some("CmdOrCtrl+K"))?;
    let fmt_image = MenuItem::with_id(app, "format.image", "Image", true, None::<&str>)?;
    let fmt_clear = MenuItem::with_id(app, "format.clear-format", "Clear Formatting", true, None::<&str>)?;

    // ---- Paragraph（对齐 marktext 段落菜单）----
    let para_p = MenuItem::with_id(app, "paragraph.paragraph", "Paragraph", true, Some("CmdOrCtrl+0"))?;
    let para_h1 = MenuItem::with_id(app, "paragraph.heading-1", "Heading 1", true, Some("CmdOrCtrl+1"))?;
    let para_h2 = MenuItem::with_id(app, "paragraph.heading-2", "Heading 2", true, Some("CmdOrCtrl+2"))?;
    let para_h3 = MenuItem::with_id(app, "paragraph.heading-3", "Heading 3", true, Some("CmdOrCtrl+3"))?;
    let para_h4 = MenuItem::with_id(app, "paragraph.heading-4", "Heading 4", true, Some("CmdOrCtrl+4"))?;
    let para_h5 = MenuItem::with_id(app, "paragraph.heading-5", "Heading 5", true, Some("CmdOrCtrl+5"))?;
    let para_h6 = MenuItem::with_id(app, "paragraph.heading-6", "Heading 6", true, Some("CmdOrCtrl+6"))?;
    let para_quote = MenuItem::with_id(app, "paragraph.quote-block", "Quote Block", true, Some("CmdOrCtrl+Shift+."))?;
    let para_code = MenuItem::with_id(app, "paragraph.code-fence", "Code Fence", true, Some("CmdOrCtrl+Shift+K"))?;
    let para_bullet = MenuItem::with_id(app, "paragraph.bullet-list", "Bullet List", true, Some("CmdOrCtrl+Shift+8"))?;
    let para_order = MenuItem::with_id(app, "paragraph.order-list", "Ordered List", true, Some("CmdOrCtrl+Shift+7"))?;
    let para_task = MenuItem::with_id(app, "paragraph.task-list", "Task List", true, None::<&str>)?;
    let para_hr = MenuItem::with_id(app, "paragraph.horizontal-line", "Horizontal Rule", true, None::<&str>)?;
    let para_math = MenuItem::with_id(app, "paragraph.math-formula", "Math Block", true, None::<&str>)?;

    // ---- View ----
    let view_source_code = MenuItem::with_id(app, "view.source-code-mode", "Source Code Mode", true, Some("CmdOrCtrl+Alt+S"))?;
    let view_typewriter = MenuItem::with_id(app, "view.typewriter-mode", "Typewriter Mode", true, Some("CmdOrCtrl+Alt+T"))?;
    let view_focus = MenuItem::with_id(app, "view.focus-mode", "Focus Mode", true, Some("CmdOrCtrl+Shift+F"))?;
    let view_sidebar = MenuItem::with_id(app, "view.toggle-sidebar", "Toggle Sidebar", true, Some("CmdOrCtrl+\\"))?;
    let view_tabbar = MenuItem::with_id(app, "view.toggle-tabbar", "Toggle Tabbar", true, None::<&str>)?;
    let view_theme = MenuItem::with_id(app, "view.toggleTheme", "Toggle Theme", true, Some("CmdOrCtrl+Shift+T"))?;

    let file_menu = Submenu::with_items(
        app, "File", true,
        &[
            &file_new, &file_open, &file_open_folder,
            &PredefinedMenuItem::separator(app)?,
            &file_save, &file_save_as,
            &PredefinedMenuItem::separator(app)?,
            &file_close_tab, &file_close_window,
            &PredefinedMenuItem::separator(app)?,
            &quit,
        ],
    )?;

    let edit_menu = Submenu::with_items(
        app, "Edit", true,
        &[
            &edit_undo, &edit_redo,
            &PredefinedMenuItem::separator(app)?,
            &edit_find, &edit_replace, &edit_find_next, &edit_find_prev,
            &PredefinedMenuItem::separator(app)?,
            &edit_select_all,
        ],
    )?;

    let format_menu = Submenu::with_items(
        app, "Format", true,
        &[
            &fmt_strong, &fmt_em, &fmt_strike, &fmt_code, &fmt_math, &fmt_link, &fmt_image,
            &PredefinedMenuItem::separator(app)?,
            &fmt_clear,
        ],
    )?;

    let paragraph_menu = Submenu::with_items(
        app, "Paragraph", true,
        &[
            &para_p,
            &PredefinedMenuItem::separator(app)?,
            &para_h1, &para_h2, &para_h3, &para_h4, &para_h5, &para_h6,
            &PredefinedMenuItem::separator(app)?,
            &para_quote, &para_code, &para_math, &para_hr,
            &PredefinedMenuItem::separator(app)?,
            &para_bullet, &para_order, &para_task,
        ],
    )?;

    let view_menu = Submenu::with_items(
        app, "View", true,
        &[
            &view_source_code, &view_typewriter, &view_focus,
            &PredefinedMenuItem::separator(app)?,
            &view_sidebar, &view_tabbar,
            &PredefinedMenuItem::separator(app)?,
            &view_theme,
        ],
    )?;

    let menu = Menu::with_items(app, &[&file_menu, &edit_menu, &format_menu, &paragraph_menu, &view_menu])?;
    app.set_menu(menu)?;
    Ok(())
}

pub fn on_menu_event(app: &AppHandle, event: tauri::menu::MenuEvent) {
    let id = event.id().as_ref().to_string();
    let _ = app.emit("menu://action", id);
}

/// 接收前端菜单启用状态。占位实现：仅记录，不真正重建菜单。
#[tauri::command]
pub fn update_editor_menu_state(payload: serde_json::Value) -> Result<(), String> {
    eprintln!("[menu] editor menu state: {payload}");
    Ok(())
}
