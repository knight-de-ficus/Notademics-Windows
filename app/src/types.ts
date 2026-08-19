// 全局共享类型

/** 视图模式：源码 / 实时编辑（Muya WYSIWYG）/ 分栏 / 纯预览 */
export type ViewMode = 'code' | 'liveEdit' | 'split' | 'preview';

export type Theme = 'light' | 'dark';

export interface TabInfo {
  id: string;
  path: string | null;
  fileName: string;
  content: string;
  savedContent: string;
  encoding: string;
  language: 'markdown' | 'plaintext';
}

export interface FileReadResult {
  content: string;
  encoding: string;
  is_binary: boolean;
}

export interface DirEntryInfo {
  name: string;
  path: string;
  is_dir: boolean;
  is_file: boolean;
  size: number;
}

export interface FsChange {
  kind: string;
  paths: string[];
}
