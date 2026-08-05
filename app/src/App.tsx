import { useEffect, useState, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { open as openDialog, save as saveDialog } from '@tauri-apps/plugin-dialog';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import type { FileReadResult, ViewMode, TabInfo } from './types';
import { renderMarkdown } from './lib/markdown';
import Editor, { type EditorHandle } from './components/Editor';
import Preview from './components/Preview';
import FileTree from './components/FileTree';
import TabBar from './components/TabBar';
import HomePage from './components/HomePage';
import StatusBar from './components/StatusBar';
import Toolbar from './components/Toolbar';
import UnsavedDialog from './components/UnsavedDialog';
import { useSplitScroll } from './hooks/useSplitScroll';
import { openUrl } from '@tauri-apps/plugin-opener';

const MODE_CYCLE: ViewMode[] = ['code', 'liveEdit', 'split', 'preview'];
let tabSeq = 1;
function newTabId() { return `tab-${Date.now()}-${tabSeq++}`; }
function isM(fn: string) { return /\.(md|mdx|markdown|mdown|mkd)$/i.test(fn); }
function tbName(p: string|null): string { if(!p) return 'Untitled'; return p.replace(/\\/g,'/').split('/').pop()??'Untitled'; }
function dvName(c: string, p: string|null): string { const m=c?.match(/^#{1,6}[ \t]+(.{1,60})/m); const s=m?.[1]?.trim().replace(/[\\/:*?"<>|#]/g,'_').replace(/^\.+/,'').trim(); const e=p?(p.split('.').pop()||'md'):'md'; return s?`${s}.${e}`:`Untitled.${e}`; }
function docDir(p: string|null): string|null { if(!p) return null; const x=p.replace(/\\/g,'/'); return x.substring(0,x.lastIndexOf('/')); }

/** Safely call `getCurrentWindow()` — returns null outside Tauri (browser dev). */
function safeCurrentWindow() {
  try { return getCurrentWindow(); } catch { return null; }
}

async function addRecent(kind: 'file'|'folder', path: string) {
  invoke('add_recent_entry', { kind, path }).catch(() => {});
}

export default function App() {
  const [tabs, setTabs] = useState<TabInfo[]>([]);
  const [activeTabId, setActiveTabId] = useState<string|null>(null);
  const at = tabs.find(t=>t.id===activeTabId)??null;
  const [vm, setVm] = useState<ViewMode>('liveEdit');
  const [showFt, setShowFt] = useState(true);
  const [ws, setWs] = useState<string|null>(null);
  const [sw, setSw] = useState(240);
  const [sr, setSr] = useState(50);
  const [html, setHtml] = useState('');
  const [uid, setUid] = useState<string|null>(null);
  const [ca, setCa] = useState(false);
  const editorRef = useRef<EditorHandle>(null);
  const [isMain, setIsMain] = useState(false);

  useEffect(() => { if(!at){setHtml('');return;} const t=setTimeout(()=>setHtml(renderMarkdown(at.content)),250); return ()=>clearTimeout(t); }, [at?.content, at?.id]);
  useEffect(() => { safeCurrentWindow()?.setTitle(at?`${at.fileName} \u2014 Notademics`:'Notademics').catch(()=>{}); }, [at?.fileName, at?.id]);
  useEffect(() => { function h(e:Event){ editorRef.current?.scrollToLine((e as CustomEvent<number>).detail); } window.addEventListener('notademics:goto-line',h); return ()=>window.removeEventListener('notademics:goto-line',h); }, []);

  useEffect(() => {
    setIsMain(safeCurrentWindow()?.label==='main');
    const u: UnlistenFn[]=[];
    try {
      listen<string>('solomd://menu',(e)=>menu(e.payload)).then(f=>u.push(f)).catch(()=>{});
      listen<string>('open-file',(e)=>openAlways(e.payload)).then(f=>u.push(f)).catch(()=>{});
      listen<{paths:string[]}>('tauri://drag-drop',(e)=>{if(e.payload.paths.length)openAlways(e.payload.paths[0]);}).then(f=>u.push(f)).catch(()=>{});
    } catch {}
    return ()=>u.forEach(f=>f());
  }, []);

  function upd(id:string, p:Partial<TabInfo>){ setTabs(prev=>prev.map(t=>t.id===id?{...t,...p}:t)); }
  function dirty(t:TabInfo){ return t.content!==t.savedContent; }

  function menu(id:string){
    // Recent submenu items encoded as "recent-file|C:\path" or "recent-workspace|C:\path"
    const pipe = id.indexOf('|');
    if (pipe > 0) {
      const prefix = id.substring(0, pipe);
      const path = id.substring(pipe + 1);
      if (prefix === 'recent-file') { openAlways(path); return; }
      if (prefix === 'recent-workspace') { setWs(path); return; }
    }
    switch(id){
      case 'file.new': newTab('md'); break;
      case 'file.newText': newTab('txt'); break;
      case 'file.open': openDialogCb(); break;
      case 'file.openFolder': openWsCb(); break;
      case 'file.save': doSave(); break;
      case 'file.saveAs': saveAs(); break;
      case 'file.closeTab': reqClose(); break;
      case 'file.closeAllTabs': reqCloseAll(); break;
      case 'file.preferences': case 'view.settings': doSettings(); break;
      case 'file.exit': safeCurrentWindow()?.close().catch(()=>{}); break;
      case 'window.new': if(isMain) newWindow(); break;
      case 'view.toggleFileTree': setShowFt(v=>!v); break;
      case 'view.cycleView': cycle(); break;
      case 'edit.undo': case 'undo': document.execCommand('undo'); break;
      case 'edit.redo': case 'redo': document.execCommand('redo'); break;
      case 'edit.cut': case 'cut': document.execCommand('cut'); break;
      case 'edit.copy': case 'copy': document.execCommand('copy'); break;
      case 'edit.paste': case 'paste': document.execCommand('paste'); break;
      case 'edit.selectAll': case 'selectall': document.execCommand('selectAll'); break;
    }
  }

  function doSettings(){ new WebviewWindow(`notademics-pref-${Date.now()}`,{url:'/',title:'Preferences',width:700,height:500}); }
  function newWindow(){ try{new WebviewWindow(`notademics-win-${Date.now()}`,{url:'/',title:'Notademics',width:1000,height:700});}catch(e){} }

  async function onLink(href:string){
    try{
      if(/^(https?:\/\/|mailto:)/.test(href)){ await openUrl(href); }
      else if(at?.path){ const d=docDir(at.path),r=d?`${d}/${href}`:href;
        try{await invoke('read_file',{path:r});openAlways(r);}catch{await openUrl(r);} }
      else await openUrl(href);
    }catch(e){console.error(e);}
  }

  function reqClose(id?:string){ const t=id??activeTabId; if(!t)return; const tab=tabs.find(x=>x.id===t); if(tab&&dirty(tab)){setUid(t);setCa(false);}else doClose(t); }
  function reqCloseAll(){ const d=tabs.filter(dirty); if(d.length){setCa(true);setUid(d[0].id);}else closeAllTabs(); }
  function unsavedSave(){ if(!uid)return; const tab=tabs.find(t=>t.id===uid); if(!tab)return; if(tab.path){invoke('write_file',{path:tab.path,content:tab.content,encoding:tab.encoding}).then(()=>{upd(uid!,{savedContent:tab.content});after(uid!);}).catch(console.error);}else doSaveAs(uid!); }
  function unsavedDiscard(){ if(uid)after(uid); }
  function unsavedCancel(){ setUid(null);setCa(false); }
  function after(id:string){ setUid(null); if(ca){const r=tabs.filter(t=>t.id!==id&&dirty(t));if(r.length)setTimeout(()=>setUid(r[0].id),0);else{closeAllTabs();setCa(false);}}else doClose(id); }
  async function doSaveAs(tid:string){ const tab=tabs.find(t=>t.id===tid); if(!tab)return; try{const n=dvName(tab.content,tab.path);const d=tab.path?tab.path.substring(0,tab.path.lastIndexOf('/')):ws||undefined;const s=await saveDialog({defaultPath:d?`${d}/${n}`:n,filters:[{name:'Markdown',extensions:['md','markdown','mdx']},{name:'Plain Text',extensions:['txt']}]});if(s){await invoke('write_file',{path:s,content:tab.content,encoding:tab.encoding});upd(tid,{path:s,fileName:tbName(s),savedContent:tab.content});after(tid);}}catch(e){console.error(e);} }
  function doClose(id?:string){ const t=id??activeTabId; if(!t)return; setTabs(p=>{const i=p.findIndex(x=>x.id===t);if(i<0)return p;const n=p.filter(x=>x.id!==t);if(n.length)setActiveTabId(n[Math.min(i,n.length-1)].id);else setActiveTabId(null);return n;}); }
  function closeAllTabs(){setTabs([]);setActiveTabId(null);}

  function newTab(ext:'md'|'txt'='md'){ const id=newTabId(); setTabs(p=>[...p,{id,path:null,fileName:'Untitled.'+ext,content:ext==='md'?'# Untitled\n\n':'',savedContent:ext==='md'?'# Untitled\n\n':'',encoding:'UTF-8',language:ext==='md'?'markdown':'plaintext'}]); setActiveTabId(id); }

  async function openRel(path:string){ if(at&&dirty(at))return openNew(path); return openReplace(path); }
  async function openReplace(path:string){ try{const r=await invoke<FileReadResult>('read_file',{path});const fn=tbName(path);const l:TabInfo['language']=isM(fn)?'markdown':'plaintext';addRecent('file',path);if(at){upd(at.id,{path,fileName:fn,content:r.content,savedContent:r.content,encoding:r.encoding,language:l});}else{const id=newTabId();setTabs([{id,path,fileName:fn,content:r.content,savedContent:r.content,encoding:r.encoding,language:l}]);setActiveTabId(id);}}catch(e){console.error(e);} }
  async function openNew(path:string){ try{const r=await invoke<FileReadResult>('read_file',{path});const fn=tbName(path);const l:TabInfo['language']=isM(fn)?'markdown':'plaintext';addRecent('file',path);const id=newTabId();setTabs(p=>[...p,{id,path,fileName:fn,content:r.content,savedContent:r.content,encoding:r.encoding,language:l}]);setActiveTabId(id);}catch(e){console.error(e);} }
  function openAlways(path:string){openNew(path);}

  async function openDialogCb(){ try{const s=await openDialog({multiple:false,filters:[{name:'Markdown',extensions:['md','mdx','markdown','mdown','mkd']},{name:'Plain Text',extensions:['txt']},{name:'All Files',extensions:['*']}]});if(s&&typeof s==='string')openAlways(s);}catch(e){console.error(e);} }
  async function openWsCb(){ try{const s=await openDialog({directory:true,multiple:false,title:'Open workspace'});if(s&&typeof s==='string'){addRecent('folder',s);setWs(s);}}catch(e){console.error(e);} }

  async function doSave(){ if(!at)return; if(!at.path){doSaveAs(at.id);return;} if(at.content===at.savedContent)return; try{await invoke('write_file',{path:at.path,content:at.content,encoding:at.encoding});upd(at.id,{savedContent:at.content});}catch(e){console.error(e);} }
  async function saveAs(){ if(at)doSaveAs(at.id); }

  function handleChange(nc:string){ if(at)upd(at.id,{content:nc}); }
  function cycle(){ setVm(m=>{const i=MODE_CYCLE.indexOf(m);return MODE_CYCLE[(i+1)%MODE_CYCLE.length];}); }

  const [eEl,setEEl]=useState<HTMLElement|null>(null); const [pEl,setPEl]=useState<HTMLElement|null>(null);
  useEffect(()=>{if(vm!=='split'){setEEl(null);setPEl(null);return;}const t=setTimeout(()=>{setEEl(document.querySelector('[data-pane="editor"] .cm-scroller') as HTMLElement|null);setPEl(document.querySelector('[data-pane="preview"].preview-host') as HTMLElement|null);},50);return()=>clearTimeout(t);},[vm,at?.content]);
  useSplitScroll({editorScrollEl:eEl,previewScrollEl:pEl,editorLineToTop:l=>editorRef.current?.lineToTop(l)??0,editorScrollToLine:l=>editorRef.current?.scrollToLine(l)},vm==='split'&&!!eEl&&!!pEl);

  function sidebarResize(e:React.MouseEvent){e.preventDefault();const sx=e.clientX,sxw=sw;const mv=(ev:MouseEvent)=>setSw(Math.max(160,Math.min(500,sxw+ev.clientX-sx)));const up=()=>{document.removeEventListener('mousemove',mv);document.removeEventListener('mouseup',up);};document.addEventListener('mousemove',mv);document.addEventListener('mouseup',up);}
  function splitResize(e:React.MouseEvent){e.preventDefault();const sx=e.clientX,sxr=sr;const mv=(ev:MouseEvent)=>{const c=(e.target as HTMLElement).parentElement;if(!c)return;setSr(Math.max(20,Math.min(80,sxr+((ev.clientX-sx)/c.getBoundingClientRect().width)*100)));};const up=()=>{document.removeEventListener('mousemove',mv);document.removeEventListener('mouseup',up);};document.addEventListener('mousemove',mv);document.addEventListener('mouseup',up);}

  const sp=vm==='split',pv=vm==='preview',le=vm==='liveEdit';
  const isD=at?dirty(at):false; const hasT=tabs.length>0; const showTB=tabs.length>1;

  return (<div className="app-root" data-theme="light" style={{display:'flex',flexDirection:'column',height:'100%',width:'100%',background:'var(--bg)',color:'var(--text)'}}>
    <Toolbar isDirty={isD} showFileTree={showFt} onOpenFile={openDialogCb} onSave={doSave} onNew={()=>newTab('md')} onToggleFileTree={()=>setShowFt(v=>!v)} />
    <div className="app-body" style={{flex:1,display:'flex',minHeight:0,overflow:'hidden'}}>
      {showFt&&(<>
        <aside style={{width:sw,flex:'0 0 auto',borderRight:'1px solid var(--border)',overflow:'hidden'}}>
          <FileTree currentWorkspace={ws} activePath={at?.path??null} activeContent={at?.content??''}
            onOpenFile={openRel} onOpenWorkspace={(p)=>{addRecent('folder',p);setWs(p);}} />
        </aside>
        <div onMouseDown={sidebarResize} style={{width:4,cursor:'col-resize',flex:'0 0 auto',background:'transparent',transition:'background .15s'}}
          onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background='var(--accent)'}}
          onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background='transparent'}} />
      </>)}
      <main style={{flex:1,display:'flex',flexDirection:'column',minWidth:0,overflow:'hidden'}}>
        {!hasT? (<HomePage onOpenFile={openDialogCb} onOpenWorkspace={openWsCb} />) : (<>
          {showTB&&<TabBar tabs={tabs.map(t=>({id:t.id,fileName:t.fileName,path:t.path,isDirty:dirty(t)}))} activeTabId={activeTabId} onSelectTab={setActiveTabId} onCloseTab={reqClose} onCloseAll={reqCloseAll} />}
          <div style={{flex:1,display:'flex',minHeight:0,overflow:'hidden'}}>
            {!sp&&!pv&&(<div style={{flex:1,minWidth:0,width:'100%',display:'flex'}}><Editor ref={editorRef} content={at?.content??''} filePath={at?.path??null} language={at?.language??'plaintext'} showLiveEdit={le} showLineNumbers={false} onChange={handleChange} onBlur={()=>{}} onSave={doSave} blocksContext={ws || at?.path ? { getImageRoot: () => ws, getFilePath: () => at?.path ?? undefined } : undefined} /></div>)}
            {sp&&(<><div style={{flex:`0 0 ${sr}%`,minWidth:0,display:'flex',flexDirection:'column'}}><Editor ref={editorRef} content={at?.content??''} filePath={at?.path??null} language={at?.language??'plaintext'} showLiveEdit={false} showLineNumbers={true} onChange={handleChange} onBlur={()=>{}} onSave={doSave} /></div>
              <div onMouseDown={splitResize} style={{width:5,cursor:'col-resize',flex:'0 0 auto',background:'transparent',transition:'background .15s'}} onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background='var(--accent)'}} onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background='transparent'}} />
              <div style={{flex:1,minWidth:0,overflow:'hidden'}}><Preview html={html} docDir={docDir(at?.path??null)} onClickLink={onLink} /></div></>)}
            {pv&&(<div style={{flex:1,minWidth:0,width:'100%'}}><Preview html={html} readOnly docDir={docDir(at?.path??null)} onClickLink={onLink} /></div>)}
          </div>
        </>)}
      </main>
    </div>
    <StatusBar content={at?.content??''} encoding={at?.encoding??'UTF-8'} isDirty={isD} viewMode={vm} onCycleViewMode={cycle} />
    {uid&&(<UnsavedDialog fileName={tabs.find(t=>t.id===uid)?.fileName??'Untitled'} onSave={unsavedSave} onDiscard={unsavedDiscard} onCancel={unsavedCancel} />)}
  </div>);
}
