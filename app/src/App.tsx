import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import type { FileReadResult } from './types';
import { renderMarkdown, setMarkdownHardBreaks } from './lib/markdown';
import { isMobile } from './lib/platform';
import Editor from './components/Editor';
import Preview from './components/Preview';
import FileTree from './components/FileTree';
import StatusBar from './components/StatusBar';
import Toolbar from './components/Toolbar';

/**
 * SoloMD — React frontend root.
 *
 * Phase 1 (current): basic .md file open/edit/save + live preview.
 * Later phases incrementally add AI rewrite, Agent panel, recipes,
 * git sync, RAG, and the remaining panels from the original Vue app.
 */

export default function App() {
  const [activePath, setActivePath] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [htmlPreview, setHtmlPreview] = useState('');
  const [encoding, setEncoding] = useState('UTF-8');
  const [viewMode, setViewMode] = useState<'edit' | 'preview' | 'split'>('edit');
  const [showFileTree, setShowFileTree] = useState(true);
  const [isDirty, setIsDirty] = useState(false);
  const [savedContent, setSavedContent] = useState('');
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);

  // ---- Tauri event listeners ----
  useEffect(() => {
    const unlisteners: UnlistenFn[] = [];

    // Deep-link / file-open event (triggered by OS file association or CLI)
    listen<string>('open-file', (event) => {
      openFile(event.payload);
    }).then((fn) => unlisteners.push(fn));

    // Menu / tray events
    listen('menu-open-file', () => doOpenDialog()).then((fn) =>
      unlisteners.push(fn),
    );

    return () => {
      unlisteners.forEach((fn) => fn());
    };
  }, [currentFolder]);

  // ---- File operations ----
  async function openFile(path: string) {
    try {
      const result = await invoke<FileReadResult>('read_file', { path });
      setContent(result.content);
      setSavedContent(result.content);
      setEncoding(result.encoding);
      setActivePath(path);
      setIsDirty(false);
      setHtmlPreview(renderMarkdown(result.content));
    } catch (e) {
      console.error('Failed to open file:', e);
    }
  }

  async function doOpenDialog() {
    try {
      const selected = await openDialog({
        multiple: false,
        filters: [
          { name: 'Markdown', extensions: ['md', 'markdown', 'mdown', 'mkd'] },
          { name: 'Plain Text', extensions: ['txt'] },
          { name: 'All Files', extensions: ['*'] },
        ],
      });
      if (selected && typeof selected === 'string') {
        openFile(selected);
      }
    } catch (e) {
      console.error('Open dialog failed:', e);
    }
  }

  async function saveFile() {
    if (!activePath || !isDirty) return;
    try {
      await invoke('write_file', {
        path: activePath,
        content,
        encoding,
      });
      setSavedContent(content);
      setIsDirty(false);
      setHtmlPreview(renderMarkdown(content));
    } catch (e) {
      console.error('Failed to save file:', e);
    }
  }

  function handleContentChange(newContent: string) {
    setContent(newContent);
    setIsDirty(newContent !== savedContent);
  }

  function handleBlur() {
    setHtmlPreview(renderMarkdown(content));
  }

  // Open a folder as workspace
  async function openFolder(path: string) {
    setCurrentFolder(path);
  }

  return (
    <div className="app-root" data-theme="light">
      <Toolbar
        activePath={activePath}
        isDirty={isDirty}
        viewMode={viewMode}
        showFileTree={showFileTree}
        onOpenFile={doOpenDialog}
        onSave={saveFile}
        onToggleFileTree={() => setShowFileTree((v) => !v)}
        onToggleViewMode={() =>
          setViewMode((m) =>
            m === 'edit' ? 'preview' : m === 'preview' ? 'split' : 'edit',
          )
        }
      />

      <div
        className="app-body"
        style={{
          flex: 1,
          display: 'flex',
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        {showFileTree && (
          <aside className="sidebar">
            <FileTree
              currentFolder={currentFolder}
              activePath={activePath}
              onOpenFile={openFile}
              onOpenFolder={openFolder}
            />
          </aside>
        )}

        <main
          className="editor-area"
          style={{
            flex: 1,
            display: 'flex',
            minWidth: 0,
            overflow: 'hidden',
          }}
        >
          {(viewMode === 'edit' || viewMode === 'split') && (
            <div
              className="editor-pane"
              style={{ flex: viewMode === 'split' ? 1 : undefined }}
            >
              <Editor
                content={content}
                filePath={activePath}
                language={
                  activePath?.endsWith('.md') ? 'markdown' : 'plaintext'
                }
                onChange={handleContentChange}
                onBlur={handleBlur}
                onSave={saveFile}
              />
            </div>
          )}

          {(viewMode === 'preview' || viewMode === 'split') && (
            <div
              className="preview-pane"
              style={{ flex: viewMode === 'split' ? 1 : undefined }}
            >
              <Preview html={htmlPreview} />
            </div>
          )}
        </main>
      </div>

      <StatusBar
        activePath={activePath}
        encoding={encoding}
        isDirty={isDirty}
        viewMode={viewMode}
      />
    </div>
  );
}
