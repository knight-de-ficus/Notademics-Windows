import { useMemo } from 'react';

interface PreviewProps {
  html: string;
}

/**
 * Renders pre-compiled markdown HTML in a sandboxed preview pane.
 * Inline styles from tokens.css ensure the preview matches the editor.
 */
export default function Preview({ html }: PreviewProps) {
  const safeHtml = useMemo(() => html, [html]);

  return (
    <div className="preview-container" style={{ height: '100%', overflow: 'auto', padding: '1rem 2rem' }}>
      <div
        className="markdown-body"
        dangerouslySetInnerHTML={{ __html: safeHtml }}
      />
    </div>
  );
}
