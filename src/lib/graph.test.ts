import { describe, expect, it } from "vitest";
import { canConnect, pipOffsets, pipWorldPos, sideVector, wireGeometry } from "./graph";
import { NodeDefinition, PipDef, PipDirection, NODE_WIDTH, NODE_HEIGHT } from "../types";

const pip = (direction: PipDirection, typeId = "t-http"): PipDef => ({
  id: `p-${direction}`,
  label: direction,
  typeId,
  direction,
  side: "left",
});

describe("canConnect", () => {
  it("pairs outbound with inbound, in either order", () => {
    expect(canConnect(pip("outbound"), pip("inbound"))).toBe(true);
    expect(canConnect(pip("inbound"), pip("outbound"))).toBe(true);
  });

  it("pairs bidirectional with bidirectional and none with none", () => {
    expect(canConnect(pip("bidirectional"), pip("bidirectional"))).toBe(true);
    expect(canConnect(pip("none"), pip("none"))).toBe(true);
  });

  it("rejects same-direction and mixed pairs", () => {
    expect(canConnect(pip("outbound"), pip("outbound"))).toBe(false);
    expect(canConnect(pip("inbound"), pip("inbound"))).toBe(false);
    expect(canConnect(pip("outbound"), pip("bidirectional"))).toBe(false);
    expect(canConnect(pip("inbound"), pip("none"))).toBe(false);
    expect(canConnect(pip("bidirectional"), pip("none"))).toBe(false);
  });

  it("rejects mismatched types even when directions pair", () => {
    expect(canConnect(pip("outbound", "t-http"), pip("inbound", "t-rest"))).toBe(false);
  });
});

describe("pip placement", () => {
  const def: NodeDefinition = {
    id: "d",
    name: "D",
    icon: "Box",
    layers: ["container"],
    canvasId: null,
    pips: [
      { id: "l1", label: "", typeId: "t", direction: "inbound", side: "left" },
      { id: "l2", label: "", typeId: "t", direction: "inbound", side: "left" },
      { id: "r1", label: "", typeId: "t", direction: "outbound", side: "right" },
      { id: "t1", label: "", typeId: "t", direction: "none", side: "top" },
    ],
  };

  it("spreads pips evenly along their side", () => {
    const off = pipOffsets(def);
    expect(off.get("l1")).toEqual({ x: 0, y: NODE_HEIGHT / 3, side: "left" });
    expect(off.get("l2")).toEqual({ x: 0, y: (2 * NODE_HEIGHT) / 3, side: "left" });
    expect(off.get("r1")).toEqual({ x: NODE_WIDTH, y: NODE_HEIGHT / 2, side: "right" });
    expect(off.get("t1")).toEqual({ x: NODE_WIDTH / 2, y: 0, side: "top" });
  });

  it("offsets by the node's position in world space", () => {
    const node = { id: "n", definitionId: "d", x: 100, y: 50 };
    expect(pipWorldPos(node, def, "r1")).toEqual({
      x: 100 + NODE_WIDTH,
      y: 50 + NODE_HEIGHT / 2,
      side: "right",
    });
    expect(pipWorldPos(node, def, "missing")).toBeNull();
  });
});

describe("wireGeometry", () => {
  it("leaves each pip along its outward normal", () => {
    const g = wireGeometry({ x: 0, y: 0 }, "right", { x: 200, y: 0 }, "left");
    expect(g.c1x).toBeGreaterThan(0);
    expect(g.c1y).toBe(0);
    expect(g.c2x).toBeLessThan(200);
    expect(sideVector("top")).toEqual({ x: 0, y: -1 });
  });
});
