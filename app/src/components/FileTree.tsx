import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open as openDialog } from '@tauri-apps/plugin-dialog';

interface FileTreeProps {
  currentFolder: string | null;
  activePath: string | null;
  onOpenFile: (path: string) => void;
  onOpenFolder: (path: string) => void;
}

interface FileEntry {
  name: string;
  path: string;
  isDir: boolean;
  children?: FileEntry[];
}

/**
 * Minimal file tree component.
 * Phase 1 implementation: manual folder open + flat file listing.
 * Phase 2 will replace with the full workspace index from src-bak.
 */
export default function FileTree({
  currentFolder,
  activePath,
  onOpenFile,
  onOpenFolder,
}: FileTreeProps) {
  const [files, setFiles] = useState<FileEntry[]>([]);

  useEffect(() => {
    if (!currentFolder) return;
    invoke<FileEntry[]>('list_workspace_files', {
      folder: currentFolder,
    })
      .then(setFiles)
      .catch(console.warn);
  }, [currentFolder]);

  async function handleOpenFolder() {
    try {
      const selected = await openDialog({
        directory: true,
        multiple: false,
        title: 'Open workspace folder',
      });
      if (selected && typeof selected === 'string') {
        onOpenFolder(selected);
      }
    } catch (e) {
      console.error('Folder dialog failed:', e);
    }
  }

  function renderTree(entries: FileEntry[], depth: number = 0): React.ReactNode {
    return entries.map((entry) => (
      <div key={entry.path}>
        <div
          className={`file-tree-item ${entry.path === activePath ? 'active' : ''}`}
          style={{ paddingLeft: `${12 + depth * 16}px`, cursor: 'pointer' }}
          onClick={() => {
            if (entry.isDir) {
              // Toggle expand (Phase 2)
            } else {
              onOpenFile(entry.path);
            }
          }}
        >
          <span className="file-icon">{entry.isDir ? '📁' : '📄'}</span>
          <span className="file-name">{entry.name}</span>
        </div>
        {entry.children && renderTree(entry.children, depth + 1)}
      </div>
    ));
  }

  return (
    <div className="file-tree" style={{ height: '100%', overflow: 'auto' }}>
      <div className="file-tree-header" style={{ padding: '8px 12px', borderBottom: '1px solid var(--color-border)' }}>
        <button onClick={handleOpenFolder} style={{ width: '100%' }}>
          {currentFolder ? '📂 ' + currentFolder.split(/[/\\]/).pop() : 'Open Folder…'}
        </button>
      </div>
      <div className="file-tree-body">{renderTree(files)}</div>
    </div>
  );
}
