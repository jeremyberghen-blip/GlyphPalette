// The `.glyph` project file format: building one from project state, and
// parsing/upgrading one back. Pure — no store, no filesystem — so every
// migration can be tested against hand-made old files.
//
// A project owns its library: the file holds the project's own definitions.
// Standard-library definitions are never written; the standard library is
// merged back in on load (see standardLibrary.ts).

import { CanvasData, Layer, NodeDefinition, PipType, nextLayer } from "../types";
import { repairPocketLayers } from "./layers";
import { sameDefinition, uniqueName } from "./definitions";
import { Library } from "./standardLibrary";
import { uid } from "./ids";

export interface ProjectFile {
  app: "glyph-palette";
  version: 1;
  /** The project's own pip types (standard ones are merged in on load). */
  pipTypes: Record<string, PipType>;
  /** The project's own definitions (standard ones are merged in on load). */
  definitions: Record<string, NodeDefinition>;
  /** Interiors drawn inside standard nodes in this project: definition id → canvas id. */
  standardInteriors?: Record<string, string>;
  customIcons: Record<string, string>;
  canvases: Record<string, CanvasData>;
}

/** The project content a file is built from / loaded into. */
export interface ProjectContent {
  pipTypes: Record<string, PipType>;
  /** Standard and project definitions together. */
  definitions: Record<string, NodeDefinition>;
  customIcons: Record<string, string>;
  canvases: Record<string, CanvasData>;
}

export function buildProjectFile(content: ProjectContent, standard: Library): ProjectFile {
  const definitions: Record<string, NodeDefinition> = {};
  const standardInteriors: Record<string, string> = {};
  for (const [id, d] of Object.entries(content.definitions)) {
    if (!(id in standard.definitions)) definitions[id] = d;
    else if (d.canvasId) standardInteriors[id] = d.canvasId;
  }
  return {
    app: "glyph-palette",
    version: 1,
    pipTypes: Object.fromEntries(
      Object.entries(content.pipTypes).filter(([id]) => !(id in standard.pipTypes))
    ),
    definitions,
    ...(Object.keys(standardInteriors).length ? { standardInteriors } : {}),
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
 * Turns a parsed file into project content: the standard library underneath,
 * the file's own definitions on top.
 *
 * Older files (per-machine library with copy-on-use) stored their own copy of
 * every seed they used, under the seed's id. An unedited copy is dropped in
 * favor of the standard node; an edited one (e.g. Database renamed to Links
 * DB) gets a new id — its instances follow — so the standard node is
 * available alongside it.
 */
export function loadProjectFile(
  file: ProjectFile,
  standard: Library,
  newId: () => string = () => `def-${uid()}`
): ProjectContent {
  const definitions: Record<string, NodeDefinition> = structuredClone(standard.definitions);
  for (const [id, canvasId] of Object.entries(file.standardInteriors ?? {})) {
    if (definitions[id]) definitions[id].canvasId = canvasId;
  }

  const renamed = new Map<string, string>(); // old id → new id
  const own = Object.values(file.definitions);
  const taken = (name: string) =>
    Object.values(definitions).some((d) => d.name.toLowerCase() === name.toLowerCase()) ||
    own.some((d) => !renamed.has(d.id) && !(d.id in standard.definitions) && d.name.toLowerCase() === name.toLowerCase());

  for (const d of own) {
    const std = standard.definitions[d.id];
    if (!std) continue;
    if (sameDefinition(d, std)) {
      if (d.canvasId) definitions[d.id].canvasId = d.canvasId;
      continue;
    }
    const id = newId();
    renamed.set(d.id, id);
    definitions[id] = { ...d, id, name: uniqueName(d.name, taken) };
  }
  for (const d of own) {
    if (!(d.id in standard.definitions)) definitions[d.id] = d;
  }

  if (renamed.size) {
    for (const c of Object.values(file.canvases)) {
      for (const n of c.nodes) {
        const to = renamed.get(n.definitionId);
        if (to) n.definitionId = to;
      }
    }
  }

  backfillLayers(file.canvases, definitions);
  repairPocketLayers(file.canvases, definitions);
  return {
    pipTypes: { ...file.pipTypes, ...standard.pipTypes },
    definitions,
    customIcons: file.customIcons,
    canvases: file.canvases,
  };
}
