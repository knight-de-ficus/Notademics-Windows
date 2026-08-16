// 系统字体枚举 —— 读取 Windows 注册表 Fonts 键的值名（字体显示名）。

use std::collections::BTreeSet;

use winreg::enums::{HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE};
use winreg::RegKey;

/// 系统字体注册表键路径
const FONTS_KEY: &str = r"SOFTWARE\Microsoft\Windows NT\CurrentVersion\Fonts";

/// 枚举系统字体名称：合并 HKLM 与 HKCU 两个 Fonts 键的值名，去重后排序。
#[tauri::command]
pub fn fonts_list() -> Result<Vec<String>, String> {
    let mut names = BTreeSet::new();
    for hive in [HKEY_LOCAL_MACHINE, HKEY_CURRENT_USER] {
        let root = RegKey::predef(hive);
        // 部分机器没有 HKCU Fonts 键，读不到就跳过该 hive
        let Ok(fonts) = root.open_subkey(FONTS_KEY) else { continue };
        for entry in fonts.enum_values().flatten() {
            names.insert(entry.0);
        }
    }
    Ok(names.into_iter().collect())
}
