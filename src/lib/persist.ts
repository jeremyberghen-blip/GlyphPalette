// Project save/load and PNG export. Uses native dialogs + fs inside Tauri;
// falls back to browser download / file-input when running in a plain browser
// (dev preview). The file format itself lives in projectFile.ts.

import { useApp } from "../store";
import { isTauri } from "./env";
import { useSettings } from "./settings";
import { buildProjectFile, loadProjectFile, parseProjectFile, ProjectContent } from "./projectFile";
import { STANDARD } from "./standardLibrary";
import { glyphFileName } from "./session";

export type { ProjectFile } from "./projectFile";

export { isTauri } from "./env";

/** Remembers a project file so the next startup reopens it (Tauri only: the browser has no paths). */
const rememberProject = (path: string | null) => {
  // Only when it changes: autosaves would otherwise rewrite settings every few minutes
  if (path && path !== useSettings.getState().lastProjectPath) useSettings.getState().update({ lastProjectPath: path });
};

export function serializeProject(): string {
  return JSON.stringify(buildProjectFile(useApp.getState(), STANDARD), null, 2);
}

/** Parses and upgrades a `.glyph` file's text into project content. Throws if invalid. */
export function readProjectContent(json: string): ProjectContent {
  return loadProjectFile(parseProjectFile(json), STANDARD);
}

/** Loads a project; files from before v1.3 have no name stored, so they're named `fallbackName`. */
export function loadProjectData(json: string, fallbackName: string): void {
  const content = readProjectContent(json);
  useApp.setState({
    ...content,
    projectName: content.projectName ?? fallbackName,
    activeCanvasId: "canvas-root",
    trail: ["canvas-root"],
    viewports: {},
    selection: [],
    selectedWaypoint: null,
    placingDefId: null,
    wireDrag: null,
    boundaryDrawing: false,
    pendingBoundaryRect: null,
    undoStack: [],
  });
}

/** A `.glyph` file picked by the user: its text and where it came from. */
export interface PickedFile {
  text: string;
  /** Full path in Tauri; null in the browser preview. */
  path: string | null;
  /** File name without the `.glyph` extension, e.g. "Snip". */
  name: string;
}

export const baseName = (path: string): string =>
  path.split(/[\\/]/).pop()!.replace(/\.glyph$/i, "");

/** Shows an open dialog for a `.glyph` file. Resolves null if cancelled. */
export async function pickGlyphFile(title: string): Promise<PickedFile | null> {
  if (isTauri()) {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const { readTextFile } = await import("@tauri-apps/plugin-fs");
    const path = await open({
      title,
      multiple: false,
      filters: [{ name: "Glyph Palette Project", extensions: ["glyph"] }],
    });
    if (typeof path !== "string") return null;
    return { text: await readTextFile(path), path, name: baseName(path) };
  }
  // Browser fallback: file input
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".glyph,application/json";
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return resolve(null);
      resolve({ text: await f.text(), path: null, name: baseName(f.name) });
    };
    input.click();
  });
}

/**
 * Saves the project: to its current file, or via a Save dialog when it has
 * none (or `saveAs`). Resolves "cancelled" if the dialog was dismissed;
 * throws if the write fails.
 */
export async function saveProject(saveAs = false): Promise<"saved" | "cancelled"> {
  const json = serializeProject();
  if (isTauri()) {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const { writeTextFile } = await import("@tauri-apps/plugin-fs");
    let path = useApp.getState().filePath;
    if (!path || saveAs) {
      path = await save({
        title: "Save Project",
        // A first save suggests the project's name; it's only a suggestion
        defaultPath: path ?? glyphFileName(useApp.getState().projectName),
        filters: [{ name: "Glyph Palette Project", extensions: ["glyph"] }],
      });
      if (!path) return "cancelled";
    }
    await writeTextFile(path, json);
    useApp.getState().markSaved(path);
    rememberProject(path);
    return "saved";
  }
  // Browser fallback: download
  const blob = new Blob([json], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = glyphFileName(useApp.getState().projectName);
  a.click();
  URL.revokeObjectURL(a.href);
  useApp.getState().markSaved(null);
  return "saved";
}

/** Opens a project chosen in a dialog. Resolves false if cancelled; throws if the file is invalid. */
export async function openProject(): Promise<boolean> {
  const picked = await pickGlyphFile("Open Project");
  if (!picked) return false;
  loadProjectData(picked.text, picked.name);
  useApp.getState().markSaved(picked.path);
  rememberProject(picked.path);
  return true;
}

/** Opens the project at `path` without a dialog (Tauri only). Throws if it can't be read or isn't valid. */
export async function openProjectAt(path: string): Promise<void> {
  const { readTextFile } = await import("@tauri-apps/plugin-fs");
  loadProjectData(await readTextFile(path), baseName(path));
  useApp.getState().markSaved(path);
}

/**
 * Publish: writes `architecture.json` where the user picks — suggested
 * beside the project file — or downloads it in the browser preview.
 * Resolves where it went, or null if the dialog was dismissed.
 */
export async function writeArchitecture(json: string): Promise<string | null> {
  if (isTauri()) {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const { writeTextFile } = await import("@tauri-apps/plugin-fs");
    const project = useApp.getState().filePath;
    const sep = project ? Math.max(project.lastIndexOf("/"), project.lastIndexOf("\\")) : -1;
    const path = await save({
      title: "Publish for Hephaestus",
      defaultPath: (sep >= 0 ? project!.slice(0, sep + 1) : "") + "architecture.json",
      filters: [{ name: "Architecture (JSON)", extensions: ["json"] }],
    });
    if (!path) return null;
    await writeTextFile(path, json);
    return path;
  }
  const blob = new Blob([json], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "architecture.json";
  a.click();
  URL.revokeObjectURL(a.href);
  return "architecture.json (downloaded)";
}

export async function exportPng(dataUrl: string): Promise<boolean> {
  if (isTauri()) {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const { writeFile } = await import("@tauri-apps/plugin-fs");
    const path = await save({
      title: "Export PNG",
      defaultPath: "diagram.png",
      filters: [{ name: "PNG Image", extensions: ["png"] }],
    });
    if (!path) return false;
    const base64 = dataUrl.split(",")[1];
    const bin = atob(base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    await writeFile(path, bytes);
    return true;
  }
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = "diagram.png";
  a.click();
  return true;
}
