// Editor 偏好页 —— 对齐 marktext prefComponents/editor。
import { usePreferencesStore } from '../../store/preferences';
import { BoolInput, RangeInput, SelectInput, TextBoxInput, Separator } from '../common';

export default function Editor() {
  const p = usePreferencesStore();

  return (
    <div className="pref-page">
      <h2>Editor</h2>

      <Separator />
      <h3>Text Editor</h3>
      <RangeInput title="Font Size" value={p.fontSize} min={12} max={32} onChange={(v) => p.SET_SINGLE_PREFERENCE('fontSize', v)} />
      <RangeInput title="Line Height" value={p.lineHeight} min={1} max={2.6} step={0.1} onChange={(v) => p.SET_SINGLE_PREFERENCE('lineHeight', v)} />
      <TextBoxInput title="Font Family" value={p.editorFontFamily} onChange={(v) => p.SET_SINGLE_PREFERENCE('editorFontFamily', v)} />
      <TextBoxInput title="Max Width" value={p.editorLineWidth} onChange={(v) => p.SET_SINGLE_PREFERENCE('editorLineWidth', v)} />

      <Separator />
      <h3>Code Block</h3>
      <RangeInput title="Font Size" value={p.codeFontSize} min={12} max={24} onChange={(v) => p.SET_SINGLE_PREFERENCE('codeFontSize', v)} />
      <TextBoxInput title="Font Family" value={p.codeFontFamily} onChange={(v) => p.SET_SINGLE_PREFERENCE('codeFontFamily', v)} />
      <BoolInput title="Show line numbers" value={p.codeBlockLineNumbers} onChange={(v) => p.SET_SINGLE_PREFERENCE('codeBlockLineNumbers', v)} />
      <BoolInput title="Remove empty lines" value={p.trimUnnecessaryCodeBlockEmptyLines} onChange={(v) => p.SET_SINGLE_PREFERENCE('trimUnnecessaryCodeBlockEmptyLines', v)} />
      <BoolInput title="Wrap code blocks" value={p.wrapCodeBlocks} onChange={(v) => p.SET_SINGLE_PREFERENCE('wrapCodeBlocks', v)} />

      <Separator />
      <h3>Writing Behavior</h3>
      <BoolInput title="Auto close brackets" value={p.autoPairBracket} onChange={(v) => p.SET_SINGLE_PREFERENCE('autoPairBracket', v)} />
      <BoolInput title="Auto complete markdown" value={p.autoPairMarkdownSyntax} onChange={(v) => p.SET_SINGLE_PREFERENCE('autoPairMarkdownSyntax', v)} />
      <BoolInput title="Auto close quotes" value={p.autoPairQuote} onChange={(v) => p.SET_SINGLE_PREFERENCE('autoPairQuote', v)} />

      <Separator />
      <h3>File Representation</h3>
      <RangeInput title="Tab width" value={p.tabSize} min={2} max={8} onChange={(v) => p.SET_SINGLE_PREFERENCE('tabSize', v)} />
      <SelectInput
        title="Line Separator"
        value={p.endOfLine}
        options={[
          { label: 'Default', value: 'default' },
          { label: 'CRLF (Windows)', value: 'crlf' },
          { label: 'LF (Linux/Mac)', value: 'lf' }
        ]}
        onChange={(v) => p.SET_SINGLE_PREFERENCE('endOfLine', v)}
      />
      <SelectInput
        title="Default Encoding"
        value={p.defaultEncoding}
        options={[
          { label: 'UTF-8', value: 'utf8' },
          { label: 'UTF-8 (BOM)', value: 'utf8bom' },
          { label: 'UTF-16 LE', value: 'utf16le' },
          { label: 'GBK', value: 'gbk' }
        ]}
        onChange={(v) => p.SET_SINGLE_PREFERENCE('defaultEncoding', v)}
      />
      <BoolInput title="Auto detect encoding" value={p.autoGuessEncoding} onChange={(v) => p.SET_SINGLE_PREFERENCE('autoGuessEncoding', v)} />
      <SelectInput
        title="Trailing Newlines"
        value={p.trimTrailingNewline}
        options={[
          { label: 'Do Nothing', value: '0' },
          { label: 'Ensure One', value: '1' },
          { label: 'Preserve', value: '2' },
          { label: 'Trim All', value: '3' }
        ]}
        onChange={(v) => p.SET_SINGLE_PREFERENCE('trimTrailingNewline', Number(v))}
      />

      <Separator />
      <h3>Miscellaneous</h3>
      <SelectInput
        title="Text Direction"
        value={p.textDirection}
        options={[
          { label: 'Left to Right', value: 'ltr' },
          { label: 'Right to Left', value: 'rtl' }
        ]}
        onChange={(v) => p.SET_SINGLE_PREFERENCE('textDirection', v)}
      />
      <BoolInput title="Hide quick insert hint" value={p.hideQuickInsertHint} onChange={(v) => p.SET_SINGLE_PREFERENCE('hideQuickInsertHint', v)} />
      <BoolInput title="Hide link popup" value={p.hideLinkPopup} onChange={(v) => p.SET_SINGLE_PREFERENCE('hideLinkPopup', v)} />
      <BoolInput title="Auto check" value={p.autoCheck} onChange={(v) => p.SET_SINGLE_PREFERENCE('autoCheck', v)} />
    </div>
  );
}
