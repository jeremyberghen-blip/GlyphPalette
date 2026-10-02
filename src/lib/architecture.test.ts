import { describe, expect, it } from "vitest";
import { CanvasData, NodeDefinition, NodeInstance, PipDef, Relationship } from "../types";
import { ArchitectureFile, architectureSummary, buildArchitecture } from "./architecture";
import { PORT_IN, PORT_OUT } from "./ports";
import { STANDARD } from "./standardLibrary";

const pip = (id: string, label: string, direction: PipDef["direction"], transportId: string, styleId: string): PipDef => ({
  id,
  label,
  direction,
  transportId,
  styleId,
  side: direction === "inbound" ? "left" : "right",
});
const def = (id: string, name: string, pips: PipDef[] = [], extra: Partial<NodeDefinition> = {}): NodeDefinition => ({
  id,
  name,
  icon: "Box",
  layers: ["container"],
  pips,
  canvasId: null,
  ...extra,
});
const node = (id: string, definitionId: string): NodeInstance => ({ id, definitionId, x: 0, y: 0 });
const canvas = (id: string, layer: CanvasData["layer"], nodes: NodeInstance[], relationships: Relationship[] = []): CanvasData => ({
  id,
  layer,
  nodes,
  relationships,
  boundaries: [],
});
let relN = 0;
const wire = (from: [string, string], to: [string, string], transportId: string, styleId: string): Relationship => ({
  id: `r${++relN}`,
  transportId,
  styleId,
  from: { nodeId: from[0], pipId: from[1] },
  to: { nodeId: to[0], pipId: to[1] },
});

/** Snip: Context → Snip's containers → Snip API's components. */
function snip() {
  const defs: Record<string, NodeDefinition> = Object.fromEntries(
    [
      def("person", "Link Visitor", [pip("p-uses", "Uses", "outbound", "tr-http", "s-html")], { external: true }),
      def("snip", "Snip", [pip("s-web", "Web", "inbound", "tr-http", "s-html"), pip("s-sb", "URL check", "outbound", "tr-http", "s-rest")], {
        canvasId: "c-snip",
        layers: ["context"],
        description: "Shortens links.",
      }),
      def("safe", "Safe Browsing API", [pip("sb-in", "Lookup", "inbound", "tr-http", "s-rest")], { external: true }),
      def("web", "Web App", [pip("w-in", "Pages", "inbound", "tr-http", "s-html"), pip("w-api", "API", "outbound", "tr-http", "s-rest")], {
        language: "typescript",
      }),
      def(
        "api",
        "Snip API",
        [
          pip("a-in", "API", "inbound", "tr-http", "s-rest"),
          pip("a-db", "DB", "outbound", "tr-tcp", "s-sql"),
          pip("a-sb", "URL check", "outbound", "tr-http", "s-rest"),
        ],
        { language: "python", canvasId: "c-api", constraints: ["no HTML"] }
      ),
      def("db", "Links DB", [pip("d-in", "SQL", "inbound", "tr-tcp", "s-sql")], { language: "sql" }),
      def("cache", "Cache", [], { external: true, canvasId: "c-cache" }),
      def("redis", "Redis Config"),
      def("ctl", "Links Controller", [pip("c-in", "HTTP", "inbound", "tr-http", "s-rest"), pip("c-out", "Calls", "outbound", "tr-inproc", "s-call")], {
        layers: ["component"],
      }),
      def("svc", "Link Service", [
        pip("v-in", "In", "inbound", "tr-inproc", "s-call"),
        pip("v-repo", "Repo", "outbound", "tr-inproc", "s-call"),
        pip("v-model", "Model", "outbound", "tr-inproc", "s-import"),
      ]),
      def("repo", "Link Repository", [pip("r-in", "In", "inbound", "tr-inproc", "s-call"), pip("r-db", "DB", "outbound", "tr-tcp", "s-sql")]),
      def("model", "Link", [pip("m-in", "Used by", "inbound", "tr-inproc", "s-import")], { kind: "file" }),
      def("router", "Router", [], { kind: "file", canvasId: "c-router" }),
      def("handler", "Handler"),
    ].map((d) => [d.id, d])
  );
  const canvases: Record<string, CanvasData> = {
    "canvas-root": canvas(
      "canvas-root",
      "context",
      [node("n-person", "person"), node("n-snip", "snip"), node("n-safe", "safe")],
      [wire(["n-person", "p-uses"], ["n-snip", "s-web"], "tr-http", "s-html"), wire(["n-snip", "s-sb"], ["n-safe", "sb-in"], "tr-http", "s-rest")]
    ),
    "c-snip": canvas(
      "c-snip",
      "container",
      [node("n-in", PORT_IN), node("n-out", PORT_OUT), node("n-web", "web"), node("n-api", "api"), node("n-db", "db"), node("n-cache", "cache")],
      [
        wire(["n-in", "s-web"], ["n-web", "w-in"], "tr-http", "s-html"),
        wire(["n-web", "w-api"], ["n-api", "a-in"], "tr-http", "s-rest"),
        wire(["n-api", "a-db"], ["n-db", "d-in"], "tr-tcp", "s-sql"),
        wire(["n-api", "a-sb"], ["n-out", "s-sb"], "tr-http", "s-rest"),
      ]
    ),
    "c-api": canvas(
      "c-api",
      "component",
      [node("n-ain", PORT_IN), node("n-aout", PORT_OUT), node("n-ctl", "ctl"), node("n-svc", "svc"), node("n-repo", "repo"), node("n-model", "model"), node("n-router", "router")],
      [
        wire(["n-ain", "a-in"], ["n-ctl", "c-in"], "tr-http", "s-rest"),
        wire(["n-ctl", "c-out"], ["n-svc", "v-in"], "tr-inproc", "s-call"),
        wire(["n-svc", "v-repo"], ["n-repo", "r-in"], "tr-inproc", "s-call"),
        wire(["n-svc", "v-model"], ["n-model", "m-in"], "tr-inproc", "s-import"),
        wire(["n-repo", "r-db"], ["n-aout", "a-db"], "tr-tcp", "s-sql"),
      ]
    ),
    "c-cache": canvas("c-cache", "component", [node("n-redis", "redis")]),
    "c-router": canvas("c-router", "component", [node("n-handler", "handler")]),
  };
  return { defs, canvases };
}

const publish = (defs: Record<string, NodeDefinition>, canvases: Record<string, CanvasData>) =>
  buildArchitecture({ projectName: "Snip", canvases, definitions: defs, transports: STANDARD.transports, styles: STANDARD.styles });
const byName = (a: ArchitectureFile, name: string) => a.nodes.filter((n) => n.name === name);
const one = (a: ArchitectureFile, name: string) => byName(a, name)[0];

describe("Publish — nodes", () => {
  it("lists each placement with its kind, path, language, and parent", () => {
    const { defs, canvases } = snip();
    const a = publish(defs, canvases);
    expect(a.project).toEqual({ name: "Snip", folder: "snip" });
    expect(one(a, "Snip")).toMatchObject({ id: "n-snip", parent: null, kind: "folder", contents: "drawn", path: "snip", language: null, layer: "context", description: "Shortens links." });
    expect(one(a, "Web App")).toMatchObject({ parent: "n-snip", kind: "folder", contents: "ai", path: "snip/web-app", language: "typescript", layer: "container" });
    expect(one(a, "Snip API")).toMatchObject({ id: "n-snip/n-api", contents: "drawn", constraints: ["no HTML"] });
    expect(one(a, "Link Repository")).toMatchObject({ parent: "n-snip/n-api", path: "snip/snip_api/link_repository", language: "python", layer: "component" });
    expect(one(a, "Link")).toMatchObject({ kind: "file", path: "snip/snip_api/link.py" });
  });

  it("gives external nodes no path or language, and leaves out what's drawn inside them", () => {
    const { defs, canvases } = snip();
    const a = publish(defs, canvases);
    expect(one(a, "Safe Browsing API")).toEqual({ id: "n-safe", name: "Safe Browsing API", parent: null, kind: "external", layer: "context", definition: "safe" });
    expect(one(a, "Cache")).toMatchObject({ kind: "external", parent: "n-snip" });
    expect(byName(a, "Redis Config")).toEqual([]);
  });

  it("leaves out ports and a File's reference sketch", () => {
    const { defs, canvases } = snip();
    const a = publish(defs, canvases);
    expect(byName(a, "Handler")).toEqual([]);
    expect(a.nodes.some((n) => n.id.endsWith("n-in") || n.id.endsWith("n-ain"))).toBe(false);
  });

  it("lists a definition placed twice once per placement, and warns", () => {
    const { defs, canvases } = snip();
    defs.web = { ...defs.web, canvasId: "c-web" };
    canvases["c-web"] = canvas("c-web", "component", [node("n-api2", "api")]);
    const a = publish(defs, canvases);
    expect(byName(a, "Snip API").map((n) => n.path)).toEqual(["snip/web-app/snip_api", "snip/snip_api"]);
    expect(byName(a, "Link Repository")).toHaveLength(2);
    expect(a.warnings.some((w) => w.startsWith("Snip API is placed 2 times"))).toBe(true);
  });

  it("warns about files and AI-decided folders with no language anywhere above them", () => {
    const { defs, canvases } = snip();
    defs.api = { ...defs.api, language: undefined };
    const a = publish(defs, canvases);
    expect(one(a, "Link")).toMatchObject({ path: "snip/snip_api/link", language: null });
    expect(a.warnings).toContain("snip/snip_api/link: no language set — set one on Link or on a folder above it");
    expect(a.warnings.some((w) => w.startsWith("snip/snip_api/links_controller: no language"))).toBe(true);
    // A drawn folder needs none of its own: its contents carry theirs
    expect(a.warnings.some((w) => w.startsWith("snip/snip_api: "))).toBe(false);
  });
});

describe("Publish — edges", () => {
  it("exports each wire as drawn, with its kind, transport, style, and both pips", () => {
    const { defs, canvases } = snip();
    const a = publish(defs, canvases);
    expect(a.edges).toContainEqual({
      from: { node: "n-person", pip: "p-uses", label: "Uses" },
      to: { node: "n-snip", pip: "s-web", label: "Web" },
      kind: "transport",
      transport: "HTTP",
      style: "Web pages",
    });
    const k = (from: string, to: string) => a.edges.find((e) => e.from.node.endsWith(from) && e.to.node.endsWith(to))?.kind;
    expect(k("n-ctl", "n-svc")).toBe("call");
    expect(k("n-svc", "n-model")).toBe("import");
    expect(k("n-api", "n-db")).toBe("transport");
  });

  it("turns a wire to a port into an edge to the parent, marked, with the pip identified", () => {
    const { defs, canvases } = snip();
    const a = publish(defs, canvases);
    // Inside Snip API: Link Repository's DB wire leaves through the Outbound port
    expect(a.edges).toContainEqual({
      from: { node: "n-snip/n-api/n-repo", pip: "r-db", label: "DB" },
      to: { node: "n-snip/n-api", pip: "a-db", label: "DB", port: true },
      kind: "transport",
      transport: "TCP",
      style: "SQL",
    });
    // …and outside, the same pip carries on to Links DB: the chain can be followed
    expect(a.edges.some((e) => e.from.node === "n-snip/n-api" && e.from.pip === "a-db" && e.to.node === "n-snip/n-db")).toBe(true);
    // Coming in: the parent's inbound pip reaches the controller
    expect(a.edges).toContainEqual(
      expect.objectContaining({ from: { node: "n-snip/n-api", pip: "a-in", label: "API", port: true }, to: expect.objectContaining({ node: "n-snip/n-api/n-ctl" }) })
    );
  });

  it("repeats a shared interior's wires once per placement", () => {
    const { defs, canvases } = snip();
    defs.web = { ...defs.web, canvasId: "c-web" };
    canvases["c-web"] = canvas("c-web", "component", [node("n-api2", "api")]);
    const a = publish(defs, canvases);
    const calls = a.edges.filter((e) => e.from.label === "Calls").map((e) => e.from.node);
    expect(calls).toEqual(["n-snip/n-web/n-api2/n-ctl", "n-snip/n-api/n-ctl"]);
  });

  it("skips nothing built inside externals or sketches, and skips broken wires with a warning", () => {
    const { defs, canvases } = snip();
    // Retype Links DB's pip so the wire drawn as TCP/SQL no longer fits
    defs.db = { ...defs.db, pips: [pip("d-in", "SQL", "inbound", "tr-http", "s-rest")] };
    const a = publish(defs, canvases);
    expect(a.edges.some((e) => e.to.node === "n-snip/n-db")).toBe(false);
    expect(a.warnings).toContain("Skipped a broken wire: Snip API → Links DB (a pip at one end was deleted or changed)");
  });
});

describe("Publish — collapsed groups", () => {
  it("dissolves a group: its contents join the canvas around it, and wires follow its pip map", () => {
    const { defs, canvases } = snip();
    // Collapse Snip API and Links DB into a group "Backend" on Snip's canvas
    defs.backend = def("backend", "Backend", [pip("b-in", "API", "inbound", "tr-http", "s-rest"), pip("b-sb", "URL check", "outbound", "tr-http", "s-rest")], {
      expandable: true,
      canvasId: "c-backend",
      pipMap: { "b-in": { nodeId: "n-api", pipId: "a-in" }, "b-sb": { nodeId: "n-api", pipId: "a-sb" } },
    });
    const snipCanvas = canvases["c-snip"];
    canvases["c-backend"] = canvas(
      "c-backend",
      "container",
      snipCanvas.nodes.filter((n) => n.id === "n-api" || n.id === "n-db"),
      snipCanvas.relationships.filter((r) => r.from.nodeId === "n-api" && r.to.nodeId === "n-db")
    );
    canvases["c-snip"] = {
      ...snipCanvas,
      nodes: [...snipCanvas.nodes.filter((n) => n.id !== "n-api" && n.id !== "n-db"), node("n-backend", "backend")],
      relationships: [
        wire(["n-in", "s-web"], ["n-web", "w-in"], "tr-http", "s-html"),
        wire(["n-web", "w-api"], ["n-backend", "b-in"], "tr-http", "s-rest"),
        wire(["n-backend", "b-sb"], ["n-out", "s-sb"], "tr-http", "s-rest"),
      ],
    };
    const a = publish(defs, canvases);
    expect(byName(a, "Backend")).toEqual([]);
    expect(one(a, "Snip API")).toMatchObject({ id: "n-snip/n-backend/n-api", parent: "n-snip", path: "snip/snip_api" });
    // The wire into the group lands on the node inside it
    expect(a.edges).toContainEqual(
      expect.objectContaining({ from: expect.objectContaining({ node: "n-snip/n-web" }), to: { node: "n-snip/n-backend/n-api", pip: "a-in", label: "API" } })
    );
    // The wire drawn inside the group is there too
    expect(a.edges.some((e) => e.from.node === "n-snip/n-backend/n-api" && e.to.node === "n-snip/n-backend/n-db")).toBe(true);
  });
});

describe("Publish summary", () => {
  it("counts nodes by kind and the connections", () => {
    const { defs, canvases } = snip();
    expect(architectureSummary(publish(defs, canvases))).toBe("12 nodes (7 folders, 2 files, 3 external) · 11 connections");
  });
});

describe("Publish on a real project", () => {
  it("handles Snip.glyph: unique ids, and every edge end is an exported node", async () => {
    const { default: snipJson } = await import("../test/fixtures/Snip.glyph?raw");
    const { loadProjectFile, parseProjectFile } = await import("./projectFile");
    const content = loadProjectFile(parseProjectFile(snipJson), STANDARD);
    const a = buildArchitecture({ projectName: "Snip", ...content });
    const ids = a.nodes.map((n) => n.id);
    expect(ids.length).toBeGreaterThan(5);
    expect(new Set(ids).size).toBe(ids.length);
    for (const e of a.edges) {
      expect(ids).toContain(e.from.node);
      expect(ids).toContain(e.to.node);
    }
    for (const n of a.nodes) if (n.parent) expect(ids).toContain(n.parent);
  });
});
