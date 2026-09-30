import { describe, expect, it } from "vitest";
import {
  DEFAULT_HALF,
  HANDLE_OFFSET,
  HANDLE_RING,
  PIP_STUB,
  addWaypoint,
  applyHandle,
  handlePosition,
  insertionIndex,
  sectionEnds,
  traceRounded,
  translateWaypoints,
  waypointsOutside,
  wireVertices,
} from "./waypoints";
import { Waypoint } from "../types";

const wp = (x: number, y: number, angle = 0, half = 0): Waypoint => ({ x, y, angle, half });
const close = (a: number, b: number) => expect(a).toBeCloseTo(b, 6);

describe("adding waypoints", () => {
  const start = { x: 0, y: 0 };
  const end = { x: 300, y: 0 };

  it("inserts into the gap the point sits in, keeping path order", () => {
    const ws = [wp(100, 0), wp(200, 0)];
    expect(insertionIndex(start, end, ws, { x: 50, y: 10 })).toBe(0);
    expect(insertionIndex(start, end, ws, { x: 150, y: 10 })).toBe(1);
    expect(insertionIndex(start, end, ws, { x: 260, y: -10 })).toBe(2);
  });

  it("faces a new waypoint along the wire's direction of travel, ~5px long", () => {
    const [w] = addWaypoint(start, { x: 0, y: 300 }, [], { x: 5, y: 150 });
    close(w.angle, Math.PI / 2); // travelling down
    expect(w.half).toBe(DEFAULT_HALF);
    expect(w.half * 2).toBe(5);
  });

  it("returns a new list, leaving the old one alone", () => {
    const ws = [wp(100, 0)];
    const next = addWaypoint(start, end, ws, { x: 200, y: 0 });
    expect(next).toHaveLength(2);
    expect(ws).toHaveLength(1);
  });
});

describe("section geometry", () => {
  it("pivots on its center: the ends sit `half` either side along the angle", () => {
    const { enter, leave } = sectionEnds(wp(100, 100, 0, 10));
    expect(enter).toEqual({ x: 90, y: 100 });
    expect(leave).toEqual({ x: 110, y: 100 });
  });

  it("routes pip → stub → each section → stub → pip", () => {
    const pts = wireVertices({ x: 0, y: 0 }, "right", { x: 300, y: 100 }, "left", [wp(150, 50, 0, 10)]);
    expect(pts).toEqual([
      { x: 0, y: 0 },
      { x: PIP_STUB, y: 0 },
      { x: 140, y: 50 },
      { x: 160, y: 50 },
      { x: 300 - PIP_STUB, y: 100 },
      { x: 300, y: 100 },
    ]);
  });

  it("collapses a zero-length section to a single corner", () => {
    const pts = wireVertices({ x: 0, y: 0 }, "right", { x: 300, y: 0 }, "left", [wp(150, 80)]);
    expect(pts).toHaveLength(5);
  });

  it("traces straight segments with rounded corners, capped by segment length", () => {
    const calls: string[] = [];
    traceRounded(
      {
        moveTo: (x, y) => calls.push(`M${x},${y}`),
        lineTo: (x, y) => calls.push(`L${x},${y}`),
        arcTo: (_x1, _y1, _x2, _y2, r) => calls.push(`A${r}`),
      },
      [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 10 }, { x: 200, y: 10 }]
    );
    expect(calls).toEqual(["M0,0", "A5", "A5", "L200,10"]);
  });
});

describe("rotation/length handle", () => {
  it("sits just outside the ring, forward and a little off the section's axis", () => {
    const w = wp(0, 0, 0, DEFAULT_HALF);
    const h = handlePosition(w);
    close(Math.hypot(h.x, h.y), HANDLE_RING + DEFAULT_HALF);
    close(Math.atan2(h.y, h.x), -HANDLE_OFFSET); // "2 o'clock" for a left-to-right wire
  });

  it("rotates the section with the handle and scales its length beyond the ring", () => {
    const w = wp(0, 0, 0, 0);
    const turned = applyHandle(w, { x: 0, y: HANDLE_RING + 20 }); // straight down
    close(turned.angle, Math.PI / 2 + HANDLE_OFFSET);
    close(turned.half, 20);
  });

  it("reads the ring (or anything inside it) as length 0", () => {
    expect(applyHandle(wp(0, 0), { x: HANDLE_RING, y: 0 }).half).toBe(0);
    expect(applyHandle(wp(0, 0), { x: 3, y: 0 }).half).toBe(0);
  });

  it("round-trips: applying the handle at its own position changes nothing", () => {
    const w = wp(10, 20, 1.2, 7);
    const again = applyHandle(w, handlePosition(w));
    close(again.angle, w.angle);
    close(again.half, w.half);
  });
});

describe("moving and collapsing", () => {
  it("translates waypoints with their wire", () => {
    expect(translateWaypoints([wp(1, 2)], 10, 20)).toEqual([wp(11, 22)]);
    expect(translateWaypoints(undefined, 1, 1)).toBeUndefined();
  });

  it("keeps only the waypoints outside a collapsing boundary", () => {
    const box = { x: 0, y: 0, width: 100, height: 100 };
    expect(waypointsOutside([wp(50, 50), wp(150, 50)], box)).toEqual([wp(150, 50)]);
  });
});
