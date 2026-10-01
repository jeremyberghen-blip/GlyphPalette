import { describe, expect, it } from "vitest";
import { brokenReason, endBroken, keepWiredPips, pipInUse, pruneRemovedPips, wireBroken } from "./broken";
import { CanvasData, NodeDefinition, PipDef, Relationship } from "../types";
import { STANDARD } from "./standardLibrary";

const pip = (id: string, transportId = "tr-http", styleId = "s-rest", extra: Partial<PipDef> = {}): PipDef => ({
  id, label: id.toUpperCase(), transportId, styleId, direction: "outbound", side: "right", ...extra,
});
const rel = (fromPip: string, transportId = "tr-http", styleId = "s-rest"): Relationship => ({
  id: "r", transportId, styleId, from: { nodeId: "n1", pipId: fromPip }, to: { nodeId: "n2", pipId: "in" },
});
const def = (pips: PipDef[]): NodeDefinition => ({ id: "d", name: "Snip API", icon: "Box", layers: ["container"], pips, canvasId: null });
const canvas = (rels: Relationship[]): Record<string, CanvasData> => ({
  c: { id: "c", layer: "container", boundaries: [], relationships: rels,
    nodes: [{ id: "n1", definitionId: "d", x: 0, y: 0 }, { id: "n2", definitionId: "other", x: 300, y: 0 }] },
});

describe("broken ends and wires", () => {
  it("is fine while the pip still matches the wire", () => {
    expect(endBroken(pip("a"), rel("a"))).toBe(false);
    expect(endBroken(pip("a", "tr-http", "s-any"), rel("a"))).toBe(false); // loosened to 'any' still fits
  });

  it("breaks when the pip was deleted, retyped incompatibly, or is missing", () => {
    expect(endBroken(pip("a", "tr-http", "s-rest", { removed: true }), rel("a"))).toBe(true);
    expect(endBroken(pip("a", "tr-tcp", "s-sql"), rel("a"))).toBe(true);
    expect(endBroken(null, rel("a"))).toBe(true);
    expect(wireBroken(rel("a"), pip("a"), pip("in"))).toBe(false);
    expect(wireBroken(rel("a"), pip("a"), pip("in", "tr-tcp"))).toBe(true);
  });

  it("explains why, for the pip's tooltip", () => {
    const t = STANDARD.transports, st = STANDARD.styles;
    expect(brokenReason(pip("a", "tr-http", "s-rest", { removed: true }), [], "Snip API", t, st)).toMatch(/was deleted from Snip API/);
    expect(brokenReason(pip("a", "tr-tcp", "s-sql"), [rel("a")], "Snip API", t, st)).toMatch(/now TCP \/ SQL, but its wire carries HTTP \/ REST\/JSON/);
    expect(brokenReason(pip("a"), [rel("a")], "Snip API", t, st)).toBeNull();
  });
});

describe("keeping and pruning deleted pips", () => {
  it("keeps a deleted pip, marked removed, while a wire uses it", () => {
    const before = def([pip("a"), pip("b")]);
    const saved = keepWiredPips(before, def([pip("b")]), canvas([rel("a")]));
    expect(saved.pips.map((p) => [p.id, !!p.removed])).toEqual([["b", false], ["a", true]]);
  });

  it("lets an unwired pip go for real", () => {
    const saved = keepWiredPips(def([pip("a"), pip("b")]), def([pip("b")]), canvas([]));
    expect(saved.pips.map((p) => p.id)).toEqual(["b"]);
  });

  it("drops a deleted pip once its last wire is gone, and changes nothing otherwise", () => {
    const defs = { d: def([pip("b"), pip("a", "tr-http", "s-rest", { removed: true })]) };
    expect(pruneRemovedPips(defs, canvas([rel("a")]))).toBe(defs);
    expect(pruneRemovedPips(defs, canvas([])).d.pips.map((p) => p.id)).toEqual(["b"]);
    expect(pipInUse({ id: "d", canvasId: null }, "a", canvas([rel("a")]))).toBe(true);
  });
});
