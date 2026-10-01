import { describe, expect, it } from "vitest";
import { PORT_IN, PORT_OUT, canPlacePort, lockedPortWires, portDefinition, portPips, resolveDef } from "./ports";
import { CanvasData, NodeDefinition, PipDef, PipDirection } from "../types";

const pip = (id: string, direction: PipDirection, extra: Partial<PipDef> = {}): PipDef => ({
  id, label: id, transportId: "tr-http", styleId: "s-rest", direction, side: "left", ...extra,
});
const snipApi: NodeDefinition = {
  id: "def-snip-api",
  name: "Snip API",
  icon: "Server",
  layers: ["container"],
  canvasId: "inner",
  pips: [pip("api", "inbound"), pip("db", "outbound", { transportId: "tr-tcp", styleId: "s-sql" }), pip("events", "bidirectional")],
};
const canvas = (nodes: CanvasData["nodes"] = []): CanvasData => ({ id: "inner", layer: "component", nodes, relationships: [], boundaries: [] });

describe("portPips", () => {
  it("gives Inbound the parent's inbound pips, flipped to send inward, on its right side", () => {
    const pips = portPips(snipApi, PORT_IN);
    expect(pips.map((p) => [p.id, p.direction, p.side])).toEqual([
      ["api", "outbound", "right"],
      ["events", "bidirectional", "right"],
    ]);
  });

  it("gives Outbound the parent's outbound pips, flipped to receive, on its left side", () => {
    const pips = portPips(snipApi, PORT_OUT);
    expect(pips.map((p) => [p.id, p.direction, p.side])).toEqual([
      ["db", "inbound", "left"],
      ["events", "bidirectional", "left"],
    ]);
  });

  it("keeps the parent's pip ids, types, and deleted-but-wired state", () => {
    const [db] = portPips({ ...snipApi, pips: [pip("db", "outbound", { styleId: "s-sql", removed: true })] }, PORT_OUT);
    expect(db).toMatchObject({ id: "db", styleId: "s-sql", removed: true });
  });
});

describe("resolving port nodes", () => {
  const defs = { [snipApi.id]: snipApi };

  it("builds the port from the node whose interior the canvas is", () => {
    const d = resolveDef(defs, "inner", PORT_IN)!;
    expect(d.name).toBe("Inbound");
    expect(d.portOf).toBe("Snip API");
    expect(portDefinition(snipApi, PORT_OUT).name).toBe("Outbound");
  });

  it("has nothing to resolve to on the top-level canvas", () => {
    expect(resolveDef(defs, "canvas-root", PORT_IN)).toBeUndefined();
  });

  it("allows one of each, only on an inner canvas", () => {
    expect(canPlacePort(defs, canvas(), PORT_IN)).toBe(true);
    expect(canPlacePort(defs, canvas([{ id: "p", definitionId: PORT_IN, x: 0, y: 0 }]), PORT_IN)).toBe(false);
    expect(canPlacePort(defs, canvas([{ id: "p", definitionId: PORT_IN, x: 0, y: 0 }]), PORT_OUT)).toBe(true);
    expect(canPlacePort(defs, { ...canvas(), id: "canvas-root" }, PORT_IN)).toBe(false);
  });
});

describe("lockedPortWires (pockets)", () => {
  const pocket: NodeDefinition = {
    id: "def-analytics", name: "Analytics", icon: "Box", layers: ["container"], canvasId: "inner", expandable: true,
    pips: [pip("in1", "inbound", { transportId: "tr-queue", styleId: "s-any" }), pip("out1", "outbound", { transportId: "tr-tcp", styleId: "s-sql" })],
    pipMap: { in1: { nodeId: "queue", pipId: "publish" }, out1: { nodeId: "worker", pipId: "db" } },
  };
  const innerPips: Record<string, PipDef> = {
    "queue|publish": pip("publish", "inbound", { transportId: "tr-queue", styleId: "s-any" }),
    "worker|db": pip("db", "outbound", { transportId: "tr-tcp", styleId: "s-sql" }),
  };
  const pipOf = (n: string, p: string) => innerPips[`${n}|${p}`];
  const nodes = [
    { id: "queue", definitionId: "q", x: 0, y: 0 },
    { id: "worker", definitionId: "w", x: 0, y: 0 },
  ];

  it("draws nothing until a port is placed", () => {
    expect(lockedPortWires(pocket, canvas(nodes), pipOf)).toEqual([]);
  });

  it("connects each port pip to the inner pip the collapse recorded, outbound → inbound", () => {
    const wires = lockedPortWires(
      pocket,
      canvas([...nodes, { id: "pin", definitionId: PORT_IN, x: 0, y: 0 }, { id: "pout", definitionId: PORT_OUT, x: 0, y: 0 }]),
      pipOf
    );
    expect(wires.map((w) => [`${w.from.nodeId}.${w.from.pipId}`, `${w.to.nodeId}.${w.to.pipId}`, w.transportId])).toEqual([
      ["pin.in1", "queue.publish", "tr-queue"],
      ["worker.db", "pout.out1", "tr-tcp"],
    ]);
  });

  it("only applies to pockets", () => {
    expect(lockedPortWires({ ...pocket, expandable: false }, canvas([...nodes, { id: "pin", definitionId: PORT_IN, x: 0, y: 0 }]), pipOf)).toEqual([]);
  });
});
