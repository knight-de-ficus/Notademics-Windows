// 文件树 —— 对齐 marktext components/sideBar/tree.vue。
// 顶部"已打开文件"列表 + 项目目录树（懒加载展开）。
import { useEffect, useState } from 'react';
import { useEditorStore } from '../../store/editor';
import { useProjectStore, type TreeNode } from '../../store/project';
import { usePreferencesStore } from '../../store/preferences';
import bus from '../../bus';
import { listDir } from '../../lib/tauri';
import { t } from '../../i18n';
import { handleContextMenuEvent, type ContextMenuItem } from '../../contextMenu';

const MARKDOWN_EXT = /\.(md|mdx|markdown|mdown|mkd|txt)$/i

function TreeFolder({ node, depth }: { node: TreeNode; depth: number }) {
  const projectStore = useProjectStore();
  const [opened, setOpened] = useState(!!node.opened);
  const [children, setChildren] = useState<TreeNode[] | null>(node.children ?? null);

  useEffect(() => {
    if (opened && children === null) {
      listDir(node.path)
        .then((list) => setChildren(list.map((e) => ({ name: e.name, path: e.path, isDirectory: e.is_dir }))))
        .catch(() => setChildren([]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened]);

  const menu: ContextMenuItem[] = [
    { id: 'newFile', label: t('contextMenu.sideBar.newFile') },
    { id: 'newDirectory', label: t('contextMenu.sideBar.newDirectory') },
    { type: 'separator' },
    { id: 'rename', label: t('contextMenu.sideBar.rename') },
    { id: 'moveToTrash', label: t('contextMenu.sideBar.moveToTrash') },
    { id: 'showInFolder', label: t('contextMenu.sideBar.showInFolder') }
  ];

  return (
    <div className="tree-folder">
      <div
        className={`tree-item tree-folder-item${opened ? ' opened' : ''}`}
        style={{ paddingLeft: 6 + depth * 14 }}
        onClick={() => setOpened((v) => !v)}
        onContextMenu={(e) =>
          handleContextMenuEvent(e, menu, (menuId) => {
            switch (menuId) {
              case 'newFile':
              case 'newDirectory':
                bus.emit('SIDEBAR::new', { dirname: node.path, type: menuId === 'newFile' ? 'file' : 'directory' });
                break;
              case 'rename':
                bus.emit('SIDEBAR::rename', { path: node.path });
                break;
              case 'moveToTrash':
                bus.emit('SIDEBAR::remove', { path: node.path });
                break;
              case 'showInFolder':
                bus.emit('show-in-folder', node.path);
                break;
            }
          })
        }
      >
        <span className="icon">
          <svg className="icon" aria-hidden="true">
            <use xlinkHref={opened ? '#icon-folder-open' : '#icon-folder-close'} />
          </svg>
        </span>
        <span className="text">{node.name}</span>
      </div>
      {opened && children && (
        <div className="tree-children">
          {children.map((child) =>
            child.isDirectory ? (
              <TreeFolder key={child.path} node={child} depth={depth + 1} />
            ) : (
              <TreeFile key={child.path} node={child} depth={depth + 1} />
            )
          )}
        </div>
      )}
    </div>
  );
}

function TreeFile({ node, depth }: { node: TreeNode; depth: number }) {
  const editorStore = useEditorStore();
  const projectStore = useProjectStore();
  const active = projectStore.activeItem?.path === node.path;

  return (
    <div
      className={`tree-item tree-file-item${active ? ' active' : ''}`}
      style={{ paddingLeft: 6 + depth * 14 }}
      onClick={() => bus.emit('sideBar::open-file', node.path)}
      onContextMenu={(e) =>
        handleContextMenuEvent(
          e,
          [
            { id: 'open', label: 'Open' },
            { type: 'separator' },
            { id: 'rename', label: t('contextMenu.sideBar.rename') },
            { id: 'moveToTrash', label: t('contextMenu.sideBar.moveToTrash') },
            { id: 'showInFolder', label: t('contextMenu.sideBar.showInFolder') }
          ],
          (menuId) => {
            switch (menuId) {
              case 'open':
                bus.emit('sideBar::open-file', node.path);
                break;
              case 'rename':
                bus.emit('SIDEBAR::rename', { path: node.path });
                break;
              case 'moveToTrash':
                bus.emit('SIDEBAR::remove', { path: node.path });
                break;
              case 'showInFolder':
                bus.emit('show-in-folder', node.path);
                break;
            }
          }
        )
      }
    >
      <span className="icon">
        <svg className="icon" aria-hidden="true"><use xlinkHref="#icon-markdown" /></svg>
      </span>
      <span className="text">{node.name}</span>
    </div>
  );
}

export default function Tree() {
  const projectStore = useProjectStore();
  const editorStore = useEditorStore();
  const preferencesStore = usePreferencesStore();
  const { projectTree } = projectStore;
  const { tabs } = editorStore;
  const { openedFilesInSidebar } = preferencesStore;
  const [showOpenedFiles, setShowOpenedFiles] = useState(true);

  return (
    <div className="tree-view">
      <div className="title" />

      {openedFilesInSidebar && tabs.length > 0 && (
        <div className="opened-files">
          <div className="title" onClick={() => setShowOpenedFiles((v) => !v)}>
            <svg className="icon-arrow" aria-hidden="true" style={{ transform: showOpenedFiles ? 'none' : 'rotate(90deg)' }}>
              <use xlinkHref="#icon-arrow-right" />
            </svg>
            <span className="default-cursor text-overflow">{t('sideBar.tree.openedFiles')}</span>
            <a title={t('sideBar.tree.saveAll')} onClick={(e) => { e.stopPropagation(); void editorStore.ASK_FOR_SAVE_ALL(false); }}>
              <svg className="icon" aria-hidden="true"><use xlinkHref="#icon-save-all" /></svg>
            </a>
            <a title={t('sideBar.tree.closeAll')} onClick={(e) => { e.stopPropagation(); void editorStore.ASK_FOR_SAVE_ALL(true); }}>
              <svg className="icon" aria-hidden="true"><use xlinkHref="#icon-close-all" /></svg>
            </a>
          </div>
          {showOpenedFiles && (
            <div className="opened-files-list">
              {tabs.map((tab) => (
                <div
                  key={tab.id}
                  className={`tree-item opened-file${tab.id === editorStore.currentFile?.id ? ' active' : ''}`}
                  onClick={() => editorStore.UPDATE_CURRENT_FILE(tab)}
                >
                  <span className="save-dot" style={{ opacity: tab.isSaved ? 0 : 1 }} />
                  <span className="text text-overflow">{tab.filename}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="project-tree">
        {!projectTree && (
          <div className="tree-empty">
            <span className="tree-empty-title">{t('sideBar.tree.emptyProject')}</span>
            <button className="tree-open-folder" onClick={() => projectStore.OPEN_PROJECT('')}>{t('sideBar.tree.openFolder')}</button>
          </div>
        )}
        {projectTree && (
          <TreeFolder node={projectTree} depth={0} />
        )}
      </div>
    </div>
  );
}
