// The `.glyph` project file format: building one from project state, and
// parsing/upgrading one back. Pure — no store, no filesystem — so every
// migration can be tested against hand-made old files.
//
// A project owns its library: the file holds the project's own definitions,
// transports, and styles. Standard-library ones are never written; the
// standard library is merged back in on load (see standardLibrary.ts).

import {
  ApiStyle,
  CanvasData,
  Layer,
  NodeDefinition,
  Relationship,
  Transport,
  nextLayer,
} from "../types";
import { repairPocketLayers } from "./layers";
import { sameDefinition, uniqueName } from "./definitions";
import { Library } from "./standardLibrary";
import { LegacyPipType, convertLegacyTypes, legacyConn } from "./legacyTypes";
import { uid } from "./ids";

export interface ProjectFile {
  app: "glyph-palette";
  /** 1: v1.0–v1.1 (flat pip types). 2: v1.2+ (transport + style). */
  version: 2;
  /** The project's name (v1.3+); its folder is named after it. Older files take it from the file name. */
  name?: string;
  /** The project's own transports (standard ones are merged in on load). */
  transports: Record<string, Transport>;
  /** The project's own API styles (standard ones are merged in on load). */
  styles: Record<string, ApiStyle>;
  /** The project's own definitions (standard ones are merged in on load). */
  definitions: Record<string, NodeDefinition>;
  /** Interiors drawn inside standard nodes in this project: definition id → canvas id. */
  standardInteriors?: Record<string, string>;
  customIcons: Record<string, string>;
  canvases: Record<string, CanvasData>;
  /** Set by the parser (never written) when the file was upgraded from version 1. */
  upgradedFromV1?: boolean;
}

/** The project content a file is built from / loaded into. */
export interface ProjectContent {
  /** Absent for files saved before v1.3 (the caller falls back to the file name). */
  projectName?: string;
  transports: Record<string, Transport>;
  styles: Record<string, ApiStyle>;
  /** Standard and project definitions together. */
  definitions: Record<string, NodeDefinition>;
  customIcons: Record<string, string>;
  canvases: Record<string, CanvasData>;
}

const own = <T,>(all: Record<string, T>, standard: Record<string, T>) =>
  Object.fromEntries(Object.entries(all).filter(([id]) => !(id in standard)));

export function buildProjectFile(content: ProjectContent, standard: Library): ProjectFile {
  const definitions: Record<string, NodeDefinition> = {};
  const standardInteriors: Record<string, string> = {};
  for (const [id, d] of Object.entries(content.definitions)) {
    if (!(id in standard.definitions)) definitions[id] = d;
    else if (d.canvasId) standardInteriors[id] = d.canvasId;
  }
  return {
    app: "glyph-palette",
    version: 2,
    ...(content.projectName ? { name: content.projectName } : {}),
    transports: own(content.transports, standard.transports),
    styles: own(content.styles, standard.styles),
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

/** Version 1 files: flat `typeId` on pips and wires → transport + style. */
function upgradeFromV1(data: Record<string, unknown>): void {
  const { map, transports } = convertLegacyTypes(
    (data.pipTypes ?? {}) as Record<string, LegacyPipType>
  );
  delete data.pipTypes;
  data.transports = { ...transports, ...((data.transports as object) ?? {}) };
  data.styles ??= {};
  for (const d of Object.values((data.definitions ?? {}) as Record<string, NodeDefinition>)) {
    d.pips = d.pips.map((p) => {
      const { typeId, ...rest } = p as typeof p & { typeId?: string };
      return { ...rest, ...legacyConn(map, typeId) };
    });
  }
  for (const c of Object.values(data.canvases as Record<string, CanvasData>)) {
    c.relationships = c.relationships.map((r) => {
      const { typeId, ...rest } = r as Relationship & { typeId?: string };
      return { ...rest, ...legacyConn(map, typeId) };
    });
  }
  data.version = 2;
  data.upgradedFromV1 = true;
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
    c.relationships ??= [];
  }
  data.definitions ??= {};
  data.customIcons ??= {};
  for (const d of Object.values(data.definitions)) {
    if (!d.layers || !d.layers.length) d.layers = ["container"] as Layer[];
    d.pips ??= [];
  }
  if ((data.version as number) !== 2) upgradeFromV1(data as unknown as Record<string, unknown>);
  data.transports ??= {};
  data.styles ??= {};
  return data;
}

/**
 * Turns a parsed file into project content: the standard library underneath,
 * the file's own definitions on top.
 *
 * v1.0 files (per-machine library with copy-on-use) stored their own copy of
 * every seed they used, under the seed's id. An unedited copy is dropped in
 * favor of the standard node; an edited one (e.g. Database renamed to Links
 * DB) gets a new id — its instances follow — so the standard node is
 * available alongside it. Files upgraded from version 1 compare pips by
 * transport only: styles didn't exist, so v1.2's more specific standard
 * styles (Cache → Key-value) aren't an edit.
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
  const ownDefs = Object.values(file.definitions);
  const taken = (name: string) =>
    Object.values(definitions).some((d) => d.name.toLowerCase() === name.toLowerCase()) ||
    ownDefs.some((d) => !renamed.has(d.id) && !(d.id in standard.definitions) && d.name.toLowerCase() === name.toLowerCase());

  for (const d of ownDefs) {
    const std = standard.definitions[d.id];
    if (!std) continue;
    if (sameDefinition(d, std, { ignoreStyles: !!file.upgradedFromV1 })) {
      if (d.canvasId) definitions[d.id].canvasId = d.canvasId;
      continue;
    }
    const id = newId();
    renamed.set(d.id, id);
    // v1.0 predates the building facts, so the fork takes the seed's (an edited Cache stays external)
    const facts = { ...(std.external ? { external: true } : {}), ...(std.kind ? { kind: std.kind } : {}) };
    definitions[id] = { ...facts, ...d, id, name: uniqueName(d.name, taken) };
  }
  for (const d of ownDefs) {
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
    ...(typeof file.name === "string" && file.name.trim() ? { projectName: file.name.trim() } : {}),
    transports: { ...file.transports, ...standard.transports },
    styles: { ...file.styles, ...standard.styles },
    definitions,
    customIcons: file.customIcons,
    canvases: file.canvases,
  };
}
