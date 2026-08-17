// 空态欢迎页 —— 对齐 marktext components/recent/index.vue。
import { useEffect, useMemo, useState } from 'react';
import { useEditorStore } from '../../store/editor';

const greetingForHour = (hour: number): string => {
  if (hour < 11) return '早上好，今天准备写些什么？';
  if (hour < 14) return '中午好，今天准备写些什么？';
  if (hour < 18) return '下午好，今天准备写些什么？';
  return '晚上好，今天准备写些什么？';
};

export default function Recent() {
  const editorStore = useEditorStore();
  const greeting = useMemo(() => greetingForHour(new Date().getHours()), []);
  const [visibleLength, setVisibleLength] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setVisibleLength((length) => {
        if (length >= greeting.length) {
          window.clearInterval(timer);
          return length;
        }
        return length + 1;
      });
    }, 75);
    return () => window.clearInterval(timer);
  }, [greeting]);

  return (
    <div className="recent-files">
      <div className="recent-files-title typewriter-greeting" aria-label={greeting}>
        <span aria-hidden="true">{greeting.slice(0, visibleLength)}</span>
        <span className="typewriter-caret" aria-hidden="true" />
      </div>
      <button className="recent-new-file" onClick={() => editorStore.NEW_UNTITLED_TAB({ selected: true })}>
        开始写作
      </button>
    </div>
  );
}
