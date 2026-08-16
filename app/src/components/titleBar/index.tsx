// 自绘标题栏 —— 对齐 marktext components/titleBar/index.vue 的结构与类名。
// 路径面包屑 / 未保存圆点 / 字数统计 / 窗口控制按钮（Tauri invoke）。
import { useCallback, useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { usePreferencesStore } from '../../store/preferences';
import { useLayoutStore } from '../../store/layout';
import { PATH_SEPARATOR, isOsx } from '../../config';
import { shouldShowInAppTitleBar } from './visibility';
import { closePath, restorePath, maximizePath, minimizePath } from '../../assets/window-controls';
import type { FileWordCount } from '../../shared/types/files';
import bus from '../../bus';

interface TitleBarProps {
  project?: { name?: string } | null;
  filename?: string;
  pathname?: string;
  active?: boolean;
  wordCount?: FileWordCount | null;
  platform?: string;
  isSaved?: boolean;
  onRename?: () => void;
}

const HASH = {
  word: { short: 'W', full: 'word' },
  character: { short: 'C', full: 'character' },
  paragraph: { short: 'P', full: 'paragraph' },
  all: { short: 'A', full: '(with space)character' }
} as const;

type ShowType = keyof typeof HASH;

export default function TitleBar(props: TitleBarProps) {
  const { filename, pathname, active, wordCount, isSaved, onRename } = props;
  const preferencesStore = usePreferencesStore();
  const layoutStore = useLayoutStore();
  const { titleBarStyle } = preferencesStore;
  const { showTabBar } = layoutStore;

  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [show, setShow] = useState<ShowType>('word');

  const showTitleBar = shouldShowInAppTitleBar(titleBarStyle, isOsx);
  const showCustomTitleBar = titleBarStyle === 'custom' && !isOsx;

  useEffect(() => {
    try {
      invoke<boolean>('win_is_maximized').then((m) => setIsMaximized(m)).catch(() => {});
    } catch { /* ignore */ }
  }, []);

  // 路径面包屑（最后 3 段）
  const paths: string[] = (() => {
    if (!pathname) return [];
    return pathname
      .split(PATH_SEPARATOR)
      .filter((i) => i)
      .slice(0, -1)
      .slice(-3);
  })();

  // 文档标题跟随
  useEffect(() => {
    const hasOpenFolder = !!(props.project && props.project.name);
    const projectName = props.project?.name ?? '';
    if (filename) {
      document.title = hasOpenFolder ? `${filename} - ${projectName}` : filename;
    } else {
      document.title = hasOpenFolder ? projectName : '';
    }
  }, [filename, props.project]);

  const handleWordClick = useCallback(() => {
    const ITEMS: ShowType[] = ['word', 'paragraph', 'character', 'all'];
    setShow((s) => ITEMS[(ITEMS.indexOf(s) + 1) % ITEMS.length]);
  }, []);

  // 汉堡菜单：弹出应用菜单（对齐 marktext frameless-titlebar-menu）
  const handleMenuClick = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const { Menu, MenuItem, PredefinedMenuItem } = await import('@tauri-apps/api/menu');
      const make = (id: string, text: string) =>
        MenuItem.new({ id, text, action: () => {
          if (id === 'file.preferences') {
            window.location.hash = '#/preference/general';
          } else {
            bus.emit('cmd::execute', id);
          }
        } });
      const items = [
        await make('file.new', 'New Tab'),
        await make('file.open', 'Open File…'),
        await make('file.openFolder', 'Open Folder…'),
        await PredefinedMenuItem.new({ item: 'Separator' }),
        await make('file.save', 'Save'),
        await make('file.saveAs', 'Save As…'),
        await PredefinedMenuItem.new({ item: 'Separator' }),
        await make('edit.find', 'Find…'),
        await make('view.sourceCodeMode', 'Source Code Mode'),
        await make('view.toggleTheme', 'Toggle Theme'),
        await PredefinedMenuItem.new({ item: 'Separator' }),
        await make('file.preferences', 'Preferences…')
      ];
      const menu = await Menu.new({ items: items as never[] });
      void menu.popup();
    } catch (err) {
      console.error('menu popup failed:', err);
    }
  }, []);

  const windowControls = (
    <>
      {showCustomTitleBar && !isFullScreen && !isOsx && (
        <div className="right-toolbar title-no-drag">
          <div
            className="frameless-titlebar-button frameless-titlebar-close"
            onClick={(e) => {
              e.stopPropagation();
              invoke('win_close').catch(() => {});
            }}
          >
            <div>
              <svg width="10" height="10">
                <path d={closePath} />
              </svg>
            </div>
          </div>
          <div
            className="frameless-titlebar-button frameless-titlebar-toggle"
            onClick={(e) => {
              e.stopPropagation();
              invoke('win_toggle_maximize').catch(() => {});
            }}
          >
            <div>
              <svg width="10" height="10">
                {!isMaximized ? (
                  <path d={maximizePath} />
                ) : (
                  <path d={restorePath} />
                )}
              </svg>
            </div>
          </div>
          <div
            className="frameless-titlebar-button frameless-titlebar-minimize"
            onClick={(e) => {
              e.stopPropagation();
              invoke('win_minimize').catch(() => {});
            }}
          >
            <div>
              <svg width="10" height="10">
                <path d={minimizePath} />
              </svg>
            </div>
          </div>
        </div>
      )}
    </>
  );

  if (!showTitleBar) return null;

  return (
    <>
      <div className={`title-bar-editor-bg${showTabBar ? ' tabs-visible' : ''}`} />
      <div
        className={`title-bar${active ? ' active' : ''}${showTabBar ? ' tabs-visible' : ''}${titleBarStyle === 'custom' ? ' frameless' : ''}${isOsx ? ' isOsx' : ''}`}
      >
        <div className="title" onDoubleClick={() => {
          if (isOsx) invoke('win_toggle_maximize').catch(() => {});
        }}>
          {!filename ? (
            <span>Notademics</span>
          ) : (
            <>
              <span>
                {paths.map((path, index) => (
                  <span key={index}>
                    {path}
                    <span className="path-arrow" style={{ fontSize: 12 }}>›</span>
                  </span>
                ))}
              </span>
              <span className={`filename${isOsx ? ' isOsx' : ''}`} onClick={onRename}>
                {filename}
              </span>
              <span className={`save-dot${isSaved === false ? ' show' : ''}`} />
            </>
          )}
        </div>
        <div className={showCustomTitleBar ? 'left-toolbar title-no-drag' : 'right-toolbar'}>
          {showCustomTitleBar && (
            <div className="frameless-titlebar-menu title-no-drag" onClick={handleMenuClick}>
              <span className="text-center-vertical">&#9776;</span>
            </div>
          )}
          {wordCount && (
            <div className="word-count" onClick={handleWordClick} title={HASH[show].full}>
              <span className="text-center-vertical">{`${HASH[show].short} ${wordCount[show]}`}</span>
            </div>
          )}
        </div>
        {windowControls}
      </div>
    </>
  );
}
