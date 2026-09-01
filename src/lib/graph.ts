// Geometry + validation helpers for pips and relationships.

import {
  NodeDefinition,
  NodeInstance,
  PipDef,
  NODE_WIDTH,
  NODE_HEIGHT,
} from "../types";

export const PIP_RADIUS = 6;

export interface PipPlacement {
  x: number; // offset within the node
  y: number;
  side: PipDef["side"];
}

/** Distributes each side's pips evenly along that border edge. */
export function pipOffsets(def: NodeDefinition): Map<string, PipPlacement> {
  const map = new Map<string, PipPlacement>();
  const bySide: Record<PipDef["side"], PipDef[]> = {
    left: [],
    right: [],
    top: [],
    bottom: [],
  };
  for (const p of def.pips) bySide[p.side].push(p);
  (Object.keys(bySide) as PipDef["side"][]).forEach((side) => {
    bySide[side].forEach((p, i) => {
      const t = (i + 1) / (bySide[side].length + 1);
      let x = 0;
      let y = 0;
      if (side === "left") {
        x = 0;
        y = t * NODE_HEIGHT;
      } else if (side === "right") {
        x = NODE_WIDTH;
        y = t * NODE_HEIGHT;
      } else if (side === "top") {
        x = t * NODE_WIDTH;
        y = 0;
      } else {
        x = t * NODE_WIDTH;
        y = NODE_HEIGHT;
      }
      map.set(p.id, { x, y, side });
    });
  });
  return map;
}

export function pipWorldPos(
  node: NodeInstance,
  def: NodeDefinition,
  pipId: string
): PipPlacement | null {
  const off = pipOffsets(def).get(pipId);
  if (!off) return null;
  return { x: node.x + off.x, y: node.y + off.y, side: off.side };
}

/** Outward unit vector for a pip side. */
export function sideVector(side: PipDef["side"]): { x: number; y: number } {
  switch (side) {
    case "left":
      return { x: -1, y: 0 };
    case "right":
      return { x: 1, y: 0 };
    case "top":
      return { x: 0, y: -1 };
    case "bottom":
      return { x: 0, y: 1 };
  }
}

/**
 * Connection validity: types must match exactly, and directions must pair
 * outbound→inbound, bidirectional↔bidirectional, or none↔none.
 */
export function canConnect(a: PipDef, b: PipDef): boolean {
  if (a.typeId !== b.typeId) return false;
  const pair = (x: PipDef["direction"], y: PipDef["direction"]) =>
    (a.direction === x && b.direction === y) ||
    (a.direction === y && b.direction === x);
  return (
    pair("outbound", "inbound") ||
    (a.direction === "bidirectional" && b.direction === "bidirectional") ||
    (a.direction === "none" && b.direction === "none")
  );
}

export interface WireGeometry {
  x1: number;
  y1: number;
  c1x: number;
  c1y: number;
  c2x: number;
  c2y: number;
  x2: number;
  y2: number;
}

/** Cubic bezier leaving each pip along its side's outward normal. */
export function wireGeometry(
  p1: { x: number; y: number },
  side1: PipDef["side"],
  p2: { x: number; y: number },
  side2: PipDef["side"] | null
): WireGeometry {
  const v1 = sideVector(side1);
  const v2 = side2 ? sideVector(side2) : { x: -v1.x, y: -v1.y };
  const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
  const ext = Math.min(160, Math.max(40, dist * 0.45));
  return {
    x1: p1.x,
    y1: p1.y,
    c1x: p1.x + v1.x * ext,
    c1y: p1.y + v1.y * ext,
    c2x: p2.x + v2.x * ext,
    c2y: p2.y + v2.y * ext,
    x2: p2.x,
    y2: p2.y,
  };
}
