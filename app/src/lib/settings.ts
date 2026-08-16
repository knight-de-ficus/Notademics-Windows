// 应用设置 —— zustand store，读写后端 settings.json。
import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';

export interface AppSettings {
  theme: 'light' | 'dark';
  fontSize: number;
  lineHeight: number;
  codeFontSize: number;
  tabSize: number;
  autoSave: boolean;
  showFileTree: boolean;
  lastWorkspace: string | null;
}

interface SettingsState extends AppSettings {
  loaded: boolean;
  load: () => Promise<void>;
  update: (patch: Partial<AppSettings>) => Promise<void>;
}

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'light',
  fontSize: 16,
  lineHeight: 1.6,
  codeFontSize: 14,
  tabSize: 4,
  autoSave: false,
  showFileTree: true,
  lastWorkspace: null,
};

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...DEFAULT_SETTINGS,
  loaded: false,
  async load() {
    try {
      const s = (await invoke('get_settings')) as Partial<AppSettings>;
      set({ ...DEFAULT_SETTINGS, ...s, loaded: true });
    } catch {
      set({ ...DEFAULT_SETTINGS, loaded: true });
    }
  },
  async update(patch) {
    const next = { ...get(), ...patch };
    set(patch);
    try {
      await invoke('set_settings', { settings: next });
    } catch (e) {
      console.error('set_settings failed:', e);
    }
  },
}));
