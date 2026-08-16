// 重命名对话框 —— 对齐 marktext components/rename/index.vue。
import { useEffect, useState } from 'react';
import bus from '../../bus';

export default function Rename() {
  const [visible, setVisible] = useState(false);
  const [value, setValue] = useState('');
  const [target, setTarget] = useState<{ id: string; pathname: string; filename: string } | null>(null);

  useEffect(() => {
    const onRename = (payload: unknown): void => {
      const p = (payload ?? {}) as { id?: string; pathname?: string; filename?: string };
      setTarget({ id: p.id ?? '', pathname: p.pathname ?? '', filename: p.filename ?? '' });
      setValue(p.filename ?? '');
      setVisible(true);
    };
    bus.on('rename', onRename);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const confirm = (): void => {
    if (!target) return;
    bus.emit('rename-confirm', { id: target.id, pathname: target.pathname, newName: value });
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="modal-mask rename-mask" onClick={() => setVisible(false)}>
      <div className="modal rename-dialog" onClick={(e) => e.stopPropagation()}>
        <h3>Rename</h3>
        <input
          className="rename-input"
          value={value}
          autoFocus
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') confirm();
            if (e.key === 'Escape') setVisible(false);
          }}
        />
        <div className="modal-actions">
          <button className="btn" onClick={() => setVisible(false)}>Cancel</button>
          <button className="btn primary" onClick={confirm}>Rename</button>
        </div>
      </div>
    </div>
  );
}
