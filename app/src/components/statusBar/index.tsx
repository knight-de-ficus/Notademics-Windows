// 底部状态栏 —— 显示字数统计（点击循环切换 word/character/paragraph）、行数、编码、保存状态。
// 对齐 marktext titleBar 的字数统计逻辑（HASH 循环），样式为底部细条。
import { useCallback, useState } from 'react';
import { useEditorStore } from '../../store/editor';
import { t } from '../../i18n';

type ShowType = 'word' | 'paragraph' | 'character' | 'all'

const HASH: Record<ShowType, { short: string; full: string }> = {
  word: { short: 'W', full: 'words' },
  character: { short: 'C', full: 'characters' },
  paragraph: { short: 'P', full: 'paragraphs' },
  all: { short: 'A', full: 'characters (with spaces)' }
}

export default function StatusBar() {
  const editorStore = useEditorStore();
  const currentFile = editorStore.currentFile;
  const [show, setShow] = useState<ShowType>('word');

  const handleWordClick = useCallback(() => {
    const ITEMS: ShowType[] = ['word', 'paragraph', 'character', 'all'];
    setShow((s) => ITEMS[(ITEMS.indexOf(s) + 1) % ITEMS.length]);
  }, []);

  const wordCount = currentFile?.wordCount;
  const markdown = currentFile?.markdown ?? '';
  const lines = markdown ? markdown.split('\n').length : 0;
  const encoding = currentFile?.encoding?.encoding ?? 'UTF-8';
  const isSaved = currentFile?.isSaved ?? true;

  return (
    <div className="status-bar">
      <div className="status-bar-left">
        <span className="status-item word-count" onClick={handleWordClick} title={HASH[show].full}>
          {wordCount ? `${HASH[show].short} ${wordCount[show]}` : ''}
        </span>
        <span className="status-item" title="Lines">{lines} lines</span>
      </div>
      <div className="status-bar-right">
        <span className="status-item" title="Encoding">{encoding}</span>
        <span className="status-item save-status" title="Save status">
          {isSaved ? 'Saved' : '● Modified'}
        </span>
      </div>
    </div>
  );
}
