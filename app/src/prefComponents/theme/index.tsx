// Theme 偏好页 —— 对齐 marktext prefComponents/theme。
import { usePreferencesStore } from '../../store/preferences';
import { BoolInput, SelectInput, TextAreaInput, Separator } from '../common';

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
      <TextAreaInput title="Custom CSS" value={p.customCss} onChange={(v) => p.SET_SINGLE_PREFERENCE('customCss', v)} />
    </div>
  );
}
