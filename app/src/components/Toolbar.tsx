interface ToolbarProps {
  isDirty: boolean;
  showFileTree: boolean;
  onOpenFile: () => void;
  onSave: () => void;
  onNew: () => void;
  onToggleFileTree: () => void;
}

export default function Toolbar({
  isDirty,
  showFileTree,
  onOpenFile,
  onSave,
  onNew,
  onToggleFileTree,
}: ToolbarProps) {
  return (
    <div className="toolbar" data-tauri-drag-region style={{
      display:'flex', alignItems:'center', height:44, padding:'0 8px',
      borderBottom:'1px solid var(--color-border)', gap:8,
    }}>
      <button onClick={onToggleFileTree} title="Toggle file tree">
        {showFileTree ? '🗂' : '🗂'}
      </button>
      <button onClick={onNew} title="New file (Ctrl+N)">New</button>
      <button onClick={onOpenFile} title="Open file (Ctrl+O)">Open</button>
      <button onClick={onSave} disabled={!isDirty} title="Save (Ctrl+S)">Save</button>
    </div>
  );
}
