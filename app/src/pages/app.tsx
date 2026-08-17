// 主编辑页 —— 对齐 marktext pages/app.vue 的布局与初始化逻辑。
import { useEffect, useState, type CSSProperties } from 'react';
import { useMainStore } from '../store';
import { useEditorStore } from '../store/editor';
import { usePreferencesStore } from '../store/preferences';
import { useLayoutStore } from '../store/layout';
import { useProjectStore } from '../store/project';
import { useCommandCenterStore } from '../store/commandCenter';
import { useNotificationStore } from '../store/notification';
import { registerListeners as registerEditorListeners } from '../store/editor';
import { readFile, trashPath } from '../lib/tauri';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { convertFileSrc } from '@tauri-apps/api/core';
import { addStyles, addThemeStyle, addCustomStyle, type AddStylesOptions } from '../util/theme';
import { DEFAULT_STYLE } from '../config';
import { watchPath } from '../lib/tauri';
import SideBar from '../components/sideBar/index';
import StatusBar from '../components/statusBar/index';
import Recent from '../components/recent/index';
import EditorWithTabs from '../components/editorWithTabs/index';
import CommandPalette from '../components/commandPalette/index';
import AboutDialog from '../components/about/index';
import Rename from '../components/rename/index';
import ImportModal from '../components/import/index';
import bus from '../bus';

// 侧边栏点击文件 → 读取并打开为新标签（与 marktext 打开文件行为一致）
async function openFileFromSidebar(path: string): Promise<void> {
  try {
    const r = await readFile(path);
    const filename = path.split(/[\\/]/).pop() ?? path;
    const isMarkdown = /\.(md|mdx|markdown|mdown|mkd)$/i.test(filename);
    useEditorStore.getState().NEW_TAB_WITH_CONTENT({
      markdownDocument: {
        markdown: r.content,
        filename,
        pathname: path,
        encoding: r.encoding
      },
      options: {},
      selected: true
    });
  } catch (e) {
    console.error('open file from sidebar failed:', path, e);
  }
}

export default function AppPage() {
  const mainStore = useMainStore();
  const editorStore = useEditorStore();
  const preferencesStore = usePreferencesStore();
  const layoutStore = useLayoutStore();
  const projectStore = useProjectStore();
  const commandCenterStore = useCommandCenterStore();
  const notificationStore = useNotificationStore();

  const [init, setInit] = useState(false);

  // 初始化：注册所有事件监听 + 应用初始样式
  useEffect(() => {
    const run = async (): Promise<void> => {
      mainStore.LISTEN_WIN_STATUS();
      await commandCenterStore.LISTEN_COMMAND_CENTER_BUS();
      projectStore.LISTEN_FOR_UPDATE_PROJECT();
      projectStore.LISTEN_FOR_SIDEBAR_CONTEXT_MENU();
      await preferencesStore.ASK_FOR_USER_PREFERENCE();
      notificationStore.listenForNotification();
      await registerEditorListeners();

      // 侧边栏 bus 接线
      bus.on('sideBar::open-file', (path) => {
        void openFileFromSidebar(String(path));
      });
      bus.on('sideBar::open-search-result', (payload) => {
        const p = (payload ?? {}) as { path: string };
        void openFileFromSidebar(p.path);
      });
      bus.on('sideBar::open-workspace', (payload) => {
        void (async () => {
          // 已有路径（来自 file.open-folder 命令）直接打开；否则弹对话框
          let path = typeof payload === 'string' && payload ? payload : null
          if (!path) {
            const s = await openDialog({ directory: true, multiple: false, title: 'Open Folder' });
            if (s && typeof s === 'string') path = s;
          }
          if (path) {
            await projectStore.OPEN_PROJECT(path);
            void watchPath(path).catch(() => {});
          }
        })();
      });
      bus.on('SIDEBAR::remove', (payload) => {
        const p = (payload ?? {}) as { path: string };
        if (p.path) void trashPath(p.path).catch(() => {});
      });
      bus.on('show-in-folder', (path) => {
        void invoke('shell_open_path', { path: String(path) }).catch(() => {});
      });
      bus.on('editor:close-unsaved-tab', (payload) => {
        const id = String((payload as { id?: string } | undefined)?.id ?? '');
        const tab = useEditorStore.getState().tabs.find((item) => item.id === id);
        if (tab && window.confirm(`“${tab.filename}” has unsaved changes. Discard them and close the tab?`)) {
          useEditorStore.getState().FORCE_CLOSE_TAB(tab);
        }
      });

      // Rust 原生菜单点击 → 命令中心执行（菜单 id 与命令 id 一致）。
      // 注意：这是 Tauri 事件通道（Rust app.emit），不是 mitt 总线，必须用 listen。
      const unlistenMenu = await listen<string>('menu://action', (e) => {
        bus.emit('cmd::execute', String(e.payload));
      });
      void unlistenMenu;

      // 应用初始主题 / 字体样式
      const style: AddStylesOptions = {
        theme: preferencesStore.theme || DEFAULT_STYLE.theme,
        codeFontFamily: preferencesStore.codeFontFamily || DEFAULT_STYLE.codeFontFamily,
        codeFontSize: preferencesStore.codeFontSize || DEFAULT_STYLE.codeFontSize,
        hideScrollbar: preferencesStore.hideScrollbar
      };
      addStyles(style);
      if (preferencesStore.customCss) {
        addCustomStyle({ customCss: preferencesStore.customCss });
      }

      setInit(true);
    };
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 主题实时换肤
  const theme = preferencesStore.theme;
  useEffect(() => {
    addThemeStyle(theme);
  }, [theme]);

  // 自定义 CSS 实时换肤
  const customCss = preferencesStore.customCss;
  useEffect(() => {
    addCustomStyle({ customCss });
  }, [customCss]);

  const { windowActive, platform } = mainStore;
  const currentFile = editorStore.currentFile;
  const hasCurrentFile = !!currentFile;
  const showTabBar = layoutStore.showTabBar;
  const sourceCode = preferencesStore.sourceCode;
  const textDirection = preferencesStore.textDirection;
  const projectTree = projectStore.projectTree;
  const backgroundPath = preferencesStore.editorBackgroundImage;
  const backgroundPosition = preferencesStore.editorBackgroundPosition.replace('-', ' ');
  const backgroundFit = preferencesStore.editorBackgroundFit;
  const backgroundStyle = backgroundPath ? {
    '--editor-background-image': `url("${/^(data:|https?:|blob:)/i.test(backgroundPath) ? backgroundPath : convertFileSrc(backgroundPath)}")`,
    '--editor-background-position': backgroundPosition,
    '--editor-background-size': backgroundFit === 'stretch' ? '100% 100%' : backgroundFit === 'tile' ? 'auto' : backgroundFit,
    '--editor-background-repeat': backgroundFit === 'tile' ? 'repeat' : 'no-repeat',
    '--editor-background-opacity': String(preferencesStore.editorBackgroundOpacity)
  } as CSSProperties : undefined;

  return (
    <div className="editor-container">
      {init && <SideBar />}

      <div className={`editor-middle${backgroundPath ? ' has-editor-background' : ''}`} style={backgroundStyle}>
        {!init && <div className="editor-placeholder" />}
        {!hasCurrentFile && init && <Recent />}
        {hasCurrentFile && init && (
          <EditorWithTabs />
        )}
        <CommandPalette />
        <AboutDialog />
        <Rename />
        <ImportModal />
        {/* 状态栏固定在底部：仅当有文件打开时显示，字数来自当前 tab */}
        {init && hasCurrentFile && <StatusBar />}
      </div>
    </div>
  );
}
