// Canvas ↔ layer relationships.
//
// A canvas is either the root, a node's *interior* (one layer deeper than
// the canvas the node sits on), or a *pocket* — the inside of a collapsed
// boundary, which is only a fold and stays at its parent's layer.

import { CanvasData, Layer, NodeDefinition, nextLayer } from "../types";

type Defs = Record<string, NodeDefinition>;

/** The definition whose inner canvas this is, if any. */
export function canvasOwner(defs: Defs, canvasId: string): NodeDefinition | undefined {
  return Object.values(defs).find((d) => d.canvasId === canvasId);
}

/** True for the inside of a collapsed boundary. */
export function isPocket(defs: Defs, canvasId: string): boolean {
  return !!canvasOwner(defs, canvasId)?.expandable;
}

/** Layer for a new canvas opened from a node of `def` sitting on a `parent`-layer canvas. */
export function childLayer(parent: Layer, def: Pick<NodeDefinition, "expandable">): Layer {
  return def.expandable ? parent : nextLayer(parent);
}

/**
 * Repairs pocket layers. Collapsing a boundary used to give its pocket the
 * next layer down; a pocket keeps its parent's layer. Canvases beneath a
 * repaired one are re-derived from it; everything else (including legacy
 * Code canvases) is left alone. Mutates `canvases`; returns the ids changed.
 */
export function repairPocketLayers(canvases: Record<string, CanvasData>, defs: Defs): string[] {
  const changed: string[] = [];
  const visit = (canvasId: string, parentChanged: boolean, seen: Set<string>) => {
    if (seen.has(canvasId)) return;
    seen.add(canvasId);
    const canvas = canvases[canvasId];
    if (!canvas) return;
    for (const n of canvas.nodes) {
      const def = defs[n.definitionId];
      const child = def?.canvasId ? canvases[def.canvasId] : undefined;
      if (!def || !child) continue;
      const expected = childLayer(canvas.layer, def);
      const fix = def.expandable || parentChanged;
      const differs = fix && child.layer !== expected;
      if (differs) {
        child.layer = expected;
        changed.push(child.id);
      }
      visit(child.id, differs, seen);
    }
  };
  visit("canvas-root", false, new Set());
  return changed;
}
