interface ToolbarProps {
  activePath: string | null;
  isDirty: boolean;
  viewMode: 'edit' | 'preview' | 'split';
  showFileTree: boolean;
  onOpenFile: () => void;
  onSave: () => void;
  onToggleFileTree: () => void;
  onToggleViewMode: () => void;
}

export default function Toolbar({
  activePath,
  isDirty,
  viewMode,
  showFileTree,
  onOpenFile,
  onSave,
  onToggleFileTree,
  onToggleViewMode,
}: ToolbarProps) {
  const fileName = activePath
    ? activePath.split(/[/\\]/).pop() ?? 'Untitled'
    : 'SoloMD';

  const viewModeLabel =
    viewMode === 'edit'
      ? 'Edit'
      : viewMode === 'preview'
        ? 'Preview'
        : 'Split';

  return (
    <div
      className="toolbar"
      data-tauri-drag-region
      style={{
        display: 'flex',
        alignItems: 'center',
        height: 44,
        padding: '0 8px',
        borderBottom: '1px solid var(--color-border)',
        gap: 8,
      }}
    >
      <button onClick={onToggleFileTree} title="Toggle file tree">
        {showFileTree ? '🗂' : '🗂'}
      </button>

      <span style={{ flex: 1, textAlign: 'center', fontSize: 13, fontWeight: 500 }}>
        {fileName}
        {isDirty && ' •'}
      </span>

      <button onClick={onOpenFile} title="Open file (Ctrl+O)">
        Open
      </button>
      <button onClick={onSave} disabled={!isDirty} title="Save (Ctrl+S)">
        Save
      </button>
      <button onClick={onToggleViewMode} title="Toggle view mode">
        {viewModeLabel}
      </button>
    </div>
  );
}
