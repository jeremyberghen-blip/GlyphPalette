// Pure helpers for node definitions: naming, comparison, and copying.

import { NodeDefinition } from "../types";

/** Case-insensitive "is this name used by any definition?" check, excluding one id. */
export function nameTaken(
  defs: Record<string, NodeDefinition>,
  name: string,
  excludeId?: string
): boolean {
  const lower = name.trim().toLowerCase();
  return Object.values(defs).some((d) => d.id !== excludeId && d.name.toLowerCase() === lower);
}

/**
 * The next numbered name: a space then a number. `Service` → `Service 2`; a
 * name already ending in ` N` counts up from N (`Worker 2` → `Worker 3`).
 * Skips any name `taken` reports as used.
 */
export function incrementName(name: string, taken: (candidate: string) => boolean): string {
  const trimmed = name.trim();
  const m = /^(.*\S) (\d+)$/.exec(trimmed);
  const base = m ? m[1] : trimmed;
  let n = m ? parseInt(m[2], 10) + 1 : 2;
  while (taken(`${base} ${n}`)) n++;
  return `${base} ${n}`;
}

/** `name` itself if free, otherwise the next numbered name. */
export function uniqueName(name: string, taken: (candidate: string) => boolean): string {
  return taken(name.trim()) ? incrementName(name, taken) : name.trim();
}

/**
 * Same node, as far as a user would care: name, icon, layers, and pip
 * structure match. Pip labels are ignored so relabeling a standard pip
 * doesn't orphan older files' unedited copies of it; `ignoreStyles` compares
 * pips by transport only (for files from before styles existed).
 */
export function sameDefinition(
  a: NodeDefinition,
  b: NodeDefinition,
  opts: { ignoreStyles?: boolean } = {}
): boolean {
  const pipKey = (d: NodeDefinition) =>
    d.pips
      .map((p) => `${p.id}|${p.transportId}|${opts.ignoreStyles ? "" : p.styleId}|${p.direction}|${p.side}`)
      .join(",");
  return (
    a.name === b.name &&
    a.icon === b.icon &&
    [...a.layers].sort().join() === [...b.layers].sort().join() &&
    pipKey(a) === pipKey(b)
  );
}

/**
 * An independent copy of a definition under a new id and name. It starts with
 * an empty interior and none of a collapsed boundary's pocket metadata. It
 * keeps external / kind / language, but not a typed slug — the copy's slug
 * follows its own name, so two copies don't claim the same file.
 */
export function copyDefinition(def: NodeDefinition, id: string, name: string): NodeDefinition {
  return {
    id,
    name,
    icon: def.icon,
    layers: [...def.layers],
    pips: def.pips.filter((p) => !p.removed).map((p) => ({ ...p })),
    canvasId: null,
    ...(def.external ? { external: true } : {}),
    ...(def.kind ? { kind: def.kind } : {}),
    ...(def.language ? { language: def.language } : {}),
  };
}

/** Pips a definition really has: not counting deleted ones kept only for their wires. */
export const livePips = (d: NodeDefinition): number => d.pips.filter((p) => !p.removed).length;
