// Persistent per-machine default library. Tauri: a JSON file in the app data
// dir. Plain browser (dev preview): localStorage. Seeded from SEED_LIBRARY on
// first run.

import { SEED_LIBRARY, LibraryFile, normalizeLibrary } from "./defaultLibrary";
import { isTauri } from "./persist";

const LS_KEY = "glyph-palette:default-library";
const DIR = "glyph-palette";
const PATH = `${DIR}/library.json`;

export async function loadDefaultLibrary(): Promise<LibraryFile> {
  try {
    if (isTauri()) {
      const { exists, readTextFile, BaseDirectory } = await import("@tauri-apps/plugin-fs");
      if (await exists(PATH, { baseDir: BaseDirectory.AppData })) {
        const txt = await readTextFile(PATH, { baseDir: BaseDirectory.AppData });
        return normalizeLibrary(JSON.parse(txt));
      }
    } else {
      const txt = localStorage.getItem(LS_KEY);
      if (txt) return normalizeLibrary(JSON.parse(txt));
    }
  } catch (e) {
    console.error("Could not read the default library; falling back to the seed.", e);
    return normalizeLibrary(structuredClone(SEED_LIBRARY));
  }
  // First run on this machine — persist the seed so it's editable from now on.
  const seed = normalizeLibrary(structuredClone(SEED_LIBRARY));
  await saveDefaultLibrary(seed);
  return seed;
}

export async function saveDefaultLibrary(lib: LibraryFile): Promise<void> {
  const txt = JSON.stringify(lib, null, 2);
  try {
    if (isTauri()) {
      const { mkdir, writeTextFile, exists, BaseDirectory } = await import("@tauri-apps/plugin-fs");
      if (!(await exists(DIR, { baseDir: BaseDirectory.AppData }))) {
        await mkdir(DIR, { baseDir: BaseDirectory.AppData, recursive: true });
      }
      await writeTextFile(PATH, txt, { baseDir: BaseDirectory.AppData });
    } else {
      localStorage.setItem(LS_KEY, txt);
    }
  } catch (e) {
    console.error("Could not save the default library.", e);
  }
}
