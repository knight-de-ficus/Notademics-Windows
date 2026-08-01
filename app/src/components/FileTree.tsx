import { useEffect, useState, useCallback, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open as openDialog } from '@tauri-apps/plugin-dialog';

interface DirEntry { name: string; path: string; is_dir: boolean; }
interface TreeNode { name: string; path: string; isDir: boolean; }
type SidebarTab = 'workspace' | 'outline';

interface OutlineItem { level: number; text: string; slug: string; line: number; }

interface FileTreeProps {
  currentWorkspace: string | null;
  activePath: string | null;
  activeContent: string;
  onOpenFile: (path: string) => void;
  onOpenWorkspace: (path: string) => void;
}

export default function FileTree({ currentWorkspace, activePath, activeContent, onOpenFile, onOpenWorkspace }: FileTreeProps) {
  const [tab, setTab] = useState<SidebarTab>('workspace');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [children, setChildren] = useState<Record<string, TreeNode[]>>({});
  const [rootNames, setRootNames] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(false);

  const listDir = useCallback(async (dirPath: string): Promise<TreeNode[]> => {
    try {
      const entries: DirEntry[] = await invoke('list_dir', { path: dirPath });
      return entries.map((e) => ({ name: e.name, path: e.path, isDir: e.is_dir }));
    } catch { return []; }
  }, []);

  useEffect(() => {
    if (!currentWorkspace) { setRootNames([]); return; }
    setLoading(true);
    listDir(currentWorkspace).then((nodes) => {
      setRootNames(nodes);
      setChildren((prev) => ({ ...prev, [currentWorkspace]: nodes }));
    }).finally(() => setLoading(false));
  }, [currentWorkspace, listDir]);

  async function handleOpenWorkspace() {
    try {
      const selected = await openDialog({ directory:true, multiple:false, title:'Open workspace' });
      if (selected && typeof selected === 'string') onOpenWorkspace(selected);
    } catch(e) { console.error('Workspace dialog failed:', e); }
  }

  function toggleDir(dirPath: string) {
    setExpanded((prev) => {
      const next = { ...prev };
      if (next[dirPath]) { delete next[dirPath]; }
      else { next[dirPath] = true; if (!children[dirPath]) { listDir(dirPath).then((n) => setChildren((c) => ({ ...c, [dirPath]: n }))); } }
      return next;
    });
  }

  function isOpenable(name: string) {
    return /\.(md|mdx|markdown|mdown|mkd|txt|py|js|jsx|ts|tsx|json|css|scss|less|html|htm|xml|svg|yaml|yml|toml|ini|cfg|conf|sh|bash|zsh|ps1|bat|cmd|rs|go|java|c|cpp|h|hpp|cs|rb|php|sql|r|R|rmd|Rmd|lua|vim|graphql|gql|vue|svelte|astro)$/i.test(name);
  }

  function renderTree(nodes: TreeNode[], depth: number): React.ReactNode {
    return nodes.map((node) => {
      const isExpanded = !!expanded[node.path], isActive = node.path === activePath;
      const openable = node.isDir || isOpenable(node.name);
      const kids = children[node.path];
      return (<div key={node.path}>
        <div style={{ paddingLeft:`${8+depth*14}px`, paddingRight:8, height:26, display:'flex', alignItems:'center', borderRadius:4, margin:'0 4px',
          cursor:openable?'pointer':'default', background:isActive?'var(--bg-hover)':undefined,
          color:isActive?'var(--accent)':openable?undefined:'var(--text-muted)', fontSize:13, userSelect:'none' }}
          onClick={() => { if (node.isDir) toggleDir(node.path); else if (openable) onOpenFile(node.path); }}>
          <span style={{ width:14, fontSize:10, flexShrink:0, textAlign:'center' }}>{node.isDir ? (isExpanded?'▾':'▸') : ''}</span>
          <span style={{ marginRight:5, flexShrink:0, fontSize:13 }}>{node.isDir ? (isExpanded?'📂':'📁') : '📄'}</span>
          <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{node.name}</span>
        </div>
        {node.isDir && isExpanded && kids && kids.length>0 && renderTree(kids, depth+1)}
      </div>);
    });
  }

  const outline = useMemo((): OutlineItem[] => {
    const items: OutlineItem[] = [];
    if (!activeContent) return items;
    const lines = activeContent.split('\n'); let inFence = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/^```/.test(line)) { inFence = !inFence; continue; }
      if (inFence) continue;
      const m = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
      if (!m) continue;
      const text = m[2]?.trim(); if (!text) continue;
      items.push({ level:m[1].length, text, slug:text.toLowerCase().replace(/[^\w\u4e00-\u9fff]+/g,'-').replace(/^-|-$/g,''), line:i+1 });
    }
    return items;
  }, [activeContent]);

  const wsName = currentWorkspace ? (currentWorkspace.replace(/\\/g,'/').split('/').pop()??currentWorkspace) : null;

  return (
    <div style={{ height:'100%', display:'flex', flexDirection:'column' }}>
      <div style={{ display:'flex', borderBottom:'1px solid var(--border)' }}>
        <button onClick={() => setTab('workspace')}
          style={{ flex:1, padding:'6px 0', fontSize:12, fontWeight:tab==='workspace'?600:400,
            background:tab==='workspace'?'var(--bg-elev)':'transparent', border:'none', cursor:'pointer',
            color:tab==='workspace'?'var(--text)':'var(--text-muted)', borderBottom:tab==='workspace'?'2px solid var(--accent)':'2px solid transparent' }}>
           Workspace
        </button>
        <button onClick={() => setTab('outline')}
          style={{ flex:1, padding:'6px 0', fontSize:12, fontWeight:tab==='outline'?600:400,
            background:tab==='outline'?'var(--bg-elev)':'transparent', border:'none', cursor:'pointer',
            color:tab==='outline'?'var(--text)':'var(--text-muted)', borderBottom:tab==='outline'?'2px solid var(--accent)':'2px solid transparent' }}>
           Outline
        </button>
      </div>

      {tab === 'workspace' ? (<>
        <div style={{ padding:'6px 12px', fontSize:12, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {wsName ?? ''}
        </div>
        <div style={{ flex:1, overflow:'auto', padding:'2px 0' }}>
          {loading ? <div style={{ padding:12, color:'var(--text-muted)', fontSize:12 }}>Loading…</div>
            : !currentWorkspace ? <div title="No workspace open" style={{ height:'100%' }} />
            : rootNames.length===0 ? <div title="Empty workspace" style={{ height:'100%' }} />
            : renderTree(rootNames, 0)}
        </div>
        <div style={{ padding:'6px 8px', borderTop:'1px solid var(--border)' }}>
          <button onClick={handleOpenWorkspace} title="Open workspace"
            style={{ width:'100%', padding:'4px 8px', fontSize:12, borderRadius:4, textAlign:'center' }}>
            {currentWorkspace ? 'Change workspace…' : 'Open workspace…'}
          </button>
        </div>
      </>) : (
        <div style={{ flex:1, overflow:'auto', padding:'4px 0' }}>
          {outline.length === 0 ? (
            <div title="No headings found" style={{ height:'100%' }} />
          ) : outline.map((item) => (
            <div key={item.line} title={`${item.text} — Line ${item.line}`}
              style={{ paddingLeft:`${8+item.level*12}px`, paddingRight:8, height:24, display:'flex', alignItems:'center',
                cursor:'pointer', fontSize:12, borderRadius:4, margin:'0 4px', color:'var(--text-muted)' }}
              onClick={() => {
                window.dispatchEvent(new CustomEvent('notademics:goto-line', { detail: item.line }));
              }}>
              <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {item.text}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
