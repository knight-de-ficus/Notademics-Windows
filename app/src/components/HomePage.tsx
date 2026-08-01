import { useEffect, useState } from 'react';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 6) return '夜深了';
  if (h < 9) return '早上好';
  if (h < 12) return '上午好';
  if (h < 14) return '中午好';
  if (h < 18) return '下午好';
  return '晚上好';
}

interface HomePageProps {
  onOpenFile: () => void;
  onOpenWorkspace: () => void;
}

export default function HomePage({ onOpenFile, onOpenWorkspace }: HomePageProps) {
  const phrase = `${greeting()}，今天准备写些什么？`;
  const [text, setText] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (done) return;
    if (text.length < phrase.length) {
      const t = setTimeout(() => setText(phrase.slice(0, text.length + 1)), 80);
      return () => clearTimeout(t);
    }
    setDone(true);
  }, [text, done, phrase]);

  return (
    <div style={{
      flex:1, display:'flex', flexDirection:'column', alignItems:'center',
      justifyContent:'center', gap:32, color:'var(--text-muted)',
    }}>
      <div style={{
        fontSize:24, fontWeight:700, color:'var(--text)', textAlign:'center',
        minHeight:36, fontFamily:'var(--font-ui)',
      }}>
        {text}
        <span style={{
          animation:'blink 1s step-end infinite',
          fontWeight:300, color:'var(--text)',
        }}>_</span>
      </div>

      <div style={{ display:'flex', gap:12 }}>
        <button onClick={onOpenFile} style={{
          padding:'8px 20px', borderRadius:6, fontSize:13, fontWeight:500,
          background:'var(--accent)', color:'var(--accent-fg)', border:'none', cursor:'pointer',
        }}>Open File</button>
        <button onClick={onOpenWorkspace} style={{
          padding:'8px 20px', borderRadius:6, fontSize:13, fontWeight:500,
          background:'var(--bg-hover)', color:'var(--text)', border:'1px solid var(--border)', cursor:'pointer',
        }}>Open Workspace</button>
      </div>

      <style>{`@keyframes blink { 0%,100% { opacity:1; } 50% { opacity:0; } }`}</style>
    </div>
  );
}
