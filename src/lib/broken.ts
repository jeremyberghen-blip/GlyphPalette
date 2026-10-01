// Broken links. Deleting or retyping a pip never silently destroys wires:
// a deleted pip is kept on its definition (`removed`) while any wire still
// uses it, and a wire whose end pips no longer match the connection type it
// was drawn with is "broken" — drawn red until the user removes it. Once no
// wire uses a deleted pip, it's dropped; a retyped pip just shows its new type.

import { ApiStyle, CanvasData, NodeDefinition, PipDef, Relationship, Transport } from "../types";
import { compatible, connLabel } from "./connections";

/** The red used for anything broken. Nothing else in GP uses red. */
export const BROKEN_COLOR = "#ef4444";

/** True if this end pip no longer fits the wire (deleted, or retyped to something incompatible). */
export function endBroken(pip: PipDef | null | undefined, rel: Relationship): boolean {
  return !pip || !!pip.removed || !compatible(pip, rel);
}

export function wireBroken(rel: Relationship, fromPip: PipDef | null | undefined, toPip: PipDef | null | undefined) {
  return endBroken(fromPip, rel) || endBroken(toPip, rel);
}

/** Why a pip is broken, for its tooltip; null if it isn't. */
export function brokenReason(
  pip: PipDef,
  wires: Relationship[],
  owner: string,
  transports: Record<string, Transport>,
  styles: Record<string, ApiStyle>
): string | null {
  if (pip.removed) return `Broken link: "${pip.label}" was deleted from ${owner}. Remove its wire to clear it.`;
  const bad = wires.find((r) => !compatible(pip, r));
  if (!bad) return null;
  return `Broken link: "${pip.label}" is now ${connLabel(pip, transports, styles)}, but its wire carries ${connLabel(bad, transports, styles)}. Remove the wire to clear it.`;
}

/** Wires on a canvas attached to one pip of one node. */
export const wiresAt = (canvas: CanvasData, nodeId: string, pipId: string): Relationship[] =>
  canvas.relationships.filter(
    (r) => (r.from.nodeId === nodeId && r.from.pipId === pipId) || (r.to.nodeId === nodeId && r.to.pipId === pipId)
  );

/** True if any wire, on any canvas, is attached to `pipId` on an instance of `defId`. */
export function pipInUse(
  defId: string,
  pipId: string,
  canvases: Record<string, CanvasData>
): boolean {
  return Object.values(canvases).some((c) => {
    const instances = new Set(c.nodes.filter((n) => n.definitionId === defId).map((n) => n.id));
    return c.relationships.some(
      (r) =>
        (instances.has(r.from.nodeId) && r.from.pipId === pipId) ||
        (instances.has(r.to.nodeId) && r.to.pipId === pipId)
    );
  });
}

/**
 * A definition as saved from the node dialog: pips the user deleted come back
 * as `removed` while wires still use them (the dialog never shows them).
 */
export function keepWiredPips(
  before: NodeDefinition | undefined,
  after: NodeDefinition,
  canvases: Record<string, CanvasData>
): NodeDefinition {
  if (!before) return after;
  const kept = new Set(after.pips.map((p) => p.id));
  const ghosts = before.pips
    .filter((p) => !kept.has(p.id) && pipInUse(after.id, p.id, canvases))
    .map((p) => ({ ...p, removed: true }));
  return ghosts.length ? { ...after, pips: [...after.pips, ...ghosts] } : after;
}

/**
 * Drops deleted pips that no wire uses any more. Returns the same object when
 * nothing changed, so callers can keep reference equality.
 */
export function pruneRemovedPips(
  definitions: Record<string, NodeDefinition>,
  canvases: Record<string, CanvasData>
): Record<string, NodeDefinition> {
  let out = definitions;
  for (const d of Object.values(definitions)) {
    if (!d.pips.some((p) => p.removed)) continue;
    const pips = d.pips.filter((p) => !p.removed || pipInUse(d.id, p.id, canvases));
    if (pips.length !== d.pips.length) {
      if (out === definitions) out = { ...definitions };
      out[d.id] = { ...d, pips };
    }
  }
  return out;
}
