import { useMemo, useRef, useCallback } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';

interface PreviewProps {
  html: string;
  readOnly?: boolean;
  docDir?: string | null;
  onClickLink?: (href: string) => void;
}

/**
 * Renders pre-compiled markdown HTML.
 * Resolves relative image/link paths via Tauri's asset protocol (`asset://`).
 */
export default function Preview({ html, readOnly, docDir, onClickLink }: PreviewProps) {
  const hostRef = useRef<HTMLDivElement>(null);

  const resolvedHtml = useMemo(() => {
    if (!html) return '';
    let result = html;
    if (docDir) {
      const base = docDir.replace(/\\/g, '/');
      const baseDir = base.endsWith('/') ? base : base + '/';
      // Rewrite relative src paths to Tauri asset protocol
      result = result.replace(
        /(src)=["'](?!https?:\/\/|\/|data:|asset:|#)([^"']+)["']/gi,
        (_m, attr, path) => {
          try {
            const assetUrl = convertFileSrc(baseDir + path);
            return `src="${assetUrl}"`;
          } catch { return `${attr}="${baseDir}${path}"`; }
        },
      );
    }
    return result;
  }, [html, docDir]);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest('a');
      if (!anchor) return;
      const href = anchor.getAttribute('href');
      if (!href || href === '#') return;
      // Skip wikilinks (handled by workspace index later)
      if (anchor.classList.contains('md-wikilink')) return;
      e.preventDefault();
      if (onClickLink) onClickLink(href);
    },
    [onClickLink],
  );

  return (
    <div ref={hostRef} className="preview-host" data-pane="preview"
      onClick={handleClick}
      style={{ height:'100%', overflow:'auto', cursor:readOnly?'default':undefined }}>
      <div className="preview-content"
        dangerouslySetInnerHTML={{ __html: resolvedHtml }} />
    </div>
  );
}
