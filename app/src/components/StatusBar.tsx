import type { ViewMode } from '../types';

const MODE_LABELS: Record<ViewMode, string> = {
  code: 'Code', liveEdit: 'Live', split: 'Split', preview: 'Preview',
};

interface StatusBarProps {
  content: string;
  encoding: string;
  isDirty: boolean;
  viewMode: ViewMode;
  onCycleViewMode: () => void;
}

export default function StatusBar({ content, encoding, isDirty, viewMode, onCycleViewMode }: StatusBarProps) {
  const text = content ?? '';
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const charCount = text.length;

  return (
    <div className="status-bar" style={{
      display:'flex', alignItems:'center', height:24, padding:'0 8px',
      borderTop:'1px solid var(--border)', fontSize:11, gap:12,
      color:'var(--text-muted)',
    }}>
      <span>{wordCount} words</span>
      <span>{charCount} chars</span>
      {isDirty && <span>•</span>}
      <span style={{ marginLeft:'auto' }}>{encoding}</span>
      <button onClick={onCycleViewMode}
        style={{ padding:'1px 8px', borderRadius:3, fontSize:11, cursor:'pointer' }}>
        {MODE_LABELS[viewMode]}
      </button>
    </div>
  );
}
