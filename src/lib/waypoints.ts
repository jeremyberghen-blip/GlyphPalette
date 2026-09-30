// Wire waypoints (bend points). Pure geometry: routing a wire through them,
// where a new one goes, and the rotation/length handle.
//
// A waypoint is a short straight section pivoting on its center: `angle` is
// its direction, `half` how far it runs either side of the center. The wire
// runs pip → straight stub → each section in order → stub → pip, as straight
// segments with rounded corners (subway-map style).

import { PipDef, Waypoint } from "../types";
import { sideVector } from "./graph";

type Pt = { x: number; y: number };

/** A new waypoint's section length (half of ~5px). */
export const DEFAULT_HALF = 2.5;
/** Radius of the ring the rotation handle can't enter; the ring means length 0. */
export const HANDLE_RING = 14;
/** The handle sits this far (radians) off the section's axis — "2 o'clock" — so it's easy to see and grab. */
export const HANDLE_OFFSET = Math.PI / 6;
/** Straight run leaving each pip before the first corner. */
export const PIP_STUB = 24;
/** Largest corner rounding. */
export const CORNER_RADIUS = 16;

const dist = (a: Pt, b: Pt) => Math.hypot(b.x - a.x, b.y - a.y);
const dirOf = (angle: number): Pt => ({ x: Math.cos(angle), y: Math.sin(angle) });

/** The section's two ends: where the wire enters and leaves it. */
export function sectionEnds(w: Waypoint): { enter: Pt; leave: Pt } {
  const d = dirOf(w.angle);
  return {
    enter: { x: w.x - d.x * w.half, y: w.y - d.y * w.half },
    leave: { x: w.x + d.x * w.half, y: w.y + d.y * w.half },
  };
}

/** Corner points of a wire routed through waypoints (consecutive duplicates removed). */
export function wireVertices(
  p1: Pt,
  side1: PipDef["side"],
  p2: Pt,
  side2: PipDef["side"],
  waypoints: Waypoint[]
): Pt[] {
  const v1 = sideVector(side1);
  const v2 = sideVector(side2);
  const pts: Pt[] = [p1, { x: p1.x + v1.x * PIP_STUB, y: p1.y + v1.y * PIP_STUB }];
  for (const w of waypoints) {
    const { enter, leave } = sectionEnds(w);
    pts.push(enter, leave);
  }
  pts.push({ x: p2.x + v2.x * PIP_STUB, y: p2.y + v2.y * PIP_STUB }, p2);
  return pts.filter((p, i) => i === 0 || dist(p, pts[i - 1]) > 0.01);
}

/** The minimal drawing surface `traceRounded` needs (a canvas 2D context fits). */
export interface PathSink {
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  arcTo(x1: number, y1: number, x2: number, y2: number, r: number): void;
}

/**
 * Rounding radius for the corner at `at`. A rounded corner starts and ends
 * r / tan(θ/2) along each segment (θ = the angle between them), which grows
 * without bound as the wire folds back on itself — so the radius shrinks
 * until the curve fits within half of each segment. A full hairpin gets a
 * sharp point instead of a curve that shoots off into space.
 */
export function cornerRadius(from: Pt, at: Pt, to: Pt): number {
  const lenIn = dist(from, at);
  const lenOut = dist(at, to);
  if (lenIn === 0 || lenOut === 0) return 0;
  const cos =
    ((from.x - at.x) * (to.x - at.x) + (from.y - at.y) * (to.y - at.y)) / (lenIn * lenOut);
  const theta = Math.acos(Math.max(-1, Math.min(1, cos)));
  const fit = (Math.min(lenIn, lenOut) / 2) * Math.tan(theta / 2);
  return Math.max(0, Math.min(CORNER_RADIUS, fit));
}

/** Traces straight segments through `pts` with rounded corners. */
export function traceRounded(ctx: PathSink, pts: Pt[]): void {
  if (!pts.length) return;
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length - 1; i++) {
    const r = cornerRadius(pts[i - 1], pts[i], pts[i + 1]);
    ctx.arcTo(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y, r);
  }
  const last = pts[pts.length - 1];
  ctx.lineTo(last.x, last.y);
}

/**
 * Where a waypoint added at `at` belongs among `waypoints`, for a wire from
 * `start` to `end`: the gap whose detour through `at` is smallest, so adding
 * a point never makes the wire double back through the others.
 */
export function insertionIndex(start: Pt, end: Pt, waypoints: Waypoint[], at: Pt): number {
  const anchors: Pt[] = [start, ...waypoints, end];
  let best = 0;
  let bestCost = Infinity;
  for (let i = 0; i < anchors.length - 1; i++) {
    const cost = dist(anchors[i], at) + dist(at, anchors[i + 1]) - dist(anchors[i], anchors[i + 1]);
    if (cost < bestCost) {
      bestCost = cost;
      best = i;
    }
  }
  return best;
}

/**
 * Adds a waypoint at `at`, facing along the wire's direction of travel there
 * (from the previous anchor toward the next). Returns the new list.
 */
export function addWaypoint(start: Pt, end: Pt, waypoints: Waypoint[], at: Pt): Waypoint[] {
  const i = insertionIndex(start, end, waypoints, at);
  const anchors: Pt[] = [start, ...waypoints, end];
  const prev = anchors[i];
  const next = anchors[i + 1];
  const angle = Math.atan2(next.y - prev.y, next.x - prev.x);
  const w: Waypoint = { x: at.x, y: at.y, angle, half: DEFAULT_HALF };
  return [...waypoints.slice(0, i), w, ...waypoints.slice(i)];
}

/** Where the rotation/length handle is drawn for a waypoint. */
export function handlePosition(w: Waypoint): Pt {
  const d = dirOf(w.angle - HANDLE_OFFSET);
  const r = HANDLE_RING + w.half;
  return { x: w.x + d.x * r, y: w.y + d.y * r };
}

/**
 * The waypoint after dragging its handle to `p`: the angle follows the
 * handle (minus the fixed visual offset), and distance beyond the ring sets
 * the section's half-length. Inside the ring is length 0.
 */
export function applyHandle(w: Waypoint, p: Pt): Waypoint {
  const a = Math.atan2(p.y - w.y, p.x - w.x) + HANDLE_OFFSET;
  const half = Math.max(0, dist(w, p) - HANDLE_RING);
  return { ...w, angle: a, half };
}

export const translateWaypoints = (ws: Waypoint[] | undefined, dx: number, dy: number) =>
  ws?.map((w) => ({ ...w, x: w.x + dx, y: w.y + dy }));

const inRect = (w: Pt, r: { x: number; y: number; width: number; height: number }) =>
  w.x >= r.x && w.x <= r.x + r.width && w.y >= r.y && w.y <= r.y + r.height;

/**
 * A wire crossing a collapsing boundary: its bend points inside the box are
 * folded away under the collapsed node's instance id, and the rest stay.
 */
export function foldWaypoints<T extends { waypoints?: Waypoint[]; foldedWaypoints?: Record<string, Waypoint[]> }>(
  rel: T,
  box: { x: number; y: number; width: number; height: number },
  instanceId: string
): T {
  const inside = rel.waypoints?.filter((w) => inRect(w, box)) ?? [];
  if (!inside.length) return rel;
  const outside = rel.waypoints!.filter((w) => !inRect(w, box));
  return {
    ...rel,
    waypoints: outside.length ? outside : undefined,
    foldedWaypoints: { ...rel.foldedWaypoints, [instanceId]: inside },
  };
}

/**
 * Expanding a collapsed node: puts back the bend points folded under it,
 * shifted by the expansion offset, at the end of the wire that leads inside.
 */
export function unfoldWaypoints<T extends { waypoints?: Waypoint[]; foldedWaypoints?: Record<string, Waypoint[]> }>(
  rel: T,
  instanceId: string,
  insideEnd: "from" | "to",
  dx: number,
  dy: number
): T {
  const folded = rel.foldedWaypoints?.[instanceId];
  if (!folded) return rel;
  const rest = { ...rel.foldedWaypoints };
  delete rest[instanceId];
  const back = translateWaypoints(folded, dx, dy)!;
  const current = rel.waypoints ?? [];
  const waypoints = insideEnd === "from" ? [...back, ...current] : [...current, ...back];
  return {
    ...rel,
    waypoints: waypoints.length ? waypoints : undefined,
    foldedWaypoints: Object.keys(rest).length ? rest : undefined,
  };
}

/** Renames folded-waypoint keys when node instances get new ids (expand, paste). */
export function remapFoldedKeys(
  folded: Record<string, Waypoint[]> | undefined,
  idMap: Map<string, string>
): Record<string, Waypoint[]> | undefined {
  if (!folded) return folded;
  return Object.fromEntries(Object.entries(folded).map(([k, v]) => [idMap.get(k) ?? k, v]));
}
