// Per-machine app settings (not per project). Tauri: settings.json in the app
// data dir. Plain browser (dev preview): localStorage.

import { create } from "zustand";
import { DEFAULT_AUTOSAVE_MINUTES } from "./session";
import { isTauri } from "./persist";

export interface Settings {
  /** Minutes between autosaves; 0 = never. */
  autosaveMinutes: number;
}

const DEFAULTS: Settings = { autosaveMinutes: DEFAULT_AUTOSAVE_MINUTES };
const DIR = "glyph-palette";
const FILE = `${DIR}/settings.json`;
const LS_KEY = "glyph-palette:settings";

interface SettingsState extends Settings {
  update: (patch: Partial<Settings>) => void;
}

export const useSettings = create<SettingsState>((set, get) => ({
  ...DEFAULTS,
  update: (patch) => {
    set(patch);
    const { update: _, ...settings } = get();
    void writeSettings(settings);
  },
}));

async function writeSettings(settings: Settings): Promise<void> {
  const txt = JSON.stringify(settings, null, 2);
  try {
    if (isTauri()) {
      const { mkdir, writeTextFile, exists, BaseDirectory } = await import("@tauri-apps/plugin-fs");
      if (!(await exists(DIR, { baseDir: BaseDirectory.AppData }))) {
        await mkdir(DIR, { baseDir: BaseDirectory.AppData, recursive: true });
      }
      await writeTextFile(FILE, txt, { baseDir: BaseDirectory.AppData });
    } else {
      localStorage.setItem(LS_KEY, txt);
    }
  } catch (e) {
    console.error("Could not save settings.", e);
  }
}

/** Loads saved settings over the defaults (App, on mount). */
export async function loadSettings(): Promise<void> {
  try {
    let txt: string | null = null;
    if (isTauri()) {
      const { exists, readTextFile, BaseDirectory } = await import("@tauri-apps/plugin-fs");
      if (await exists(FILE, { baseDir: BaseDirectory.AppData })) {
        txt = await readTextFile(FILE, { baseDir: BaseDirectory.AppData });
      }
    } else {
      txt = localStorage.getItem(LS_KEY);
    }
    if (txt) useSettings.setState({ ...DEFAULTS, ...(JSON.parse(txt) as Partial<Settings>) });
  } catch (e) {
    console.error("Could not read settings; using defaults.", e);
  }
}
