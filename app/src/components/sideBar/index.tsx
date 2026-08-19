// 侧边栏 —— 对齐 marktext components/sideBar/index.vue 的结构与类名。
import { useEffect, useRef, useState } from 'react';
import { useLayoutStore } from '../../store/layout';
import Tree from './tree';
import Toc from './toc';
import Search from './search';

interface SideBarIcon {
  id: string
  icon: string // symbolIcon id
  title: string
}

const sideBarIcons: SideBarIcon[] = [
  { id: 'files', icon: 'icon-files', title: '文件夹' },
  { id: 'toc', icon: 'icon-tree', title: '大纲' }
]

export default function SideBar() {
  const layoutStore = useLayoutStore();
  const dragBarRef = useRef<HTMLDivElement>(null);

  const { rightColumn, showSideBar, sideBarWidth } = layoutStore;
  const [viewWidth, setViewWidth] = useState<number>(Number(sideBarWidth) || 280);

  useEffect(() => {
    setViewWidth(Number(sideBarWidth) || 280);
  }, [sideBarWidth]);

  const activeColumn = rightColumn === 'toc' ? 'toc' : rightColumn === 'search' ? 'search' : 'files';
  const finalSideBarWidth = !showSideBar ? 0 : viewWidth < 220 ? 220 : viewWidth;

  // 拖拽调宽
  useEffect(() => {
    const dragBarEl = dragBarRef.current;
    if (!dragBarEl) return;
    let startX = 0;
    let currentWidth = Number(sideBarWidth) || 280;
    let startWidth = currentWidth;

    const mouseUp = (): void => {
      document.removeEventListener('mousemove', mouseMove, false);
      document.removeEventListener('mouseup', mouseUp, false);
      void layoutStore.SET_SIDE_BAR_WIDTH(currentWidth < 220 ? 220 : currentWidth);
    };
    const mouseMove = (event: MouseEvent): void => {
      currentWidth = startWidth + (event.clientX - startX);
      setViewWidth(currentWidth);
    };
    const mouseDown = (event: MouseEvent): void => {
      startX = event.clientX;
      startWidth = Number(sideBarWidth) || 280;
      document.addEventListener('mousemove', mouseMove, false);
      document.addEventListener('mouseup', mouseUp, false);
    };
    dragBarEl.addEventListener('mousedown', mouseDown, false);
    return () => dragBarEl.removeEventListener('mousedown', mouseDown, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rightColumn]);

  const handleIconClick = (name: string): void => {
    layoutStore.SET_LAYOUT({ rightColumn: name as 'files' | 'toc' });
    setViewWidth(Number(sideBarWidth) || 280);
  };

  if (!showSideBar) return null;

  return (
    <div
      className="side-bar"
      style={{ width: `${finalSideBarWidth}px` }}
    >
      <div className="side-bar-tabs" role="tablist" aria-label="Sidebar">
        {sideBarIcons.map((item) => (
          <button
            type="button"
            role="tab"
            aria-selected={item.id === activeColumn}
            key={item.id}
            className={item.id === activeColumn ? 'active' : ''}
            onClick={() => handleIconClick(item.id)}
            title={item.title}
          >
            <svg className="icon" aria-hidden="true"><use xlinkHref={`#${item.icon}`} /></svg>
            <span>{item.title}</span>
          </button>
        ))}
      </div>
      <div className="right-column">
        {activeColumn === 'files' && <Tree />}
        {activeColumn === 'toc' && <Toc />}
        {activeColumn === 'search' && <Search />}
      </div>
      <div ref={dragBarRef} className="drag-bar" />
    </div>
  );
}
