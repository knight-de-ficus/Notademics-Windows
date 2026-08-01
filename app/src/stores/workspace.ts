import { create } from 'zustand';

interface WorkspaceState {
  currentFolder: string | null;
  recentFiles: string[];
  recentFolders: string[];
  safTreeUri: string | null;
  safName: string | null;

  setFolder: (path: string | null) => void;
  pushRecent: (path: string) => void;
  removeRecent: (path: string) => void;
  pushRecentFolder: (path: string) => void;
}

const MAX_RECENT = 12;
const MAX_RECENT_FOLDERS = 8;

function loadFromStorage(): Partial<WorkspaceState> {
  try {
    const raw = localStorage.getItem('solomd.workspace.v1');
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

function saveToStorage(state: WorkspaceState) {
  try {
    localStorage.setItem(
      'solomd.workspace.v1',
      JSON.stringify({
        recentFiles: state.recentFiles,
        recentFolders: state.recentFolders,
        currentFolder: state.currentFolder,
        safTreeUri: state.safTreeUri,
        safName: state.safName,
      }),
    );
  } catch {}
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => {
  const saved = loadFromStorage();

  return {
    currentFolder: saved.currentFolder ?? null,
    recentFiles: saved.recentFiles ?? [],
    recentFolders: saved.recentFolders ?? [],
    safTreeUri: saved.safTreeUri ?? null,
    safName: saved.safName ?? null,

    setFolder: (path) => {
      set({ currentFolder: path });
      saveToStorage(get());
    },

    pushRecent: (path) => {
      set((s) => ({
        recentFiles: [path, ...s.recentFiles.filter((p) => p !== path)].slice(
          0,
          MAX_RECENT,
        ),
      }));
      saveToStorage(get());
    },

    removeRecent: (path) => {
      set((s) => ({
        recentFiles: s.recentFiles.filter((p) => p !== path),
      }));
      saveToStorage(get());
    },

    pushRecentFolder: (path) => {
      set((s) => ({
        recentFolders: [
          path,
          ...s.recentFolders.filter((p) => p !== path),
        ].slice(0, MAX_RECENT_FOLDERS),
      }));
      saveToStorage(get());
    },
  };
});
