// 文件树 —— 仅显示工作区目录（懒加载展开），不重复显示编辑器标签。
import { useEffect, useState, type MouseEvent } from 'react';
import { useProjectStore, type TreeNode } from '../../store/project';
import bus from '../../bus';
import { listDir } from '../../lib/tauri';
import { t } from '../../i18n';
import { handleContextMenuEvent, type ContextMenuItem } from '../../contextMenu';

const IMAGE_EXT = /\.(avif|bmp|gif|ico|jpe?g|png|svg|webp)$/i

const relativeToWorkspace = (path: string, workspace: string): string => {
  const normalizedPath = path.replace(/\\/g, '/');
  const normalizedWorkspace = workspace.replace(/\\/g, '/').replace(/\/$/, '');
  if (normalizedPath.toLowerCase().startsWith(`${normalizedWorkspace.toLowerCase()}/`)) {
    return normalizedPath.slice(normalizedWorkspace.length + 1);
  }
  return normalizedPath;
}

function TreeFolder({ node, depth }: { node: TreeNode; depth: number }) {
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
  const projectStore = useProjectStore();
  const active = projectStore.activeItem?.path === node.path;
  const isImage = IMAGE_EXT.test(node.name);

  const insertImage = (event: MouseEvent<HTMLButtonElement>): void => {
    event.stopPropagation();
    const workspace = projectStore.projectTree?.path;
    if (!workspace) return;
    const relativePath = relativeToWorkspace(node.path, workspace).replace(/([()])/g, '\\$1');
    bus.emit('insert-text-at-cursor', `![图片图标](${relativePath})`);
  };

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
      {isImage && (
        <button
          type="button"
          className="tree-insert-image"
          title="在光标处插入图片"
          aria-label={`插入图片 ${node.name}`}
          onClick={insertImage}
        >&lt;/&gt;</button>
      )}
    </div>
  );
}

export default function Tree() {
  const projectStore = useProjectStore();
  const { projectTree } = projectStore;

  return (
    <div className="tree-view">
      <div className="title" />

      <div className="project-tree">
        {!projectTree && (
          <div className="tree-empty">
            <span className="tree-empty-title">{t('sideBar.tree.emptyProject')}</span>
            <button className="tree-open-folder" onClick={() => bus.emit('sideBar::open-workspace')}>{t('sideBar.tree.openFolder')}</button>
          </div>
        )}
        {projectTree && (
          <TreeFolder node={projectTree} depth={0} />
        )}
      </div>
    </div>
  );
}
