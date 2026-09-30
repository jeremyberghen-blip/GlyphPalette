import { describe, expect, it } from "vitest";
import { buildProjectFile, mergeWithLibrary, parseProjectFile } from "./projectFile";
import { SEED_LIBRARY } from "./defaultLibrary";
import snipJson from "../test/fixtures/Snip.glyph?raw";

describe("parseProjectFile", () => {
  it("rejects files that aren't Glyph Palette projects", () => {
    expect(() => parseProjectFile("{}")).toThrow(/Not a valid/);
    expect(() => parseProjectFile(JSON.stringify({ app: "glyph-palette" }))).toThrow();
  });

  it("migrates the old `containers` field to `boundaries`", () => {
    const old = {
      app: "glyph-palette",
      version: 1,
      canvases: {
        "canvas-root": {
          id: "canvas-root",
          nodes: [],
          relationships: [],
          containers: [{ id: "b", name: "B", icon: "Box", x: 0, y: 0, width: 10, height: 10 }],
        },
      },
    };
    const file = parseProjectFile(JSON.stringify(old));
    const root = file.canvases["canvas-root"] as unknown as Record<string, unknown>;
    expect(root.boundaries).toHaveLength(1);
    expect(root.containers).toBeUndefined();
  });

  it("backfills missing layers from the root down", () => {
    const old = {
      app: "glyph-palette",
      version: 1,
      definitions: {
        d: { id: "d", name: "D", icon: "Box", pips: [], canvasId: "inner" },
      },
      canvases: {
        "canvas-root": {
          id: "canvas-root",
          nodes: [{ id: "n", definitionId: "d", x: 0, y: 0 }],
          relationships: [],
          boundaries: [],
        },
        inner: { id: "inner", nodes: [], relationships: [], boundaries: [] },
      },
    };
    const { content } = mergeWithLibrary(parseProjectFile(JSON.stringify(old)), SEED_LIBRARY);
    expect(content.canvases["canvas-root"].layer).toBe("context");
    expect(content.canvases.inner.layer).toBe("container");
    expect(content.definitions.d.layers).toEqual(["container"]);
  });
});

describe("Snip.glyph (real project fixture)", () => {
  it("loads, and saves back to the same definitions and canvases", () => {
    const original = JSON.parse(snipJson);
    const { content, libraryIds } = mergeWithLibrary(parseProjectFile(snipJson), SEED_LIBRARY);
    const rebuilt = buildProjectFile(content, libraryIds);
    expect(rebuilt.definitions).toEqual(original.definitions);
    expect(rebuilt.canvases).toEqual(original.canvases);
  });
});
