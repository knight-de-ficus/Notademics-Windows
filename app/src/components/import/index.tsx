// 导入对话框 —— 对齐 marktext components/import/index.vue。
// 拖放导入经 App 的 tauri://drag-drop 事件处理；本组件为提示遮罩。
import { useEffect, useState } from 'react';
import bus from '../../bus';
import { t } from '../../i18n';

export default function ImportModal() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onImport = (show: unknown): void => setVisible(!!show);
    bus.on('importDialog', onImport);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!visible) return null;

  return (
    <div className="modal-mask import-mask">
      <div className="import-modal">
        <div className="import-title">{t('import.title')}</div>
        <div className="import-description">{t('import.description')}</div>
      </div>
    </div>
  );
}
