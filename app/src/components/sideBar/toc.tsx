// 大纲（TOC）—— 对齐 marktext components/sideBar/toc.vue。
import { useEditorStore } from '../../store/editor';
import { usePreferencesStore } from '../../store/preferences';
import bus from '../../bus';
import { t } from '../../i18n';

export default function Toc() {
  const editorStore = useEditorStore();
  const preferencesStore = usePreferencesStore();
  const { listToc } = editorStore;
  const { wordWrapInToc } = preferencesStore;

  return (
    <div className="side-bar-toc">
      <div className="title">{t('sideBar.toc.title')}</div>
      {!listToc.length && <div className="empty">No headings</div>}
      {listToc.map((item, index) => (
        <div
          key={`${item.slug}-${index}`}
          className={`toc-item toc-level-${item.lvl ?? 1}`}
          style={{ paddingLeft: 8 + ((item.lvl ?? 1) - 1) * 12, whiteSpace: wordWrapInToc ? 'normal' : 'nowrap' }}
          title={item.content}
          onClick={() => bus.emit('scroll-to-header', item.slug)}
        >
          <span className="toc-text">{item.content}</span>
        </div>
      ))}
    </div>
  );
}
