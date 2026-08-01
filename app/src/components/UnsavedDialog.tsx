interface UnsavedDialogProps {
  fileName: string;
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}

export default function UnsavedDialog({ fileName, onSave, onDiscard, onCancel }: UnsavedDialogProps) {
  return (
    <div style={{
      position:'fixed', inset:0, zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center',
      background:'rgba(0,0,0,0.4)',
    }} onClick={onCancel}>
      <div style={{
        background:'var(--bg)', borderRadius:8, padding:24, minWidth:320, maxWidth:440,
        border:'1px solid var(--border)', boxShadow:'0 8px 32px rgba(0,0,0,0.18)',
      }} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize:14, fontWeight:600, marginBottom:8 }}>Unsaved changes</div>
        <div style={{ fontSize:13, color:'var(--text-muted)', marginBottom:20, lineHeight:1.5 }}>
          Do you want to save the changes to <strong style={{ color:'var(--text)' }}>{fileName}</strong>?
        </div>
        <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
          <button onClick={onCancel} style={{ padding:'6px 14px', borderRadius:4, fontSize:12 }}>
            Cancel
          </button>
          <button onClick={onDiscard} style={{
            padding:'6px 14px', borderRadius:4, fontSize:12,
            background:'var(--bg-hover)', border:'1px solid var(--border)',
          }}>Discard</button>
          <button onClick={onSave} style={{
            padding:'6px 14px', borderRadius:4, fontSize:12,
            background:'var(--accent)', color:'var(--accent-fg)', border:'none',
          }}>Save</button>
        </div>
      </div>
    </div>
  );
}
