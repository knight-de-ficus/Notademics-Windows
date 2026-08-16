// 文件夹内搜索 —— 对齐 marktext components/sideBar/search.vue。
// 调用 Rust search_in_folder 命令（walkdir + 行匹配）。
import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useProjectStore } from '../../store/project';
import bus from '../../bus';
import { t } from '../../i18n';

interface SearchResult {
  path: string
  line: number
  content: string
}

export default function SideBarSearch() {
  const projectStore = useProjectStore();
  const [query, setQuery] = useState('');
  const [isCaseSensitive, setIsCaseSensitive] = useState(false);
  const [isWholeWord, setIsWholeWord] = useState(false);
  const [isRegexp, setIsRegexp] = useState(false);
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);

  const workspace = projectStore.projectTree?.path ?? null;

  const doSearch = (): void => {
    if (!workspace || !query) return;
    setSearching(true);
    invoke<SearchResult[]>('search_in_folder', {
      query,
      path: workspace,
      isRegexp,
      isCaseSensitive,
      isWholeWord,
      maxResults: 200
    })
      .then((r) => setResults(r))
      .catch((err) => {
        console.error('search_in_folder failed:', err);
        setResults([]);
      })
      .finally(() => setSearching(false));
  };

  return (
    <div className="side-bar-search">
      <div className="search-input-wrapper">
        <input
          type="text"
          value={query}
          placeholder={t('sideBar.search.searchInFolder')}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') doSearch();
          }}
        />
        <div className="search-options">
          <span
            className={isCaseSensitive ? 'active' : ''}
            title={t('search.caseSensitive')}
            onClick={() => setIsCaseSensitive((v) => !v)}
          >Aa</span>
          <span
            className={isWholeWord ? 'active' : ''}
            title={t('search.wholeWord')}
            onClick={() => setIsWholeWord((v) => !v)}
          >W</span>
          <span
            className={isRegexp ? 'active' : ''}
            title={t('search.useRegex')}
            onClick={() => setIsRegexp((v) => !v)}
          >.*</span>
        </div>
      </div>

      {!workspace && <div className="no-folder">{t('sideBar.search.noFolderOpen')}</div>}

      {searching && <div className="searching">Searching…</div>}

      {results.length > 0 && (
        <div className="search-results">
          {results.map((r, i) => (
            <div
              key={i}
              className="search-result-item"
              onClick={() => bus.emit('sideBar::open-search-result', { path: r.path, line: r.line })}
            >
              <div className="result-path">{r.path}</div>
              <div className="result-line">{r.line}: {r.content}</div>
            </div>
          ))}
        </div>
      )}
      {results.length === 0 && !searching && query && (
        <div className="no-results">{t('sideBar.search.noResultsFound')}</div>
      )}
    </div>
  );
}
