/* Typora-style footer.
 *
 * Evidence: Typora 1.14.9 `resources/window.html` footer markup defines
 * `#outline-btn`, `#toggle-sourceview-btn`, `#toggle-focus-mode-btn`,
 * `#toggle-typewriter-mode-btn` on the left and `#footer-word-count` on the
 * right; the word-count dropdown lists reading time, lines, words and
 * characters (`#footer-word-count-info`). `resources/appsrc/window/frame.js`
 * binds those ids to sidebar / source / focus / typewriter toggles.
 *
 * This component mirrors that layout on top of the Muya writing surface:
 * left = view-mode switches, right = word-count popover.
 */
import { useCallback, useMemo, useState, type ReactElement } from 'react'
import { wordCount as computeWordCount } from '@muyajs/core'
import { useEditorStore } from '../../store/editor'
import { useLayoutStore } from '../../store/layout'
import { usePreferencesStore } from '../../store/preferences'

/** Typora's default reading-speed preset (382 wpm, "Fast"). */
const READING_WORDS_PER_MINUTE = 382

const IconSidebar = (): ReactElement => (
  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
    <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" fill="none" stroke="currentColor" />
    <line x1="5.5" y1="2.5" x2="5.5" y2="13.5" stroke="currentColor" />
  </svg>
)

const IconSource = (): ReactElement => (
  <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
    <path d="M5.5 4 2 8l3.5 4M10.5 4 14 8l-3.5 4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const IconFocus = (): ReactElement => (
  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
    <path
      d="M8 1.8a4.6 4.6 0 0 0-2.9 8.2c.5.4.8 1 .8 1.6v.4h4.2v-.4c0-.6.3-1.2.8-1.6A4.6 4.6 0 0 0 8 1.8Z"
      fill="none"
      stroke="currentColor"
      strokeLinejoin="round"
    />
    <line x1="6.2" y1="14" x2="9.8" y2="14" stroke="currentColor" strokeLinecap="round" />
  </svg>
)

const IconTypewriter = (): ReactElement => (
  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
    <path d="M3 5.5c2-2 3.5 2 5.5 0s3.5 2 5.5 0" fill="none" stroke="currentColor" strokeLinecap="round" />
    <path d="M3 10.5c2-2 3.5 2 5.5 0s3.5 2 5.5 0" fill="none" stroke="currentColor" strokeLinecap="round" />
  </svg>
)

const formatMinutes = (words: number): string => {
  const minutes = Math.max(1, Math.ceil(words / READING_WORDS_PER_MINUTE))
  return `鈮?${minutes}`
}

export default function StatusBar() {
  const editorStore = useEditorStore()
  const layoutStore = useLayoutStore()
  const preferencesStore = usePreferencesStore()
  const [popoverOpen, setPopoverOpen] = useState(false)

  const currentFile = editorStore.currentFile
  const markdown = currentFile?.markdown ?? ''
  // Typora counts on load; the store only carries a count once the engine has
  // emitted a change, so fall back to computing it from the document.
  const counts = useMemo(() => {
    const stored = currentFile?.wordCount
    if (stored && (stored.word > 0 || !markdown.trim())) return stored
    return computeWordCount(markdown)
  }, [currentFile?.wordCount, markdown])
  const words = counts?.word ?? 0
  // Typora reports raw Markdown length for "Characters" (markup and spaces
  // included), not the engine's whitespace-stripped character count.
  const characters = markdown.length
  const lines = useMemo(() => (markdown ? markdown.split('\n').length : 0), [markdown])
  const selection = window.getSelection()?.toString() ?? ''

  const toggleMode = useCallback(
    (mode: 'sourceCode' | 'focus' | 'typewriter' | 'readonly') => {
      usePreferencesStore.getState().TOGGLE_VIEW_MODE(mode)
    },
    []
  )

  const toggleSidebar = useCallback(() => {
    useLayoutStore.getState().TOGGLE_LAYOUT_ENTRY('showSideBar')
  }, [])

  return (
    <footer
      className="status-bar typora-footer"
      onMouseLeave={() => setPopoverOpen(false)}
    >
      <div className="status-bar-left">
        <button
          type="button"
          className={`footer-btn${layoutStore.showSideBar ? ' active' : ''}`}
          title="Toggle Sidebar (Ctrl+Shift+L)"
          aria-label="Toggle Sidebar"
          onClick={toggleSidebar}
        >
          <IconSidebar />
        </button>
        <button
          type="button"
          className={`footer-btn footer-btn-wide${preferencesStore.sourceCode ? ' active' : ''}`}
          title={preferencesStore.sourceCode ? 'Exit Source Code Mode (Ctrl+/)' : 'Toggle Source Code Mode (Ctrl+/)'}
          aria-label="Toggle Source Code Mode"
          onClick={() => toggleMode('sourceCode')}
        >
          <IconSource />
          {preferencesStore.sourceCode && <span className="footer-btn-label">Exit Source Code Mode</span>}
        </button>
        <button
          type="button"
          className={`footer-btn${preferencesStore.focus ? ' active' : ''}`}
          title="Focus Mode (F8)"
          aria-label="Focus Mode"
          onClick={() => toggleMode('focus')}
        >
          <IconFocus />
        </button>
        <button
          type="button"
          className={`footer-btn${preferencesStore.typewriter ? ' active' : ''}`}
          title="Typewriter Mode (F9)"
          aria-label="Typewriter Mode"
          onClick={() => toggleMode('typewriter')}
        >
          <IconTypewriter />
        </button>
      </div>

      <div className="status-bar-right">
        <div
          className={`word-count${popoverOpen ? ' open' : ''}`}
          onMouseEnter={() => setPopoverOpen(true)}
        >
          <button
            type="button"
            className="status-item word-count-label"
            aria-haspopup="true"
            aria-expanded={popoverOpen}
            title="Word Count"
            onClick={() => setPopoverOpen((open) => !open)}
          >
            {words} Words
          </button>
          {popoverOpen && (
            <div className="word-count-info" role="dialog" aria-label="Word Count">
              <table>
                <tbody>
                  <tr>
                    <td className="count">{formatMinutes(words)}</td>
                    <td>Minutes</td>
                  </tr>
                  <tr>
                    <td className="count">{lines}</td>
                    <td>Lines</td>
                  </tr>
                  <tr>
                    <td className="count">{words}</td>
                    <td>Words</td>
                  </tr>
                  <tr>
                    <td className="count">{characters}</td>
                    <td>Characters</td>
                  </tr>
                  {selection && (
                    <>
                      <tr className="section-head">
                        <td colSpan={2}>In Selection</td>
                      </tr>
                      <tr>
                        <td className="count">{selection.trim() ? selection.trim().split(/\s+/).length : 0}</td>
                        <td>Words</td>
                      </tr>
                      <tr>
                        <td className="count">{selection.length}</td>
                        <td>Characters</td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </footer>
  )
}

