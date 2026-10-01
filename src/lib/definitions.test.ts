import { describe, expect, it } from "vitest";
import { copyDefinition, incrementName, nameTaken, sameDefinition, uniqueName } from "./definitions";
import { NodeDefinition } from "../types";

const takenFrom = (names: string[]) => (n: string) =>
  names.some((x) => x.toLowerCase() === n.toLowerCase());

describe("incrementName", () => {
  it("adds a space and 2 to a plain name", () => {
    expect(incrementName("Link Service", takenFrom([]))).toBe("Link Service 2");
  });

  it("counts up from a trailing number", () => {
    expect(incrementName("Worker 2", takenFrom([]))).toBe("Worker 3");
  });

  it("skips names already taken", () => {
    expect(incrementName("Cache", takenFrom(["Cache 2", "cache 3"]))).toBe("Cache 4");
  });

  it("only treats a space-separated number as the counter", () => {
    expect(incrementName("Node7", takenFrom([]))).toBe("Node7 2");
  });
});

describe("uniqueName", () => {
  it("keeps a free name and numbers a taken one", () => {
    expect(uniqueName("Links DB", takenFrom([]))).toBe("Links DB");
    expect(uniqueName("Links DB", takenFrom(["links db"]))).toBe("Links DB 2");
  });
});

describe("nameTaken", () => {
  const defs = { a: { id: "a", name: "Cache" } } as unknown as Record<string, NodeDefinition>;
  it("is case-insensitive and can exclude one definition", () => {
    expect(nameTaken(defs, "cache")).toBe(true);
    expect(nameTaken(defs, "Cache", "a")).toBe(false);
  });
});

describe("sameDefinition", () => {
  const base: NodeDefinition = {
    id: "d",
    name: "API Service",
    icon: "Server",
    layers: ["container"],
    canvasId: null,
    pips: [{ id: "p", label: "HTTP", transportId: "tr-http", styleId: "s-rest", direction: "inbound", side: "left" }],
  };

  it("ignores pip label changes", () => {
    expect(sameDefinition(base, { ...base, pips: [{ ...base.pips[0], label: "API" }] })).toBe(true);
  });

  it("notices renames, new pips, and retyped pips", () => {
    expect(sameDefinition(base, { ...base, name: "Snip API" })).toBe(false);
    expect(sameDefinition(base, { ...base, pips: [...base.pips, { ...base.pips[0], id: "q" }] })).toBe(false);
    expect(sameDefinition(base, { ...base, pips: [{ ...base.pips[0], transportId: "tr-tcp" }] })).toBe(false);
    expect(sameDefinition(base, { ...base, pips: [{ ...base.pips[0], styleId: "s-any" }] })).toBe(false);
  });

  it("can compare by transport only, for files from before styles existed", () => {
    const upgraded = { ...base, pips: [{ ...base.pips[0], styleId: "s-any" }] };
    expect(sameDefinition(upgraded, base, { ignoreStyles: true })).toBe(true);
  });
});

describe("copyDefinition", () => {
  it("copies icon, layers, and pips, but not the interior or pocket data", () => {
    const src: NodeDefinition = {
      id: "a",
      name: "Analytics",
      icon: "Boxes",
      layers: ["container"],
      pips: [{ id: "p", label: "In", transportId: "tr-http", styleId: "s-any", direction: "inbound", side: "left" }],
      canvasId: "inner",
      expandable: true,
      pipMap: { p: { nodeId: "n", pipId: "q" } },
    };
    const copy = copyDefinition(src, "b", "Analytics 2");
    expect(copy).toEqual({
      id: "b",
      name: "Analytics 2",
      icon: "Boxes",
      layers: ["container"],
      pips: [{ id: "p", label: "In", transportId: "tr-http", styleId: "s-any", direction: "inbound", side: "left" }],
      canvasId: null,
    });
    copy.pips[0].label = "changed";
    expect(src.pips[0].label).toBe("In");
  });
});

describe("copyDefinition and the v1.3 definition facts", () => {
  const src: NodeDefinition = {
    id: "a", name: "Link Service", icon: "Cog", layers: ["component"], pips: [], canvasId: null,
    slug: "links", external: true, kind: "file", language: "python",
  };

  it("keeps external, kind, and language", () => {
    expect(copyDefinition(src, "b", "Link Service 2")).toMatchObject({ external: true, kind: "file", language: "python" });
  });

  it("drops a typed slug, so the copy's slug follows its own name", () => {
    expect(copyDefinition(src, "b", "Link Service 2").slug).toBeUndefined();
  });
});
