// 侧边栏 —— 对齐 marktext components/sideBar/index.vue 的结构与类名。
import { useEffect, useRef, useState } from 'react';
import { useLayoutStore } from '../../store/layout';
import { useProjectStore } from '../../store/project';
import { useEditorStore } from '../../store/editor';
import Tree from './tree';
import Toc from './toc';
import SideBarSearch from './search';
import { t } from '../../i18n';

interface SideBarIcon {
  id: string
  icon: string // symbolIcon id
  title: string
}

const sideBarIcons: SideBarIcon[] = [
  { id: 'files', icon: 'icon-files', title: 'Files' },
  { id: 'search', icon: 'icon-search', title: 'Search' },
  { id: 'toc', icon: 'icon-tree', title: 'Table of Contents' }
]

export default function SideBar() {
  const layoutStore = useLayoutStore();
  const projectStore = useProjectStore();
  const editorStore = useEditorStore();
  const dragBarRef = useRef<HTMLDivElement>(null);

  const { rightColumn, showSideBar, sideBarWidth } = layoutStore;
  const [viewWidth, setViewWidth] = useState<number>(Number(sideBarWidth) || 280);

  useEffect(() => {
    setViewWidth(Number(sideBarWidth) || 280);
  }, [sideBarWidth]);

  const finalSideBarWidth = !showSideBar ? 0 : !rightColumn ? 45 : viewWidth < 220 ? 220 : viewWidth;

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

  const handleLeftIconClick = (name: string): void => {
    if (rightColumn === name) {
      layoutStore.SET_LAYOUT({ rightColumn: '' });
    } else {
      layoutStore.SET_LAYOUT({ rightColumn: name as 'files' | 'search' | 'toc' });
      setViewWidth(Number(sideBarWidth) || 280);
    }
  };

  const handleLeftBottomClick = (name: string): void => {
    if (name === 'settings') {
      // 打开偏好设置窗口（单窗口应用内跳转 /preference）
      window.location.hash = '#/preference/general';
    }
  };

  if (!showSideBar) return null;

  return (
    <div
      className="side-bar"
      style={!rightColumn ? { minWidth: '45px', width: `${finalSideBarWidth}px` } : { width: `${finalSideBarWidth}px` }}
    >
      <div className="left-column">
        <ul>
          {sideBarIcons.map((c) => (
            <li
              key={c.id}
              className={c.id === rightColumn ? 'active' : ''}
              onClick={() => handleLeftIconClick(c.id)}
              title={c.title}
            >
              <svg className="icon" aria-hidden="true"><use xlinkHref={`#${c.icon}`} /></svg>
            </li>
          ))}
        </ul>
        <ul className="bottom">
          <li onClick={() => handleLeftBottomClick('settings')} title={t('sideBar.icons.settings')}>
            <svg className="icon" aria-hidden="true"><use xlinkHref="#icon-gear" /></svg>
          </li>
        </ul>
      </div>
      <div className="right-column" style={{ display: rightColumn ? 'block' : 'none' }}>
        {rightColumn === 'files' && <Tree />}
        {rightColumn === 'search' && <SideBarSearch />}
        {rightColumn === 'toc' && <Toc />}
      </div>
      {rightColumn && <div ref={dragBarRef} className="drag-bar" />}
    </div>
  );
}
