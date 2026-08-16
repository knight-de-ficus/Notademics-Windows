// Keybindings 偏好页 —— 对齐 marktext prefComponents/keybindings。
// 展示命令快捷键（数据来自 ../commands），编辑能力为占位（bus 事件交由上层）。
import { useState } from 'react';
import { useCommandCenterStore } from '../../store/commandCenter';
import { Separator } from '../common';

export default function Keybindings() {
  const commandCenterStore = useCommandCenterStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingKey, setPendingKey] = useState('');
  const commands = commandCenterStore.rootCommand?.subcommands ?? [];

  return (
    <div className="pref-page">
      <h2>Keybindings</h2>
      <p className="pref-description">Customize keyboard shortcuts</p>

      <Separator />
      <table className="keybindings-table">
        <thead>
          <tr>
            <th>Description</th>
            <th>Key Combination</th>
            <th>Options</th>
          </tr>
        </thead>
        <tbody>
          {commands.map((cmd) => (
            <tr key={cmd.id}>
              <td>{cmd.description}</td>
              <td>
                {editingId === cmd.id ? (
                  <input
                    className="key-input"
                    value={pendingKey}
                    placeholder="Press keys..."
                    autoFocus
                    onChange={(e) => setPendingKey(e.target.value)}
                    onBlur={() => setEditingId(null)}
                    onKeyDown={(e) => {
                      e.preventDefault();
                      const keys: string[] = [];
                      if (e.ctrlKey) keys.push('Ctrl');
                      if (e.shiftKey) keys.push('Shift');
                      if (e.altKey) keys.push('Alt');
                      keys.push(e.key.length === 1 ? e.key.toUpperCase() : e.key);
                      setPendingKey(keys.join('+'));
                    }}
                  />
                ) : (
                  <span>{cmd.shortcut?.join(', ') ?? '—'}</span>
                )}
              </td>
              <td>
                <button
                  className="btn small"
                  onClick={() => {
                    setEditingId(cmd.id);
                    setPendingKey(cmd.shortcut?.[0] ?? '');
                  }}
                >
                  Edit
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
