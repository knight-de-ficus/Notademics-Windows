// Theme 偏好页 —— 对齐 marktext prefComponents/theme。
import { usePreferencesStore } from '../../store/preferences';
import { BoolInput, SelectInput, TextAreaInput, Separator } from '../common';
import { RangeInput, TextBoxInput } from '../common';
import { open } from '@tauri-apps/plugin-dialog';

const THEMES = [
  'light', 'dark', 'graphite', 'material-dark', 'one-dark', 'ulysses',
  'dracula', 'nord', 'catppuccin-mocha', 'gruvbox-dark', 'tokyo-night', 'tokyo-night-storm',
  'solarized-dark', 'ayu-dark', 'ayu-mirage', 'everforest-dark', 'rose-pine', 'rose-pine-moon',
  'monokai-pro', 'synthwave-84', 'horizon-dark', 'palenight', 'oxocarbon-dark', 'kanagawa',
  'nightfox', 'cyberdream', 'catppuccin-latte', 'gruvbox-light', 'tokyo-night-light',
  'solarized-light', 'ayu-light', 'everforest-light', 'rose-pine-dawn'
]

export default function Theme() {
  const p = usePreferencesStore();

  return (
    <div className="pref-page">
      <h2>Theme</h2>

      <Separator />
      <BoolInput title="Follow System Theme" value={p.followSystemTheme} onChange={(v) => p.SET_SINGLE_PREFERENCE('followSystemTheme', v)} />

      {p.followSystemTheme ? (
        <>
          <SelectInput
            title="Light mode theme"
            value={p.lightModeTheme}
            options={THEMES.map((th) => ({ label: th, value: th }))}
            onChange={(v) => p.SET_SINGLE_PREFERENCE('lightModeTheme', v)}
          />
          <SelectInput
            title="Dark mode theme"
            value={p.darkModeTheme}
            options={THEMES.map((th) => ({ label: th, value: th }))}
            onChange={(v) => p.SET_SINGLE_PREFERENCE('darkModeTheme', v)}
          />
        </>
      ) : (
        <div className="theme-grid">
          {THEMES.map((th) => (
            <div
              key={th}
              className={`theme-item${p.theme === th ? ' active' : ''}`}
              onClick={() => p.SET_SINGLE_PREFERENCE('theme', th)}
              title={th}
            >
              <div className="theme-preview" style={{ background: th.includes('dark') || th === 'one-dark' || th === 'dracula' || th === 'nord' ? '#282c34' : '#ffffff' }} />
              <span className="theme-name">{th}</span>
            </div>
          ))}
        </div>
      )}

      <Separator />
      <h3>Editor background</h3>
      <TextBoxInput
        title="Image path"
        description="Choose a local image used behind the editor and home page."
        value={p.editorBackgroundImage}
        onChange={(v) => p.SET_SINGLE_PREFERENCE('editorBackgroundImage', v)}
      />
      <div className="background-image-actions">
        <button type="button" onClick={() => {
          void open({ multiple: false, filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg'] }] })
            .then((path) => {
              if (typeof path === 'string') p.SET_SINGLE_PREFERENCE('editorBackgroundImage', path)
            })
        }}>Choose image…</button>
        <button type="button" disabled={!p.editorBackgroundImage} onClick={() => p.SET_SINGLE_PREFERENCE('editorBackgroundImage', '')}>Clear</button>
      </div>
      <SelectInput
        title="Alignment"
        value={p.editorBackgroundPosition}
        options={[
          ['Top left', 'top-left'], ['Top', 'top'], ['Top right', 'top-right'],
          ['Left', 'left'], ['Center', 'center'], ['Right', 'right'],
          ['Bottom left', 'bottom-left'], ['Bottom', 'bottom'], ['Bottom right', 'bottom-right']
        ].map(([label, value]) => ({ label, value }))}
        onChange={(v) => p.SET_SINGLE_PREFERENCE('editorBackgroundPosition', v)}
      />
      <SelectInput
        title="Fill mode"
        value={p.editorBackgroundFit}
        options={[
          { label: 'Fill (cover)', value: 'cover' },
          { label: 'Fit (contain)', value: 'contain' },
          { label: 'Stretch', value: 'stretch' },
          { label: 'Tile', value: 'tile' }
        ]}
        onChange={(v) => p.SET_SINGLE_PREFERENCE('editorBackgroundFit', v)}
      />
      <RangeInput title="Opacity" value={p.editorBackgroundOpacity} min={0} max={1} step={0.05} onChange={(v) => p.SET_SINGLE_PREFERENCE('editorBackgroundOpacity', v)} />

      <Separator />
      <TextAreaInput title="Custom CSS" value={p.customCss} onChange={(v) => p.SET_SINGLE_PREFERENCE('customCss', v)} />
    </div>
  );
}
