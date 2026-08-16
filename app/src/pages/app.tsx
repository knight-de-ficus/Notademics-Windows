// 主编辑页 —— 对齐 marktext pages/app.vue 的布局与初始化逻辑。
import { useEffect, useState } from 'react';
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
import { addStyles, addThemeStyle, addCustomStyle, type AddStylesOptions } from '../util/theme';
import { DEFAULT_STYLE } from '../config';
import { watchPath } from '../lib/tauri';
import SideBar from '../components/sideBar/index';
import TitleBar from '../components/titleBar/index';
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
      bus.on('sideBar::open-workspace', () => {
        void (async () => {
          const s = await openDialog({ directory: true, multiple: false, title: 'Open Folder' });
          if (s && typeof s === 'string') {
            await projectStore.OPEN_PROJECT(s);
            void watchPath(s).catch(() => {});
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

      // Rust 原生菜单点击 → 命令中心执行（菜单 id 与命令 id 一致）
      bus.on('menu://action', (id) => {
        bus.emit('cmd::execute', String(id));
      });

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

  return (
    <div className="editor-container">
      {init && <SideBar />}

      <div className="editor-middle">
        <TitleBar
          project={projectTree}
          pathname={currentFile?.pathname}
          filename={currentFile?.filename}
          active={windowActive}
          wordCount={currentFile?.wordCount ?? null}
          platform={platform}
          isSaved={currentFile?.isSaved}
          onRename={() => {
            if (currentFile) bus.emit('rename', { id: currentFile.id, pathname: currentFile.pathname, filename: currentFile.filename });
          }}
        />

        {!init && <div className="editor-placeholder" />}
        {!hasCurrentFile && init && <Recent />}
        {hasCurrentFile && init && (
          <EditorWithTabs />
        )}
        <CommandPalette />
        <AboutDialog />
        <Rename />
        <ImportModal />
      </div>
    </div>
  );
}
