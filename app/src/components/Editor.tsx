import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import {
  EditorView, keymap, lineNumbers, highlightActiveLine, drawSelection,
} from '@codemirror/view';
import { EditorState, Compartment } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';
import { oneDark } from '@codemirror/theme-one-dark';
import { vim } from '@replit/codemirror-vim';
import { liveEditExtension } from '../lib/cm-live-render';

const liveEditCompartment = new Compartment();
const lineNumbersCompartment = new Compartment();

interface EditorProps {
  content: string;
  filePath: string | null;
  language: 'markdown' | 'plaintext';
  showLiveEdit: boolean;
  showLineNumbers: boolean;
  onChange: (content: string) => void;
  onBlur: () => void;
  onSave: () => void;
}

export interface EditorHandle {
  scrollToLine: (line: number) => void;
  lineToTop: (line: number) => number;
}

const Editor = forwardRef<EditorHandle, EditorProps>(function Editor(
  { content, filePath, language, showLiveEdit, showLineNumbers, onChange, onBlur, onSave },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  useImperativeHandle(ref, () => ({
    scrollToLine(line: number) {
      const v = viewRef.current; if (!v) return;
      v.dispatch({ effects: EditorView.scrollIntoView(v.state.doc.line(line).from, { y: 'start', yMargin: 0 }) });
    },
    lineToTop(line: number) {
      const v = viewRef.current; if (!v) return 0;
      const c = v.coordsAtPos(v.state.doc.line(line).from);
      if (!c) return 0;
      return c.top - v.scrollDOM.getBoundingClientRect().top + v.scrollDOM.scrollTop;
    },
  }), []);

  useEffect(() => {
    if (!containerRef.current) return;

    const theme = EditorView.theme({
      '&': { height: '100%', width: '100%' },
      '.cm-scroller': { overflow: 'auto' },
      '.cm-content': {
        fontFamily: 'var(--content-font-family, var(--font-ui))',
        fontSize: 'var(--content-font-size, 15px)',
        lineHeight: '1.7',
        padding: '28px 36px 64px',
        maxWidth: 'var(--preview-max-width, 760px)',
        margin: '0 auto',
      },
    });

    const extensions: any[] = [
      lineNumbersCompartment.of(showLineNumbers ? lineNumbers() : []),
      highlightActiveLine(),
      drawSelection(),
      history(),
      syntaxHighlighting(defaultHighlightStyle),
      EditorView.lineWrapping,
      theme,
      keymap.of([
        ...defaultKeymap,
        ...historyKeymap,
        { key: 'Mod-s', run: () => { onSave(); return true; }, preventDefault: true },
      ]),
      liveEditCompartment.of(showLiveEdit && language === 'markdown' ? liveEditExtension([]) : []),
      EditorView.updateListener.of((update) => { if (update.docChanged) onChange(update.state.doc.toString()); }),
      EditorView.domEventHandlers({ blur: () => onBlur() }),
    ];

    if (language === 'markdown') extensions.push(markdown({ base: markdownLanguage, codeLanguages: languages }));
    if (localStorage.getItem('notademics.vim') === '1') extensions.push(vim());
    if (document.documentElement.getAttribute('data-theme') === 'dark') extensions.push(oneDark);

    const state = EditorState.create({ doc: content, extensions });
    const view = new EditorView({ state, parent: containerRef.current });
    viewRef.current = view;
    return () => { view.destroy(); viewRef.current = null; };
  }, []);

  useEffect(() => {
    viewRef.current?.dispatch({
      effects: liveEditCompartment.reconfigure(
        showLiveEdit && language === 'markdown' ? liveEditExtension([]) : [],
      ),
    });
  }, [showLiveEdit, language]);

  useEffect(() => {
    viewRef.current?.dispatch({
      effects: lineNumbersCompartment.reconfigure(showLineNumbers ? lineNumbers() : []),
    });
  }, [showLineNumbers]);

  useEffect(() => {
    const v = viewRef.current; if (!v) return;
    const cur = v.state.doc.toString();
    if (cur !== content) v.dispatch({ changes: { from: 0, to: cur.length, insert: content } });
  }, [content, filePath]);

  return <div ref={containerRef} data-pane="editor" style={{ height: '100%', width: '100%', overflow: 'hidden' }} />;
});

export default Editor;
