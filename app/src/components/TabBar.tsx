interface TabBarProps {
  tabs: Array<{ id: string; fileName: string; path: string | null; isDirty: boolean }>;
  activeTabId: string | null;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onCloseAll: () => void;
}

export default function TabBar({ tabs, activeTabId, onSelectTab, onCloseTab, onCloseAll }: TabBarProps) {
  if (tabs.length === 0) return null;
  return (
    <div style={{
      display:'flex', height:32, borderBottom:'1px solid var(--border)',
      background:'var(--bg-elev)', overflow:'hidden', flexShrink:0,
    }}>
      <div style={{ display:'flex', overflowX:'auto', flex:1, scrollbarWidth:'none' }}>
        {tabs.map((t) => {
          const active = t.id === activeTabId;
          return (
            <div key={t.id}
              onClick={() => onSelectTab(t.id)}
              onMouseDown={(e) => { if (e.button === 1) { e.preventDefault(); onCloseTab(t.id); } }}
              style={{
                display:'flex', alignItems:'center', height:'100%', padding:'0 10px', gap:6,
                cursor:'pointer', fontSize:12, borderRight:'1px solid var(--border)',
                background: active ? 'var(--bg)' : 'transparent',
                color: active ? 'var(--text)' : 'var(--text-muted)',
                whiteSpace:'nowrap', userSelect:'none', minWidth:0, maxWidth:180,
              }}
            >
              <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1 }}>
                {t.fileName}
              </span>
              {t.isDirty && <span style={{ fontSize:11, color:'var(--accent)', flexShrink:0 }}>•</span>}
              <span
                onClick={(e) => { e.stopPropagation(); onCloseTab(t.id); }}
                style={{ fontSize:14, lineHeight:1, opacity:.4, flexShrink:0 }}
              >×</span>
            </div>
          );
        })}
      </div>
      {tabs.length > 0 && (
        <button onClick={onCloseAll} title="Close all tabs"
          style={{ padding:'0 10px', fontSize:14, cursor:'pointer', borderLeft:'1px solid var(--border)',
            color:'var(--text-muted)', display:'flex', alignItems:'center', height:'100%', flexShrink:0 }}>
          ✕
        </button>
      )}
    </div>
  );
}
