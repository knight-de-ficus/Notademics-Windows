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
import { confirm, open as openDialog } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { convertFileSrc } from '@tauri-apps/api/core';
import { addStyles, addThemeStyle, addCustomStyle } from '../util/theme';
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
    const isSupportedText = /\.(md|mdx|txt)$/i.test(filename);
    if (r.is_binary) {
      const shouldOpen = await confirm('该文件为二进制文件，是否仍要打开？', {
        title: '打开二进制文件',
        kind: 'warning',
        okLabel: '仍要打开',
        cancelLabel: '取消'
      });
      if (!shouldOpen) return;
    }
    // Only editor-supported text formats open directly. Binary files remain
    // opt-in through the warning above, regardless of their extension.
    if (!isSupportedText && !r.is_binary) return;
    useEditorStore.getState().NEW_TAB_WITH_CONTENT({
      markdownDocument: {
        markdown: r.content.replace(/\r\n|\r/g, '\n'),
        filename,
        pathname: path,
        encoding: r.encoding,
        lineEnding: /\r\n/.test(r.content) ? 'crlf' : 'lf',
        adjustLineEndingOnSave: /\r\n/.test(r.content)
      },
      options: {},
      selected: true
    });
  } catch (e) {
    console.error('open file from sidebar failed:', path, e);
  }
}

let bootstrapPromise: Promise<void> | null = null;

/** Register process-wide listeners exactly once, including after Preferences. */
function bootstrapApp(): Promise<void> {
  if (bootstrapPromise) return bootstrapPromise;
  bootstrapPromise = (async () => {
    const mainStore = useMainStore.getState();
    const projectStore = useProjectStore.getState();
    const preferencesStore = usePreferencesStore.getState();

    void mainStore.LISTEN_WIN_STATUS();
    await useCommandCenterStore.getState().LISTEN_COMMAND_CENTER_BUS();
    projectStore.LISTEN_FOR_UPDATE_PROJECT();
    projectStore.LISTEN_FOR_SIDEBAR_CONTEXT_MENU();
    await preferencesStore.ASK_FOR_USER_PREFERENCE();
    useNotificationStore.getState().listenForNotification();
    await registerEditorListeners();

    bus.on('sideBar::open-file', (path) => void openFileFromSidebar(String(path)));
    bus.on('sideBar::open-search-result', (payload) => {
      const path = String((payload as { path?: string } | undefined)?.path ?? '');
      if (path) void openFileFromSidebar(path);
    });
    bus.on('sideBar::open-workspace', (payload) => {
      void (async () => {
        let path = typeof payload === 'string' && payload ? payload : null;
        if (!path) {
          const selected = await openDialog({ directory: true, multiple: false, title: 'Open Folder' });
          if (selected && typeof selected === 'string') path = selected;
        }
        if (path) {
          await useProjectStore.getState().OPEN_PROJECT(path);
          void watchPath(path).catch(() => {});
        }
      })();
    });
    bus.on('SIDEBAR::remove', (payload) => {
      const path = String((payload as { path?: string } | undefined)?.path ?? '');
      if (path) void trashPath(path).catch(() => {});
    });
    bus.on('show-in-folder', (path) => {
      void invoke('shell_open_path', { path: String(path) }).catch(() => {});
    });
    bus.on('editor:close-unsaved-tab', (payload) => {
      const id = String((payload as { id?: string } | undefined)?.id ?? '');
      const store = useEditorStore.getState();
      const tab = store.tabs.find((item) => item.id === id);
      if (tab && window.confirm(`“${tab.filename}” has unsaved changes. Discard them and close the tab?`)) {
        store.FORCE_CLOSE_TAB(tab);
      }
    });

    await listen<string>('menu://action', (event) => {
      bus.emit('cmd::execute', String(event.payload));
    });

    // ASK_FOR_USER_PREFERENCE is asynchronous; read the fresh state afterwards.
    const loaded = usePreferencesStore.getState();
    addStyles({
      theme: loaded.theme || DEFAULT_STYLE.theme,
      codeFontFamily: loaded.codeFontFamily || DEFAULT_STYLE.codeFontFamily,
      codeFontSize: loaded.codeFontSize || DEFAULT_STYLE.codeFontSize,
      hideScrollbar: loaded.hideScrollbar
    });
    addCustomStyle({ customCss: loaded.customCss });
  })();
  return bootstrapPromise;
}

export default function AppPage() {
  const mainStore = useMainStore();
  const editorStore = useEditorStore();
  const preferencesStore = usePreferencesStore();
  const layoutStore = useLayoutStore();
  const projectStore = useProjectStore();
  const [init, setInit] = useState(false);

  // 初始化：注册所有事件监听 + 应用初始样式
  useEffect(() => {
    let mounted = true;
    void bootstrapApp().then(() => {
      if (mounted) setInit(true);
    });
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 主题实时换肤
  const theme = preferencesStore.theme;
  useEffect(() => {
    if (init) addThemeStyle(theme);
  }, [init, theme]);

  // 自定义 CSS 实时换肤
  const customCss = preferencesStore.customCss;
  useEffect(() => {
    if (init) addCustomStyle({ customCss });
  }, [customCss, init]);

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

  useEffect(() => {
    if (!init) return;
    void invoke('update_editor_menu_state', {
      payload: {
        hasDocument: hasCurrentFile,
        lineEnding: currentFile?.lineEnding ?? null
      }
    }).catch((error) => console.error('update editor menu state failed:', error));
  }, [currentFile?.lineEnding, hasCurrentFile, init]);
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
