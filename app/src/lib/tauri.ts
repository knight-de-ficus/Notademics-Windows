// Tauri 命令封装 —— 渲染进程所有后端调用集中于此。
import { invoke } from '@tauri-apps/api/core';
import type { DirEntryInfo, FileReadResult } from '../types';

export const readFile = (path: string): Promise<FileReadResult> =>
  invoke<FileReadResult>('read_file', { path });

export const writeFile = (path: string, content: string, encoding?: string): Promise<void> =>
  invoke<void>('write_file', { path, content, encoding });

export const listDir = (path: string): Promise<DirEntryInfo[]> =>
  invoke<DirEntryInfo[]>('list_dir', { path });

export const pathExists = (path: string): Promise<boolean> =>
  invoke<boolean>('path_exists', { path });

export const mkdir = (path: string): Promise<void> =>
  invoke<void>('mkdir', { path });

export const renamePath = (oldPath: string, newPath: string): Promise<void> =>
  invoke<void>('rename_path', { oldPath, newPath });

export const trashPath = (path: string): Promise<void> =>
  invoke<void>('trash_path', { path });

export const watchPath = (path: string): Promise<void> =>
  invoke<void>('watch_path', { path });

export const unwatchPath = (): Promise<void> => invoke<void>('unwatch_path');
