// 文件夹内文本搜索 —— 对齐 marktext ipc/ripgrep 的能力（简化实现：
// walkdir 遍历 + 按行匹配，返回 路径/行号/行内容，供侧边栏搜索展示）。

use serde::Serialize;
use walkdir::WalkDir;

#[derive(Serialize)]
pub struct SearchMatch {
    pub path: String,
    pub line: u32,
    pub content: String,
}

fn build_matcher(query: &str, is_regexp: bool, is_case_sensitive: bool, is_whole_word: bool) -> Result<Box<dyn Fn(&str) -> bool>, String> {
    if is_regexp {
        let re = regex_lite::Regex::new(query).map_err(|e| format!("invalid regex: {e}"))?;
        let re = re;
        return Ok(Box::new(move |line: &str| {
            if is_whole_word {
                re.find(line).map_or(false, |m| {
                    let s = m.start();
                    let e = m.end();
                    let before_ok = s == 0 || !line[..s].chars().last().map_or(false, |c| c.is_alphanumeric());
                    let after_ok = e >= line.len() || !line[e..].chars().next().map_or(false, |c| c.is_alphanumeric());
                    before_ok && after_ok
                })
            } else {
                re.is_match(line)
            }
        }));
    }
    let needle = if is_case_sensitive { query.to_string() } else { query.to_lowercase() };
    return Ok(Box::new(move |line: &str| {
        let hay = if is_case_sensitive { line.to_string() } else { line.to_lowercase() };
        if is_whole_word {
            hay.split(|c: char| !c.is_alphanumeric() && c != '_').any(|w| w == needle)
        } else {
            hay.contains(&needle)
        }
    }));
}

/// 在目录内搜索文本。max_results 限制返回条数（默认 200）。
#[tauri::command]
pub fn search_in_folder(
    query: String,
    path: String,
    is_regexp: bool,
    is_case_sensitive: bool,
    is_whole_word: bool,
    max_results: Option<usize>,
) -> Result<Vec<SearchMatch>, String> {
    if query.is_empty() {
        return Ok(vec![]);
    }
    let matcher = build_matcher(&query, is_regexp, is_case_sensitive, is_whole_word)?;
    let limit = max_results.unwrap_or(200);
    let mut results: Vec<SearchMatch> = Vec::new();
    let mut exceeded = false;

    for entry in WalkDir::new(&path).follow_links(false).into_iter().filter_map(|e| e.ok()) {
        if !entry.file_type().is_file() {
            continue;
        }
        // 跳过常见缓存与二进制目录
        let p = entry.path();
        let rel = p.to_string_lossy().to_string();
        if rel.contains("node_modules") || rel.contains("\\.git\\") || rel.contains("/.git/") || rel.contains("\\target\\") {
            continue;
        }
        let Ok(content) = std::fs::read_to_string(p) else { continue };
        for (idx, line) in content.lines().enumerate() {
            if matcher(line) {
                results.push(SearchMatch {
                    path: rel.clone(),
                    line: (idx + 1) as u32,
                    content: line.to_string(),
                });
                if results.len() >= limit {
                    exceeded = true;
                    break;
                }
            }
        }
        if exceeded {
            break;
        }
    }
    Ok(results)
}
