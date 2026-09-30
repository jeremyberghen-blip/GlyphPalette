// The `.glyph` project file format: building one from project state, and
// parsing/upgrading one back. Pure — no store, no filesystem — so every
// migration can be tested against hand-made old files.

import { CanvasData, Layer, NodeDefinition, PipType, nextLayer } from "../types";
import { repairPocketLayers } from "./layers";

export interface ProjectFile {
  app: "glyph-palette";
  version: 1;
  pipTypes: Record<string, PipType>;
  /** Only project-owned definitions; library ones are merged in on load. */
  definitions: Record<string, NodeDefinition>;
  customIcons: Record<string, string>;
  canvases: Record<string, CanvasData>;
}

/** The project content a file is built from / loaded into. */
export interface ProjectContent {
  pipTypes: Record<string, PipType>;
  definitions: Record<string, NodeDefinition>;
  customIcons: Record<string, string>;
  canvases: Record<string, CanvasData>;
}

export function buildProjectFile(
  content: ProjectContent,
  /** Definition ids that belong to a library, not the project — left out. */
  libraryIds: Record<string, true>
): ProjectFile {
  return {
    app: "glyph-palette",
    version: 1,
    pipTypes: content.pipTypes,
    definitions: Object.fromEntries(
      Object.entries(content.definitions).filter(([id]) => !libraryIds[id])
    ),
    customIcons: content.customIcons,
    canvases: content.canvases,
  };
}

/** Assigns a `layer` to any canvas missing one, by walking down from the root. */
export function backfillLayers(
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

/**
 * Parses a `.glyph` file and upgrades anything older formats left out.
 * Throws on a file that isn't a Glyph Palette project.
 */
export function parseProjectFile(json: string): ProjectFile {
  const data = JSON.parse(json) as ProjectFile;
  if (data?.app !== "glyph-palette" || !data.canvases?.["canvas-root"]) {
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
  data.definitions ??= {};
  data.pipTypes ??= {};
  data.customIcons ??= {};
  for (const d of Object.values(data.definitions)) {
    if (!d.layers || !d.layers.length) d.layers = ["container"] as Layer[];
  }
  return data;
}

/**
 * Merges library definitions under a parsed file's own, returning the project
 * content plus which ids came from the library (and are not the file's).
 */
export function mergeWithLibrary(
  file: ProjectFile,
  lib: { pipTypes: Record<string, PipType>; definitions: Record<string, NodeDefinition> }
): { content: ProjectContent; libraryIds: Record<string, true> } {
  const definitions: Record<string, NodeDefinition> = {};
  for (const [id, d] of Object.entries(lib.definitions)) definitions[id] = structuredClone(d);
  for (const [id, d] of Object.entries(file.definitions)) definitions[id] = d;
  const libraryIds = Object.fromEntries(
    Object.keys(lib.definitions)
      .filter((id) => !(id in file.definitions))
      .map((id) => [id, true as const])
  );
  backfillLayers(file.canvases, definitions);
  repairPocketLayers(file.canvases, definitions);
  return {
    content: {
      pipTypes: { ...lib.pipTypes, ...file.pipTypes },
      definitions,
      customIcons: file.customIcons,
      canvases: file.canvases,
    },
    libraryIds,
  };
}
