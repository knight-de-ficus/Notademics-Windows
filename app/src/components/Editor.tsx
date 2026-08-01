import { useEffect, useRef, useCallback } from 'react';
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
} from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';
import { oneDark } from '@codemirror/theme-one-dark';
import { vim } from '@replit/codemirror-vim';

interface EditorProps {
  content: string;
  filePath: string | null;
  language: 'markdown' | 'plaintext';
  onChange: (content: string) => void;
  onBlur: () => void;
  onSave: () => void;
}

/**
 * CodeMirror 6 editor wrapper.
 * Framework-agnostic — uses EditorView directly on a DOM ref.
 * Vim mode is enabled when ?vim is in localStorage.
 */
export default function Editor({
  content,
  filePath,
  language,
  onChange,
  onBlur,
  onSave,
}: EditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  // Initialize editor
  useEffect(() => {
    if (!containerRef.current) return;

    const extensions = [
      lineNumbers(),
      highlightActiveLine(),
      history(),
      syntaxHighlighting(defaultHighlightStyle),
      keymap.of([
        ...defaultKeymap,
        ...historyKeymap,
        {
          key: 'Mod-s',
          run: () => {
            onSave();
            return true;
          },
          preventDefault: true,
        },
      ]),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          onChange(update.state.doc.toString());
        }
      }),
      EditorView.domEventHandlers({
        blur: () => onBlur(),
      }),
    ];

    // Language extension
    if (language === 'markdown') {
      extensions.push(
        markdown({ base: markdownLanguage, codeLanguages: languages }),
      );
    }

    // Vim mode
    if (localStorage.getItem('solomd.vim') === '1') {
      extensions.push(vim());
    }

    // Dark theme
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    if (isDark) {
      extensions.push(oneDark);
    }

    const state = EditorState.create({
      doc: content,
      extensions,
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, []); // mount once

  // Sync content from outside (e.g., file opened)
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== content) {
      view.dispatch({
        changes: {
          from: 0,
          to: current.length,
          insert: content,
        },
      });
    }
  }, [content, filePath]);

  // React to theme changes
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

    // Simple theme toggling: reconfigure dark theme compartment
    // For phase 1 this is sufficient
    view.dispatch({
      effects: isDark
        ? [] // TODO: add oneDark via compartment later
        : [],
    });
  }, []);

  return (
    <div
      ref={containerRef}
      className="cm-editor-container"
      style={{ height: '100%', overflow: 'auto' }}
    />
  );
}
