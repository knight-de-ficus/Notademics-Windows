// 编辑器+标签容器 —— 对齐 marktext components/editorWithTabs/index.vue。
import { useLayoutStore } from '../../store/layout';
import { usePreferencesStore } from '../../store/preferences';
import { useEditorStore } from '../../store/editor';
import Tabs from './tabs';
import Editor from './editor';
import SourceCode from './sourceCode';

export default function EditorWithTabs() {
  const layoutStore = useLayoutStore();
  const preferencesStore = usePreferencesStore();
  const editorStore = useEditorStore();
  const { showSideBar, rightColumn, sideBarWidth } = layoutStore;
  const { sourceCode } = preferencesStore;
  const currentFile = editorStore.currentFile;

  if (!currentFile) return null;

  // 与 marktext layout store 的 effectiveSideBarWidth 计算一致
  const effectiveSideBarWidth = !showSideBar ? 0 : !rightColumn ? 45 : Number(sideBarWidth);

  return (
    <div
      className="editor-with-tabs"
      style={{ maxWidth: `calc(100vw - ${effectiveSideBarWidth}px)` }}
    >
      <Tabs />
      <div className="container">
        <Editor
          markdown={currentFile.markdown}
          textDirection={preferencesStore.textDirection}
        />
        {sourceCode && <SourceCode markdown={currentFile.markdown} textDirection={preferencesStore.textDirection} />}
      </div>
    </div>
  );
}
