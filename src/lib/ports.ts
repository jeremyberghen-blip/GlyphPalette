// Port nodes: Inbound and Outbound stand for "the edge of the node we're
// inside". They're placed from the palette on any inner canvas (never the top
// level), at most one of each, and carry the pips of the node whose interior
// this is — flipped, so an inbound pip on the parent is an outbound pip on the
// Inbound port, ready to wire to whatever handles it inside. They aren't
// stored definitions: their pips are worked out from the parent every time,
// so editing the parent's pips updates them. See DECISIONS.md.

import { CanvasData, LAYERS, NodeDefinition, PipDef, PipDirection, Relationship } from "../types";
import { canvasOwner } from "./layers";
import { wireType } from "./connections";

export const PORT_IN = "@port-in";
export const PORT_OUT = "@port-out";
export type PortKind = typeof PORT_IN | typeof PORT_OUT;

export const isPortDefId = (id: string): id is PortKind => id === PORT_IN || id === PORT_OUT;

const FLIP: Record<PipDirection, PipDirection> = {
  inbound: "outbound",
  outbound: "inbound",
  bidirectional: "bidirectional",
  none: "none",
};

/**
 * The parent's pips as they appear on a port: Inbound gets the parent's
 * inbound pips, Outbound its outbound ones, and both get bidirectional and
 * non-directional pips. Same ids as on the parent, so wires survive edits.
 */
export function portPips(parent: NodeDefinition, kind: PortKind): PipDef[] {
  const wanted: PipDirection = kind === PORT_IN ? "inbound" : "outbound";
  return parent.pips
    .filter((p) => p.direction === wanted || p.direction === "bidirectional" || p.direction === "none")
    .map((p) => ({ ...p, direction: FLIP[p.direction], side: kind === PORT_IN ? "right" : "left" }));
}

/** A port node's (virtual) definition inside `parent`. */
export function portDefinition(parent: NodeDefinition, kind: PortKind): NodeDefinition {
  return {
    id: kind,
    name: kind === PORT_IN ? "Inbound" : "Outbound",
    icon: kind === PORT_IN ? "LogIn" : "LogOut",
    layers: [...LAYERS],
    pips: portPips(parent, kind),
    canvasId: null,
    portOf: parent.name,
  };
}

/**
 * The definition a node on `canvasId` uses: a stored one, or, for a port
 * node, the port built from the node whose interior the canvas is.
 */
export function resolveDef(
  definitions: Record<string, NodeDefinition>,
  canvasId: string,
  defId: string
): NodeDefinition | undefined {
  if (!isPortDefId(defId)) return definitions[defId];
  const owner = canvasOwner(definitions, canvasId);
  return owner ? portDefinition(owner, defId) : undefined;
}

/** Ports already placed on a canvas (palette cards for these are disabled). */
export const portsOn = (canvas: CanvasData): Set<PortKind> =>
  new Set(canvas.nodes.map((n) => n.definitionId).filter(isPortDefId));

/** Whether a port of this kind may be placed here: an inner canvas, not already holding one. */
export function canPlacePort(
  definitions: Record<string, NodeDefinition>,
  canvas: CanvasData,
  kind: PortKind
): boolean {
  return !!canvasOwner(definitions, canvas.id) && !portsOn(canvas).has(kind);
}

/**
 * Inside a pocket (a collapsed boundary), the collapse recorded which inner
 * node/pip each crossing wire attached to (`pipMap`). With port nodes placed,
 * those connections are drawn automatically — locked, never stored. Returns
 * them as wires, normalized outbound → inbound like any other.
 */
export function lockedPortWires(
  owner: NodeDefinition,
  canvas: CanvasData,
  pipOf: (nodeId: string, pipId: string) => PipDef | undefined
): Relationship[] {
  if (!owner.expandable || !owner.pipMap) return [];
  const wires: Relationship[] = [];
  for (const port of canvas.nodes.filter((n) => isPortDefId(n.definitionId))) {
    for (const pip of portPips(owner, port.definitionId as PortKind)) {
      const target = owner.pipMap[pip.id];
      const inner = target && pipOf(target.nodeId, target.pipId);
      if (!inner || !canvas.nodes.some((n) => n.id === target.nodeId)) continue;
      const portEnd = { nodeId: port.id, pipId: pip.id };
      const innerEnd = { nodeId: target.nodeId, pipId: target.pipId };
      const portSends = pip.direction !== "inbound";
      wires.push({
        id: `locked-${port.id}-${pip.id}`,
        ...wireType(pip, inner),
        from: portSends ? portEnd : innerEnd,
        to: portSends ? innerEnd : portEnd,
      });
    }
  }
  return wires;
}
