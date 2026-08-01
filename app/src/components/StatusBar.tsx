interface StatusBarProps {
  activePath: string | null;
  encoding: string;
  isDirty: boolean;
  viewMode: 'edit' | 'preview' | 'split';
}

export default function StatusBar({
  activePath,
  encoding,
  isDirty,
  viewMode,
}: StatusBarProps) {
  return (
    <div
      className="status-bar"
      style={{
        display: 'flex',
        alignItems: 'center',
        height: 24,
        padding: '0 8px',
        borderTop: '1px solid var(--color-border)',
        fontSize: 11,
        gap: 12,
        color: 'var(--color-text-muted)',
      }}
    >
      <span>{activePath ?? 'No file open'}</span>
      <span style={{ marginLeft: 'auto' }}>{encoding}</span>
      <span>{viewMode}</span>
      {isDirty && <span>unsaved</span>}
    </div>
  );
}
