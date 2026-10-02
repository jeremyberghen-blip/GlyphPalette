import { describe, expect, it } from "vitest";
import { defaultSide, groupPipsByDirection } from "./pips";
import { PipDirection } from "../types";

describe("defaultSide", () => {
  it("puts inbound pips on the left and the rest on the right", () => {
    expect(defaultSide("inbound")).toBe("left");
    expect(defaultSide("outbound")).toBe("right");
    expect(defaultSide("bidirectional")).toBe("right");
    expect(defaultSide("none")).toBe("right");
  });
});

describe("groupPipsByDirection", () => {
  const pip = (id: string, direction: PipDirection) => ({ id, direction });

  it("sorts pips into Inbound, Outbound, and Both ways / other, keeping their order", () => {
    const pips = [
      pip("a", "outbound"),
      pip("b", "inbound"),
      pip("c", "bidirectional"),
      pip("d", "outbound"),
      pip("e", "none"),
      pip("f", "inbound"),
    ];
    const g = groupPipsByDirection(pips);
    expect(g.inbound.map((p) => p.id)).toEqual(["b", "f"]);
    expect(g.outbound.map((p) => p.id)).toEqual(["a", "d"]);
    expect(g.other.map((p) => p.id)).toEqual(["c", "e"]);
  });

  it("moves a pip to its new section when its direction changes", () => {
    const pips = [pip("a", "inbound"), pip("b", "inbound")];
    const changed = pips.map((p) => (p.id === "a" ? { ...p, direction: "outbound" as const } : p));
    expect(groupPipsByDirection(changed).outbound.map((p) => p.id)).toEqual(["a"]);
    expect(groupPipsByDirection(changed).inbound.map((p) => p.id)).toEqual(["b"]);
  });
});
