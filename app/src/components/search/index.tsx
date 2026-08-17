// 编辑器内查找/替换条 —— 对齐 marktext components/search/index.vue 的结构与行为。
// 用 Muya 的 search/find/replace API；通过 bus 'find-bar-open'/'find-bar-close' 控制显示。
import { useEffect, useRef, useState } from 'react';
import type { MuyaEditorHandle } from '../MuyaEditor';
import bus from '../../bus';
import { t } from '../../i18n';

interface FindBarProps {
  editorRef: React.RefObject<MuyaEditorHandle | null>
}

export default function FindBar({ editorRef }: FindBarProps) {
  const [show, setShow] = useState(false);
  const [type, setType] = useState<'search' | 'replace'>('search');
  const [searchValue, setSearchValue] = useState('');
  const [replaceValue, setReplaceValue] = useState('');
  const [isCaseSensitive, setIsCaseSensitive] = useState(false);
  const [isWholeWord, setIsWholeWord] = useState(false);
  const [isRegexp, setIsRegexp] = useState(false);
  const [highlightCount, setHighlightCount] = useState(0);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [searchErrorMsg, setSearchErrorMsg] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const open = (payload?: unknown): void => {
      // marktext 事件：edit.find → bus 'find'（payload 'find'）；edit.replace → bus 'replace'
      const replace = String(payload ?? '') === 'replace';
      setType(replace ? 'replace' : 'search');
      setShow(true);
      setTimeout(() => inputRef.current?.focus(), 50);
    };
    const close = (): void => setShow(false);
    bus.on('find', open);
    bus.on('replace', open);
    bus.on('find-bar-open', open);
    bus.on('find-bar-close', close);
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getMuya = (): ReturnType<MuyaEditorHandle['getMuya']> => editorRef.current?.getMuya() ?? null;

  const doSearch = (value: string): void => {
    const muya = getMuya();
    if (!muya || !value) {
      setHighlightCount(0);
      setHighlightIndex(0);
      return;
    }
    try {
      const result = muya.search(value, { isCaseSensitive, isWholeWord, isRegexp }) as unknown as {
        matches?: unknown[]
        index?: number
      } | undefined;
      const count = Array.isArray(result?.matches) ? result.matches.length : 0;
      setHighlightCount(count);
      setHighlightIndex(count > 0 ? 1 : 0);
      setSearchErrorMsg('');
    } catch (e) {
      setHighlightCount(0);
      setHighlightIndex(0);
      setSearchErrorMsg((e as Error)?.message ?? String(e));
    }
  };

  const onSearchInput = (value: string): void => {
    setSearchValue(value);
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => doSearch(value), 150);
  };

  const find = (action: 'previous' | 'next'): void => {
    const muya = getMuya();
    if (!muya || !searchValue) return;
    try {
      muya.find(action);
      setHighlightIndex((i) => {
        if (highlightCount <= 0) return 0;
        if (action === 'next') return Math.min(i + 1, highlightCount);
        return Math.max(i - 1, 1);
      });
    } catch { /* ignore */ }
  };

  const replaceSingle = (): void => {
    const muya = getMuya();
    if (!muya) return;
    try {
      muya.replace(replaceValue, { isSingle: true, isRegexp: isRegexp });
      doSearch(searchValue);
    } catch { /* ignore */ }
  };

  const replaceAll = (): void => {
    const muya = getMuya();
    if (!muya) return;
    try {
      muya.replace(replaceValue, { isSingle: false, isRegexp: isRegexp });
      doSearch(searchValue);
    } catch { /* ignore */ }
  };

  const toggleCtrl = (key: 'isCaseSensitive' | 'isWholeWord' | 'isRegexp'): void => {
    if (key === 'isCaseSensitive') setIsCaseSensitive((v) => !v);
    if (key === 'isWholeWord') setIsWholeWord((v) => !v);
    if (key === 'isRegexp') setIsRegexp((v) => !v);
    // 重查（等 state 更新后）
    setTimeout(() => doSearch(searchValue), 0);
  };

  if (!show) return null;

  return (
    <div className="search-bar" onClick={(e) => e.stopPropagation()}>
      <div className="left-arrow" onClick={() => setType((t) => (t === 'search' ? 'replace' : 'search'))}>
        <svg className={type === 'search' ? 'arrow-right' : ''} width="14" height="14" aria-hidden="true">
          <use xlinkHref="#icon-arrowdown" />
        </svg>
      </div>
      <div className="right-controls">
        <section className="search">
          <div className={`input-wrapper${searchErrorMsg ? ' error' : ''}`}>
            <input
              ref={inputRef}
              type="text"
              value={searchValue}
              placeholder={t('search.searchPlaceholder')}
              onChange={(e) => onSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  find(e.shiftKey ? 'previous' : 'next');
                }
                if (e.key === 'Escape') setShow(false);
              }}
            />
            <div className="controls">
              <span className="search-result">
                {highlightIndex} / {highlightCount}
              </span>
              <span
                className={`is-case-sensitive${isCaseSensitive ? ' active' : ''}`}
                title={t('search.caseSensitive')}
                onClick={() => toggleCtrl('isCaseSensitive')}
              >Aa</span>
              <span
                className={`is-whole-word${isWholeWord ? ' active' : ''}`}
                title={t('search.wholeWord')}
                onClick={() => toggleCtrl('isWholeWord')}
              >W</span>
              <span
                className={`is-regex${isRegexp ? ' active' : ''}`}
                title={t('search.useRegex')}
                onClick={() => toggleCtrl('isRegexp')}
              >.*</span>
            </div>
            {searchErrorMsg && <div className="error-msg">{searchErrorMsg}</div>}
          </div>
          <div className="button-group">
            <button className="button right" onClick={() => find('previous')}>↑</button>
            <button className="button" onClick={() => find('next')}>↓</button>
          </div>
        </section>
        {type === 'replace' && (
          <section className="replace">
            <div className="input-wrapper">
              <input
                type="text"
                value={replaceValue}
                placeholder={t('search.replacementPlaceholder')}
                onChange={(e) => setReplaceValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    replaceSingle();
                  }
                }}
              />
            </div>
            <div className="button-group">
              <button className="button right" onClick={replaceSingle}>{t('search.replaceSingle')}</button>
              <button className="button" onClick={replaceAll}>{t('search.replaceAll')}</button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
