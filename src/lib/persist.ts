// Project save/load and PNG export. Uses native dialogs + fs inside Tauri;
// falls back to browser download / file-input when running in a plain browser
// (dev preview).

import { CanvasData, Layer, NodeDefinition, PipType, nextLayer } from "../types";
import { useApp } from "../store";

export interface ProjectFile {
  app: "glyph-palette";
  version: 1;
  pipTypes: Record<string, PipType>;
  /** Only project-owned definitions; default-library ones are merged in on load. */
  definitions: Record<string, NodeDefinition>;
  customIcons: Record<string, string>;
  canvases: Record<string, CanvasData>;
}

export const isTauri = () =>
  typeof (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ !==
  "undefined";

export function serializeProject(): string {
  const s = useApp.getState();
  const definitions = Object.fromEntries(
    Object.entries(s.definitions).filter(([id]) => !s.defaultLibraryIds[id])
  );
  const file: ProjectFile = {
    app: "glyph-palette",
    version: 1,
    pipTypes: s.pipTypes,
    definitions,
    customIcons: s.customIcons,
    canvases: s.canvases,
  };
  return JSON.stringify(file, null, 2);
}

/** Assigns a `layer` to any canvas missing one, by walking down from the root. */
function backfillLayers(
  canvases: Record<string, CanvasData>,
  definitions: Record<string, NodeDefinition>
): void {
  const root = canvases["canvas-root"];
  if (root && !root.layer) root.layer = "context";
  const queue: string[] = ["canvas-root"];
  const seen = new Set<string>();
  while (queue.length) {
    const cid = queue.shift()!;
    if (seen.has(cid)) continue;
    seen.add(cid);
    const canvas = canvases[cid];
    if (!canvas) continue;
    for (const n of canvas.nodes) {
      const childId = definitions[n.definitionId]?.canvasId;
      if (childId && canvases[childId]) {
        if (!canvases[childId].layer) canvases[childId].layer = nextLayer(canvas.layer);
        queue.push(childId);
      }
    }
  }
  // Anything unreachable from the root: default to "container".
  for (const c of Object.values(canvases)) if (!c.layer) c.layer = "container";
}

export function loadProjectData(json: string): void {
  const data = JSON.parse(json) as ProjectFile;
  if (data.app !== "glyph-palette" || !data.canvases?.["canvas-root"]) {
    throw new Error("Not a valid Glyph Palette project file.");
  }
  // Migration: `containers` was renamed to `boundaries`.
  for (const c of Object.values(data.canvases) as (CanvasData & { containers?: unknown[] })[]) {
    if (Array.isArray(c.containers) && !Array.isArray(c.boundaries)) {
      c.boundaries = c.containers as CanvasData["boundaries"];
    }
    delete c.containers;
    c.boundaries ??= [];
  }

  const lib = useApp.getState().defaultLibrary;
  const fileDefs = data.definitions ?? {};

  // Merge default-library templates under the project's own definitions.
  const definitions: Record<string, NodeDefinition> = {};
  for (const [id, d] of Object.entries(lib.definitions)) definitions[id] = structuredClone(d);
  for (const [id, d] of Object.entries(fileDefs)) definitions[id] = d;
  for (const d of Object.values(definitions)) {
    if (!d.layers || !d.layers.length) d.layers = ["container"] as Layer[];
  }
  const defaultLibraryIds = Object.fromEntries(
    Object.keys(lib.definitions)
      .filter((id) => !(id in fileDefs))
      .map((id) => [id, true as const])
  );

  backfillLayers(data.canvases, definitions);

  useApp.setState({
    pipTypes: { ...lib.pipTypes, ...(data.pipTypes ?? {}) },
    definitions,
    defaultLibraryIds,
    customIcons: data.customIcons ?? {},
    canvases: data.canvases,
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
