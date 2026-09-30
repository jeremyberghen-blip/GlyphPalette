// Project save/load and PNG export. Uses native dialogs + fs inside Tauri;
// falls back to browser download / file-input when running in a plain browser
// (dev preview). The file format itself lives in projectFile.ts.

import { useApp } from "../store";
import { buildProjectFile, mergeWithLibrary, parseProjectFile } from "./projectFile";

export type { ProjectFile } from "./projectFile";

export const isTauri = () =>
  typeof (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ !==
  "undefined";

export function serializeProject(): string {
  const s = useApp.getState();
  return JSON.stringify(buildProjectFile(s, s.defaultLibraryIds), null, 2);
}

export function loadProjectData(json: string): void {
  const file = parseProjectFile(json);
  const { content, libraryIds } = mergeWithLibrary(file, useApp.getState().defaultLibrary);
  useApp.setState({
    ...content,
    defaultLibraryIds: libraryIds,
    activeCanvasId: "canvas-root",
    trail: ["canvas-root"],
    viewports: {},
    selection: [],
    placingDefId: null,
    wireDrag: null,
    boundaryDrawing: false,
    pendingBoundaryRect: null,
    undoStack: [],
  });
}

/** Remembered path of the current project (Tauri only). */
let currentPath: string | null = null;
export const getCurrentPath = () => currentPath;

export async function saveProject(forceDialog = false): Promise<boolean> {
  const json = serializeProject();
  if (isTauri()) {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const { writeTextFile } = await import("@tauri-apps/plugin-fs");
    let path = currentPath;
    if (!path || forceDialog) {
      path = await save({
        title: "Save Project",
        defaultPath: "project.glyph",
        filters: [{ name: "Glyph Palette Project", extensions: ["glyph"] }],
      });
      if (!path) return false;
    }
    await writeTextFile(path, json);
    currentPath = path;
    return true;
  }
  // Browser fallback: download
  const blob = new Blob([json], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "project.glyph";
  a.click();
  URL.revokeObjectURL(a.href);
  return true;
}

export async function openProject(): Promise<boolean> {
  if (isTauri()) {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const { readTextFile } = await import("@tauri-apps/plugin-fs");
    const path = await open({
      title: "Open Project",
      multiple: false,
      filters: [{ name: "Glyph Palette Project", extensions: ["glyph"] }],
    });
    if (typeof path !== "string") return false;
    loadProjectData(await readTextFile(path));
    currentPath = path;
    return true;
  }
  // Browser fallback: file input
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".glyph,application/json";
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return resolve(false);
      loadProjectData(await f.text());
      resolve(true);
    };
    input.click();
  });
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
