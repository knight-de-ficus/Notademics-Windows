// 原生应用菜单 —— 菜单项与 marktext 的 File/Edit/Paragraph/Format/Window/Theme/View/Help
// 一一对应（Windows；macOS 专属项与用户排除的导出/拼写功能不做）。
// 菜单项点击经 `menu://action`（Tauri 事件）→ 命令中心 `cmd::execute` 执行，
// 菜单 id 与 commands/index.ts 的命令 id 完全一致。
//
// marktext 参考：packages/desktop/src/main/menu/templates/{file,edit,paragraph,format,window,theme,view,help}.ts

use tauri::menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{App, AppHandle, Emitter};

/// 快速构造带快捷键的菜单项
macro_rules! item {
    ($app:expr, $id:expr, $label:expr) => {
        MenuItem::with_id($app, $id, $label, true, None::<&str>)?
    };
    ($app:expr, $id:expr, $label:expr, $accel:expr) => {
        MenuItem::with_id($app, $id, $label, true, Some($accel))?
    };
}

pub fn setup_menu(app: &App) -> tauri::Result<()> {
    // ---------------- File ----------------
    let file_menu = Submenu::with_items(
        app,
        "File",
        true,
        &[
            &item!(app, "file.new-tab", "New Tab", "CmdOrCtrl+N"),
            &item!(app, "file.new-window", "New Window", "CmdOrCtrl+Shift+N"),
            &PredefinedMenuItem::separator(app)?,
            &item!(app, "file.open-file", "Open File…", "CmdOrCtrl+O"),
            &item!(app, "file.open-folder", "Open Folder…", "CmdOrCtrl+Shift+O"),
            &PredefinedMenuItem::separator(app)?,
            &item!(app, "file.save", "Save", "CmdOrCtrl+S"),
            &item!(app, "file.save-as", "Save As…", "CmdOrCtrl+Shift+S"),
            &CheckMenuItem::with_id(app, "file.toggle-auto-save", "Auto Save", true, true, None::<&str>)?,
            &PredefinedMenuItem::separator(app)?,
            &item!(app, "file.move-file", "Move To"),
            &item!(app, "file.rename-file", "Rename", "F2"),
            &PredefinedMenuItem::separator(app)?,
            &item!(app, "file.import", "Import"),
            &item!(app, "file.preferences", "Preferences…", "CmdOrCtrl+,"),
            &PredefinedMenuItem::separator(app)?,
            &item!(app, "file.close-tab", "Close Tab", "CmdOrCtrl+W"),
            &item!(app, "file.close-window", "Close Window", "CmdOrCtrl+Shift+W"),
            &PredefinedMenuItem::separator(app)?,
            &item!(app, "file.quit", "Quit", "CmdOrCtrl+Q"),
        ],
    )?;

    // ---------------- Edit ----------------
    let edit_menu = Submenu::with_items(
        app,
        "Edit",
        true,
        &[
            &item!(app, "edit.undo", "Undo", "CmdOrCtrl+Z"),
            &item!(app, "edit.redo", "Redo", "CmdOrCtrl+Y"),
            &PredefinedMenuItem::separator(app)?,
            &item!(app, "edit.cut", "Cut", "CmdOrCtrl+X"),
            &item!(app, "edit.copy", "Copy", "CmdOrCtrl+C"),
            &item!(app, "edit.paste", "Paste", "CmdOrCtrl+V"),
            &PredefinedMenuItem::separator(app)?,
            &item!(app, "edit.copyAsRich", "Copy As Rich Text", "CmdOrCtrl+Shift+C"),
            &item!(app, "edit.copyAsHtml", "Copy As HTML", "CmdOrCtrl+Alt+C"),
            &item!(app, "edit.pasteAsPlainText", "Paste As Plain Text", "CmdOrCtrl+Shift+V"),
            &PredefinedMenuItem::separator(app)?,
            &item!(app, "edit.selectAll", "Select All", "CmdOrCtrl+A"),
            &PredefinedMenuItem::separator(app)?,
            &item!(app, "edit.duplicate", "Duplicate"),
            &item!(app, "edit.create-paragraph", "Create Paragraph"),
            &item!(app, "edit.delete-paragraph", "Delete Paragraph"),
            &PredefinedMenuItem::separator(app)?,
            &item!(app, "edit.find", "Find…", "CmdOrCtrl+F"),
            &item!(app, "edit.findNext", "Find Next", "F3"),
            &item!(app, "edit.findPrevious", "Find Previous", "Shift+F3"),
            &item!(app, "edit.replace", "Replace…", "CmdOrCtrl+H"),
            &PredefinedMenuItem::separator(app)?,
            &item!(app, "edit.find-in-folder", "Find In Folder", "CmdOrCtrl+Shift+F"),
            &PredefinedMenuItem::separator(app)?,
            &item!(app, "edit.screenshot", "Screenshot"),
            &PredefinedMenuItem::separator(app)?,
            &submenu_line_ending(app)?,
        ],
    )?;

    // ---------------- Paragraph ----------------
    let paragraph_menu = Submenu::with_items(
        app,
        "Paragraph",
        true,
        &[
            &item!(app, "paragraph.heading-1", "Heading 1", "CmdOrCtrl+1"),
            &item!(app, "paragraph.heading-2", "Heading 2", "CmdOrCtrl+2"),
            &item!(app, "paragraph.heading-3", "Heading 3", "CmdOrCtrl+3"),
            &item!(app, "paragraph.heading-4", "Heading 4", "CmdOrCtrl+4"),
            &item!(app, "paragraph.heading-5", "Heading 5", "CmdOrCtrl+5"),
            &item!(app, "paragraph.heading-6", "Heading 6", "CmdOrCtrl+6"),
            &PredefinedMenuItem::separator(app)?,
            &item!(app, "paragraph.upgrade-heading", "Promote Heading", "CmdOrCtrl+Shift+Up"),
            &item!(app, "paragraph.degrade-heading", "Demote Heading", "CmdOrCtrl+Shift+Down"),
            &PredefinedMenuItem::separator(app)?,
            &item!(app, "paragraph.table", "Table", "CmdOrCtrl+Shift+T"),
            &item!(app, "paragraph.code-fence", "Code Fences", "CmdOrCtrl+Shift+K"),
            &item!(app, "paragraph.quote-block", "Quote Block", "CmdOrCtrl+Shift+."),
            &item!(app, "paragraph.math-formula", "Math Block", "CmdOrCtrl+Shift+M"),
            &item!(app, "paragraph.html-block", "HTML Block"),
            &PredefinedMenuItem::separator(app)?,
            &item!(app, "paragraph.order-list", "Ordered List", "CmdOrCtrl+Shift+7"),
            &item!(app, "paragraph.bullet-list", "Bullet List", "CmdOrCtrl+Shift+8"),
            &item!(app, "paragraph.task-list", "Task List"),
            &PredefinedMenuItem::separator(app)?,
            &item!(app, "paragraph.loose-list-item", "Loose List Item"),
            &PredefinedMenuItem::separator(app)?,
            &item!(app, "paragraph.paragraph", "Paragraph", "CmdOrCtrl+0"),
            &item!(app, "paragraph.horizontal-line", "Horizontal Rule", "CmdOrCtrl+Shift+-"),
            &item!(app, "paragraph.front-matter", "Front Matter"),
        ],
    )?;

    // ---------------- Format ----------------
    let format_menu = Submenu::with_items(
        app,
        "Format",
        true,
        &[
            &item!(app, "format.strong", "Bold", "CmdOrCtrl+B"),
            &item!(app, "format.emphasis", "Italic", "CmdOrCtrl+I"),
            &item!(app, "format.underline", "Underline", "CmdOrCtrl+U"),
            &PredefinedMenuItem::separator(app)?,
            &item!(app, "format.superscript", "Superscript"),
            &item!(app, "format.subscript", "Subscript"),
            &item!(app, "format.highlight", "Highlight"),
            &PredefinedMenuItem::separator(app)?,
            &item!(app, "format.inline-code", "Inline Code", "CmdOrCtrl+`"),
            &item!(app, "format.inline-math", "Inline Math", "CmdOrCtrl+M"),
            &PredefinedMenuItem::separator(app)?,
            &item!(app, "format.strike", "Strikethrough", "CmdOrCtrl+D"),
            &item!(app, "format.hyperlink", "Hyperlink", "CmdOrCtrl+K"),
            &item!(app, "format.image", "Image"),
            &PredefinedMenuItem::separator(app)?,
            &item!(app, "format.clear-format", "Clear Formatting"),
        ],
    )?;

    // ---------------- Window ----------------
    let window_menu = Submenu::with_items(
        app,
        "Window",
        true,
        &[
            &item!(app, "window.minimize", "Minimize"),
            &CheckMenuItem::with_id(app, "window.toggle-always-on-top", "Always on Top", true, false, None::<&str>)?,
            &PredefinedMenuItem::separator(app)?,
            &item!(app, "window.zoomIn", "Zoom In", "CmdOrCtrl+="),
            &item!(app, "window.zoomOut", "Zoom Out", "CmdOrCtrl+-"),
            &PredefinedMenuItem::separator(app)?,
            &item!(app, "window.toggle-full-screen", "Full Screen", "F11"),
        ],
    )?;

    // ---------------- Theme ----------------
    let theme_menu = submenu_theme(app)?;

    // ---------------- View ----------------
    let view_menu = Submenu::with_items(
        app,
        "View",
        true,
        &[
            &item!(app, "view.command-palette", "Command Palette", "CmdOrCtrl+Shift+P"),
            &PredefinedMenuItem::separator(app)?,
            &item!(app, "view.source-code-mode", "Source Code Mode", "CmdOrCtrl+Alt+S"),
            &item!(app, "view.typewriter-mode", "Typewriter Mode", "CmdOrCtrl+Alt+T"),
            &item!(app, "view.focus-mode", "Focus Mode", "CmdOrCtrl+Shift+F"),
            &PredefinedMenuItem::separator(app)?,
            &item!(app, "view.toggle-sidebar", "Toggle Sidebar", "CmdOrCtrl+\\"),
            &item!(app, "view.toggle-tabbar", "Toggle Tabbar"),
            &item!(app, "view.toggle-toc", "Toggle Table of Contents", "CmdOrCtrl+Alt+O"),
            &item!(app, "view.reload-images", "Reload Images"),
            &PredefinedMenuItem::separator(app)?,
            &item!(app, "view.toggle-dev-tools", "Show Developer Tools", "CmdOrCtrl+Shift+I"),
            &item!(app, "view.dev-reload", "Reload Window", "CmdOrCtrl+Shift+R"),
        ],
    )?;

    // ---------------- Help ----------------
    let help_menu = Submenu::with_items(
        app,
        "Help",
        true,
        &[
            &item!(app, "help.markdown-reference", "Markdown Reference"),
            &item!(app, "help.changelog", "Changelog"),
            &PredefinedMenuItem::separator(app)?,
            &item!(app, "help.follow-us", "Follow Us"),
            &item!(app, "help.support", "Support"),
            &PredefinedMenuItem::separator(app)?,
            &item!(app, "help.ask-question", "Ask Question"),
            &item!(app, "help.report-bug", "Report Bug"),
            &item!(app, "help.view-source", "View Source"),
            &PredefinedMenuItem::separator(app)?,
            &item!(app, "help.license", "License"),
            &PredefinedMenuItem::separator(app)?,
            &item!(app, "help.check-updates", "Check for Updates"),
            &PredefinedMenuItem::separator(app)?,
            &item!(app, "help.about", "About"),
        ],
    )?;

    let menu = Menu::with_items(
        app,
        &[&file_menu, &edit_menu, &paragraph_menu, &format_menu, &window_menu, &theme_menu, &view_menu, &help_menu],
    )?;
    app.set_menu(menu)?;
    Ok(())
}

/// Line Ending 子菜单（对齐 marktext edit.ts 的 Line Ending 单选组）
fn submenu_line_ending(app: &App) -> tauri::Result<Submenu<tauri::Wry>> {
    let crlf = MenuItem::with_id(app, "edit.line-ending-crlf", "CRLF (Windows)", true, None::<&str>)?;
    let lf = MenuItem::with_id(app, "edit.line-ending-lf", "LF (Linux/Mac)", true, None::<&str>)?;
    Submenu::with_items(app, "Line Ending", true, &[&crlf, &lf])
}

/// Theme 菜单 —— 对齐 marktext theme.ts：Follow System Theme + 亮色/暗色主题列表。
/// 主题项 id 使用 `window.change-theme-<值>`（commands 中 window.change-theme 的子命令）。
fn submenu_theme(app: &App) -> tauri::Result<Submenu<tauri::Wry>> {
    let follow = CheckMenuItem::with_id(app, "theme.follow-system-theme", "Follow System Theme", true, false, None::<&str>)?;
    let sep = PredefinedMenuItem::separator(app)?;

    let light_themes = [
        "light", "graphite", "ulysses", "catppuccin-latte", "gruvbox-light",
        "tokyo-night-light", "solarized-light", "ayu-light", "everforest-light", "rose-pine-dawn",
    ];
    let dark_themes = [
        "dark", "material-dark", "one-dark", "dracula", "nord", "catppuccin-mocha",
        "gruvbox-dark", "tokyo-night", "tokyo-night-storm", "solarized-dark", "ayu-dark",
        "ayu-mirage", "everforest-dark", "rose-pine", "rose-pine-moon", "monokai-pro",
        "synthwave-84", "horizon-dark", "palenight", "oxocarbon-dark", "kanagawa",
        "nightfox", "cyberdream",
    ];

    let mut items: Vec<&dyn tauri::menu::IsMenuItem<tauri::Wry>> = Vec::new();
    items.push(&follow);
    items.push(&sep);

    let mut light_items: Vec<MenuItem<tauri::Wry>> = Vec::new();
    for name in light_themes {
        light_items.push(MenuItem::with_id(
            app,
            &format!("window.change-theme-{name}"),
            name,
            true,
            None::<&str>,
        )?);
    }
    let mut light_refs: Vec<&dyn tauri::menu::IsMenuItem<tauri::Wry>> = Vec::new();
    for i in &light_items {
        light_refs.push(i);
    }
    let light_sub = Submenu::with_items(app, "Light Themes", true, &light_refs)?;

    let mut dark_items: Vec<MenuItem<tauri::Wry>> = Vec::new();
    for name in dark_themes {
        dark_items.push(MenuItem::with_id(
            app,
            &format!("window.change-theme-{name}"),
            name,
            true,
            None::<&str>,
        )?);
    }
    let mut dark_refs: Vec<&dyn tauri::menu::IsMenuItem<tauri::Wry>> = Vec::new();
    for i in &dark_items {
        dark_refs.push(i);
    }
    let dark_sub = Submenu::with_items(app, "Dark Themes", true, &dark_refs)?;

    items.push(&light_sub);
    items.push(&dark_sub);

    Submenu::with_items(app, "Theme", true, &items)
}

pub fn on_menu_event(app: &AppHandle, event: tauri::menu::MenuEvent) {
    let id = event.id().as_ref().to_string();
    let _ = app.emit("menu://action", id);
}

/// 接收前端菜单启用/勾选状态。占位实现：仅记录，不真正重建菜单。
#[tauri::command]
pub fn update_editor_menu_state(payload: serde_json::Value) -> Result<(), String> {
    eprintln!("[menu] editor menu state: {payload}");
    Ok(())
}
