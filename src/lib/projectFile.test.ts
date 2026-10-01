import { describe, expect, it } from "vitest";
import { buildProjectFile, loadProjectFile, parseProjectFile, ProjectContent } from "./projectFile";
import { STANDARD } from "./standardLibrary";
import { canConnect } from "./graph";
import snipJson from "../test/fixtures/Snip.glyph?raw";

const load = (json: string): ProjectContent => loadProjectFile(parseProjectFile(json), STANDARD);
const byName = (c: ProjectContent, name: string) =>
  Object.values(c.definitions).filter((d) => d.name === name);

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
    const content = load(JSON.stringify(old));
    expect(content.canvases["canvas-root"].layer).toBe("context");
    expect(content.canvases.inner.layer).toBe("container");
    expect(content.definitions.d.layers).toEqual(["container"]);
  });
});

describe("standard library in project files", () => {
  it("never writes standard definitions or pip types into the file", () => {
    const file = buildProjectFile(load(snipJson), STANDARD);
    for (const id of Object.keys(STANDARD.definitions)) expect(file.definitions[id]).toBeUndefined();
    for (const id of Object.keys(STANDARD.transports)) expect(file.transports[id]).toBeUndefined();
    for (const id of Object.keys(STANDARD.styles)) expect(file.styles[id]).toBeUndefined();
  });

  it("keeps an interior drawn inside a standard node", () => {
    const content = load(snipJson);
    content.definitions["def-cache"].canvasId = "inner";
    content.canvases.inner = { id: "inner", layer: "component", nodes: [], relationships: [], boundaries: [] };
    const file = buildProjectFile(content, STANDARD);
    expect(file.standardInteriors).toEqual({ "def-cache": "inner" });
    expect(load(JSON.stringify(file)).definitions["def-cache"].canvasId).toBe("inner");
  });
});

describe("upgrading version 1 files to two-part connection types", () => {
  it("converts every pip and wire, leaving no flat typeId behind", () => {
    const content = load(snipJson);
    const json = JSON.stringify(content);
    expect(json).not.toContain('"typeId"');
    const snipApi = Object.values(content.definitions).find((d) => d.name === "Snip API")!;
    const byLabel = Object.fromEntries(snipApi.pips.map((p) => [p.label, `${p.transportId}/${p.styleId}`]));
    expect(byLabel.DB).toBe("tr-tcp/s-sql");
    expect(byLabel.Cache).toBe("tr-tcp/s-any");
  });

  it("keeps old wires valid against the more specific standard styles", () => {
    // Snip API's Cache pip (was TCP/IP → TCP/any) still fits the standard Cache (now TCP/Key-value)
    const content = load(snipJson);
    const std = content.definitions["def-cache"].pips[0];
    expect(std.styleId).toBe("s-kv");
    const snipApi = Object.values(content.definitions).find((d) => d.name === "Snip API")!;
    const cachePip = snipApi.pips.find((p) => p.label === "Cache")!;
    expect(canConnect({ ...cachePip, direction: "outbound" }, std)).toBe(true);
  });

  it("turns a custom v1 pip type into a transport", () => {
    const old = {
      app: "glyph-palette",
      version: 1,
      pipTypes: { "t-abc": { id: "t-abc", name: "MQTT", color: "#123456" } },
      definitions: {
        d: { id: "d", name: "D", icon: "Box", layers: ["container"], canvasId: null,
          pips: [{ id: "p", label: "Bus", typeId: "t-abc", direction: "inbound", side: "left" }] },
      },
      canvases: { "canvas-root": { id: "canvas-root", nodes: [], relationships: [], boundaries: [] } },
    };
    const content = load(JSON.stringify(old));
    const pip = content.definitions.d.pips[0];
    expect(content.transports[pip.transportId].name).toBe("MQTT");
    expect(pip.styleId).toBe("s-any");
  });

  it("saves in the new format", () => {
    const file = buildProjectFile(load(snipJson), STANDARD);
    expect(file.version).toBe(2);
    expect((file as unknown as Record<string, unknown>).pipTypes).toBeUndefined();
    expect(file.upgradedFromV1).toBeUndefined();
  });
});

describe("Snip.glyph (real project fixture, saved by v1.0)", () => {
  it("drops unedited seed copies in favor of the standard nodes", () => {
    const content = load(snipJson);
    expect(byName(content, "Cache").map((d) => d.id)).toEqual(["def-cache"]);
    expect(byName(content, "Web App").map((d) => d.id)).toEqual(["def-webapp"]);
  });

  it("re-ids edited seeds so the standard node is available alongside", () => {
    const content = load(snipJson);
    const [linksDb] = byName(content, "Links DB");
    expect(linksDb.id).not.toBe("def-database");
    expect(content.definitions["def-database"].name).toBe("Database");
    const nodes = Object.values(content.canvases).flatMap((c) => c.nodes);
    expect(nodes.some((n) => n.definitionId === linksDb.id)).toBe(true);
    expect(nodes.every((n) => content.definitions[n.definitionId])).toBe(true);
  });

  it("gives re-id'd seeds the standard node's building facts (v1.0 had none)", () => {
    const old = {
      app: "glyph-palette",
      version: 1,
      pipTypes: {},
      definitions: {
        "def-queue": { id: "def-queue", name: "Click Queue", icon: "Layers", layers: ["container"], canvasId: null, pips: [] },
        "def-file": { id: "def-file", name: "Config", icon: "File", layers: ["component"], canvasId: null, pips: [] },
      },
      canvases: { "canvas-root": { id: "canvas-root", nodes: [], relationships: [], boundaries: [] } },
    };
    const content = load(JSON.stringify(old));
    const [queue] = byName(content, "Click Queue");
    const [config] = byName(content, "Config");
    expect(queue.external).toBe(true);
    expect(config.kind).toBe("file");
    expect(config.external).toBeUndefined();
  });

  it("keeps interiors with the re-id'd definitions", () => {
    const content = load(snipJson);
    const [snipApi] = byName(content, "Snip API");
    expect(snipApi.canvasId).toBe("canvas-mumw6w3y-22");
    expect(content.definitions["def-gateway"].canvasId).toBeNull();
  });

  it("saves and reloads to the same content", () => {
    const once = load(snipJson);
    const twice = load(JSON.stringify(buildProjectFile(once, STANDARD)));
    expect(twice.definitions).toEqual(once.definitions);
    expect(twice.canvases).toEqual(once.canvases);
  });
});
