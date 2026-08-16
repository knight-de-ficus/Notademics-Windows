// General 偏好页 —— 对齐 marktext prefComponents/general。
import { usePreferencesStore } from '../../store/preferences';
import { useI18n, setLanguage } from '../../i18n';
import { BoolInput, RangeInput, SelectInput, TextBoxInput, Separator } from '../common';

const LANGUAGES = [
  { label: 'English', value: 'en' },
  { label: '简体中文', value: 'zh-CN' },
  { label: '繁體中文', value: 'zh-TW' },
  { label: 'Deutsch', value: 'de' },
  { label: 'Español', value: 'es' },
  { label: 'Français', value: 'fr' },
  { label: '日本語', value: 'ja' },
  { label: '한국어', value: 'ko' },
  { label: 'Português', value: 'pt' },
  { label: 'Türkçe', value: 'tr' }
]

export default function General() {
  const p = usePreferencesStore();
  useI18n();

  return (
    <div className="pref-page">
      <h2>General</h2>

      <Separator />
      <h3>Language</h3>
      <SelectInput
        title="Language"
        value={p.language}
        options={LANGUAGES}
        onChange={(v) => {
          p.SET_SINGLE_PREFERENCE('language', v);
          void setLanguage(v);
        }}
      />

      <Separator />
      <h3>Window</h3>
      <SelectInput
        title="Title Bar Style"
        value={p.titleBarStyle}
        options={[{ label: 'Custom', value: 'custom' }, { label: 'Native', value: 'native' }]}
        onChange={(v) => p.SET_SINGLE_PREFERENCE('titleBarStyle', v)}
      />
      <BoolInput title="Hide scrollbars" value={p.hideScrollbar} onChange={(v) => p.SET_SINGLE_PREFERENCE('hideScrollbar', v)} />
      <BoolInput title="Open files in new window" value={p.openFilesInNewWindow} onChange={(v) => p.SET_SINGLE_PREFERENCE('openFilesInNewWindow', v)} />
      <RangeInput title="Zoom" value={p.zoom} min={0.5} max={2} step={0.1} onChange={(v) => p.SET_SINGLE_PREFERENCE('zoom', v)} />

      <Separator />
      <h3>Startup</h3>
      <SelectInput
        title="Start Up Action"
        value={p.startUpAction}
        options={[
          { label: 'Restore previous state', value: 'restoreAll' },
          { label: 'Open blank page', value: 'blank' }
        ]}
        onChange={(v) => p.SET_SINGLE_PREFERENCE('startUpAction', v)}
      />
      <BoolInput title="Restore previous editor state" value={p.restoreLayoutState} onChange={(v) => p.SET_SINGLE_PREFERENCE('restoreLayoutState', v)} />

      <Separator />
      <h3>Sidebar</h3>
      <BoolInput title="Wrap text in table of contents" value={p.wordWrapInToc} onChange={(v) => p.SET_SINGLE_PREFERENCE('wordWrapInToc', v)} />
      <BoolInput title="Show opened files" value={p.openedFilesInSidebar} onChange={(v) => p.SET_SINGLE_PREFERENCE('openedFilesInSidebar', v)} />
      <SelectInput
        title="File Sort By"
        value={p.fileSortBy}
        options={[
          { label: 'Creation Time', value: 'created' },
          { label: 'Modification Time', value: 'modified' },
          { label: 'File Name', value: 'name' }
        ]}
        onChange={(v) => p.SET_SINGLE_PREFERENCE('fileSortBy', v)}
      />
      <TextBoxInput title="Exclude patterns" value={p.treePathExcludePatterns?.join(', ') ?? ''} onChange={(v) => p.SET_SINGLE_PREFERENCE('treePathExcludePatterns', v.split(',').map((s) => s.trim()).filter(Boolean))} />

      <Separator />
      <h3>Auto Save</h3>
      <BoolInput title="Auto Save" value={p.autoSave} onChange={(v) => p.SET_SINGLE_PREFERENCE('autoSave', v)} />
      <RangeInput title="Auto Save Delay (ms)" value={p.autoSaveDelay} min={500} max={10000} step={500} onChange={(v) => p.SET_SINGLE_PREFERENCE('autoSaveDelay', v)} />
    </div>
  );
}
