// 空态欢迎页 —— 对齐 marktext components/recent/index.vue。
import { useEditorStore } from '../../store/editor';
import { t } from '../../i18n';

export default function Recent() {
  const editorStore = useEditorStore();

  return (
    <div className="recent-files">
      <div className="recent-files-title">{t('recent.noTabsOpen')}</div>
      <button className="recent-new-file" onClick={() => editorStore.NEW_UNTITLED_TAB({ selected: true })}>
        {t('recent.newFile')}
      </button>
    </div>
  );
}
