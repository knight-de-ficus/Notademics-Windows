// Markdown 偏好页 —— 对齐 marktext prefComponents/markdown。
import { usePreferencesStore } from '../../store/preferences';
import { BoolInput, SelectInput, TextBoxInput, Separator } from '../common';

export default function Markdown() {
  const p = usePreferencesStore();

  return (
    <div className="pref-page">
      <h2>Markdown</h2>

      <Separator />
      <h3>Lists</h3>
      <SelectInput
        title="Bullet list marker"
        value={p.bulletListMarker}
        options={[
          { label: '*', value: '*' },
          { label: '+', value: '+' },
          { label: '-', value: '-' }
        ]}
        onChange={(v) => p.SET_SINGLE_PREFERENCE('bulletListMarker', v)}
      />
      <SelectInput
        title="Ordered list delimiter"
        value={p.orderListDelimiter}
        options={[
          { label: '.', value: '.' },
          { label: ')', value: ')' }
        ]}
        onChange={(v) => p.SET_SINGLE_PREFERENCE('orderListDelimiter', v)}
      />
      <BoolInput title="Prefer loose list items" value={p.preferLooseListItem} onChange={(v) => p.SET_SINGLE_PREFERENCE('preferLooseListItem', v)} />
      <SelectInput
        title="List Indentation"
        value={p.listIndentation}
        options={[
          { label: 'One Space', value: '1' },
          { label: 'Two Spaces', value: '2' },
          { label: 'Three Spaces', value: '3' },
          { label: 'Four Spaces', value: '4' }
        ]}
        onChange={(v) => p.SET_SINGLE_PREFERENCE('listIndentation', Number(v))}
      />

      <Separator />
      <h3>Miscellaneous</h3>
      <SelectInput
        title="Prefer Heading Style"
        value={p.preferHeadingStyle}
        options={[
          { label: 'ATX Style', value: 'atx' },
          { label: 'Setext Style', value: 'setext' }
        ]}
        onChange={(v) => p.SET_SINGLE_PREFERENCE('preferHeadingStyle', v)}
      />

      <Separator />
      <h3>Extensions</h3>
      <BoolInput title="Super/Sub script" value={p.superSubScript} onChange={(v) => p.SET_SINGLE_PREFERENCE('superSubScript', v)} />
      <BoolInput title="Footnote" value={p.footnote} onChange={(v) => p.SET_SINGLE_PREFERENCE('footnote', v)} />
      <SelectInput
        title="Frontmatter Type"
        value={p.frontmatterType}
        options={[
          { label: 'JSON with Braces', value: '{' },
          { label: 'JSON with Semicolon', value: ';' },
          { label: 'YAML', value: '-' }
        ]}
        onChange={(v) => p.SET_SINGLE_PREFERENCE('frontmatterType', v)}
      />

      <Separator />
      <h3>Diagrams</h3>
      <SelectInput
        title="Sequence Theme"
        value={p.sequenceTheme}
        options={[
          { label: 'Hand Drawn', value: 'hand' },
          { label: 'Simple', value: 'simple' }
        ]}
        onChange={(v) => p.SET_SINGLE_PREFERENCE('sequenceTheme', v)}
      />
      <TextBoxInput title="PlantUML Server URL" value={p.plantumlServer} onChange={(v) => p.SET_SINGLE_PREFERENCE('plantumlServer', v)} />

      <Separator />
      <h3>Compatibility</h3>
      <BoolInput title="Enable GitLab compatibility" value={p.isGitlabCompatibilityEnabled} onChange={(v) => p.SET_SINGLE_PREFERENCE('isGitlabCompatibilityEnabled', v)} />
      <BoolInput title="Enable HTML support" value={p.isHtmlEnabled} onChange={(v) => p.SET_SINGLE_PREFERENCE('isHtmlEnabled', v)} />
    </div>
  );
}
