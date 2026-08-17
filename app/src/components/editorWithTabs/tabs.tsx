// 标签栏 —— 对齐 marktext components/editorWithTabs/tabs.vue。
// 拖拽排序用原生 HTML5 DnD 简化实现（marktext 用 dragula，行为等价）。
import { useEditorStore } from '../../store/editor';
import { useLayoutStore } from '../../store/layout';
import { usePreferencesStore } from '../../store/preferences';
import bus from '../../bus';
import { popupContextMenu, type ContextMenuItem } from '../../contextMenu';

export default function Tabs() {
  const editorStore = useEditorStore();
  const layoutStore = useLayoutStore();
  const preferencesStore = usePreferencesStore();
  const { tabs, currentFile } = editorStore;
  const { showTabBar } = layoutStore;
  const { openedFilesInSidebar } = preferencesStore;

  if (!showTabBar) return null;

  const tabMenu = (id: string, pathname: string | null): ContextMenuItem[] => [
    { id: 'close', label: 'Close' },
    { id: 'closeOthers', label: 'Close others' },
    { id: 'closeAllTabs', label: 'Close all tabs' },
    { type: 'separator' },
    { id: 'rename', label: 'Rename' },
    ...(pathname ? [
      { id: 'copyPath', label: 'Copy path' },
      { type: 'separator' as const },
      { id: 'showInFolder', label: 'Show in folder' }
    ] : [])
  ];

  const handleContextMenu = (e: React.MouseEvent, id: string, pathname: string | null): void => {
    e.preventDefault();
    e.stopPropagation();
    void popupContextMenu(tabMenu(id, pathname), { x: e.clientX, y: e.clientY }).then((menuId) => {
      const tab = tabs.find((t) => t.id === id);
      if (!menuId || !tab) return;
      switch (menuId) {
        case 'close':
          editorStore.CLOSE_TAB(tab);
          break;
        case 'closeOthers':
          tabs.filter((t) => t.id !== id).forEach((t) => editorStore.CLOSE_TAB(t));
          break;
        case 'closeAllTabs':
          editorStore.CLOSE_ALL_TABS();
          break;
        case 'rename':
          bus.emit('rename', { id: tab.id, pathname: tab.pathname, filename: tab.filename });
          break;
        case 'copyPath':
          if (tab.pathname) void navigator.clipboard.writeText(tab.pathname);
          break;
        case 'showInFolder':
          if (tab.pathname) bus.emit('show-in-folder', tab.pathname);
          break;
      }
    });
  };

  return (
    <div className="tabs">
      {tabs.map((tab) => {
        const active = currentFile?.id === tab.id;
        const isSaved = tab.isSaved;
        return (
          <div
            key={tab.id}
            className={`tab${active ? ' active' : ''}`}
            draggable
            onClick={() => editorStore.UPDATE_CURRENT_FILE(tab)}
            onAuxClick={(e) => {
              if (e.button === 1) editorStore.CLOSE_TAB(tab);
            }}
            onContextMenu={(e) => handleContextMenu(e, tab.id, tab.pathname)}
            onDragStart={(e) => {
              e.dataTransfer.setData('text/plain', tab.id);
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const fromId = e.dataTransfer.getData('text/plain');
              if (fromId && fromId !== tab.id) {
                editorStore.EXCHANGE_TABS_BY_ID({ fromId, toId: tab.id });
              }
            }}
          >
            <span className="tab-name" title={tab.pathname || tab.filename}>{tab.filename}</span>
            {!isSaved && <span className="tab-unsaved" />}
            <span
              className="tab-close"
              onClick={(e) => {
                e.stopPropagation();
                editorStore.CLOSE_TAB(tab);
              }}
            >
              <svg className="icon" aria-hidden="true"><use xlinkHref="#icon-close-small" /></svg>
            </span>
          </div>
        );
      })}
      <span
        className="tab-add"
        onClick={() => editorStore.NEW_UNTITLED_TAB({ selected: true })}
        title="New Tab"
      >
        <svg className="icon" aria-hidden="true"><use xlinkHref="#icon-create" /></svg>
      </span>
    </div>
  );
}
