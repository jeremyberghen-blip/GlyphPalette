import { describe, expect, it } from "vitest";
import { CanvasData, NodeDefinition, NodeInstance } from "../types";
import {
  buildPlan,
  clashesWith,
  definitionStatus,
  placementForTrail,
  automaticPath,
  relativeToProject,
  normalizeOverride,
  pathClashes,
  placementsOf,
  projectFolderName,
  reusedInterior,
} from "./paths";
import { PORT_IN } from "./ports";

const def = (id: string, name: string, extra: Partial<NodeDefinition> = {}): NodeDefinition => ({
  id,
  name,
  icon: "Box",
  layers: ["container"],
  pips: [],
  canvasId: null,
  ...extra,
});
const node = (id: string, definitionId: string, extra: Partial<NodeInstance> = {}): NodeInstance => ({
  id,
  definitionId,
  x: 0,
  y: 0,
  ...extra,
});
const canvas = (id: string, nodes: NodeInstance[]): CanvasData => ({
  id,
  layer: "container",
  nodes,
  relationships: [],
  boundaries: [],
});

/** Snip, roughly as drawn in the walkthrough. */
function snip() {
  const defs: Record<string, NodeDefinition> = Object.fromEntries(
    [
      def("person", "Person", { external: true }),
      def("snip", "Snip", { canvasId: "c-snip" }),
      def("safe", "Safe Browsing API", { external: true }),
      def("web", "Web App", { language: "typescript" }),
      def("api", "Snip API", { language: "python", canvasId: "c-api" }),
      def("db", "Links DB", { language: "sql" }),
      def("cache", "Cache", { external: true, canvasId: "c-cache" }),
      def("redis", "Redis Config"),
      def("links", "Link Service"),
      def("config", "Config", { kind: "file" }),
      def("router", "Router", { kind: "file", canvasId: "c-router" }),
      def("handler", "Handler"),
    ].map((d) => [d.id, d])
  );
  const canvases: Record<string, CanvasData> = {
    "canvas-root": canvas("canvas-root", [node("n-person", "person"), node("n-snip", "snip"), node("n-safe", "safe")]),
    "c-snip": canvas("c-snip", [node("n-web", "web"), node("n-api", "api"), node("n-db", "db"), node("n-cache", "cache")]),
    "c-api": canvas("c-api", [
      node("n-port", PORT_IN),
      node("n-links", "links"),
      node("n-config", "config"),
      node("n-router", "router"),
    ]),
    "c-cache": canvas("c-cache", [node("n-redis", "redis")]),
    "c-router": canvas("c-router", [node("n-handler", "handler")]),
  };
  return { defs, canvases };
}

const at = (plan: ReturnType<typeof buildPlan>, nodeId: string) => placementsOf(plan, nodeId)[0];

describe("buildPlan", () => {
  it("names the project folder after the project", () => {
    expect(projectFolderName("Snip")).toBe("snip");
    expect(projectFolderName("Snip App (v2)")).toBe("snip-app-v2");
  });

  it("lets one top-level system be the project folder", () => {
    const { defs, canvases } = snip();
    const plan = buildPlan("Snip", canvases, defs);
    expect(at(plan, "n-snip")).toMatchObject({ path: "snip", projectRoot: true, status: "drawn" });
  });

  it("walks folders down, each named in its language's convention", () => {
    const { defs, canvases } = snip();
    const plan = buildPlan("Snip", canvases, defs);
    expect(at(plan, "n-web")).toMatchObject({ path: "snip/web-app", status: "ai", language: "typescript" });
    expect(at(plan, "n-api")).toMatchObject({ path: "snip/snip_api", status: "drawn" });
    expect(at(plan, "n-db").path).toBe("snip/links_db");
  });

  it("inherits the nearest ancestor's language", () => {
    const { defs, canvases } = snip();
    const plan = buildPlan("Snip", canvases, defs);
    expect(at(plan, "n-links")).toMatchObject({ path: "snip/snip_api/link_service", language: "python" });
    expect(at(plan, "n-snip").language).toBeUndefined();
  });

  it("ends a file's path with its name and extension", () => {
    const { defs, canvases } = snip();
    const plan = buildPlan("Snip", canvases, defs);
    expect(at(plan, "n-config")).toMatchObject({ path: "snip/snip_api/config.py", status: "file" });
  });

  it("leaves a file without any language unextended (the export flags it)", () => {
    const { defs, canvases } = snip();
    defs.api = { ...defs.api, language: undefined };
    const plan = buildPlan("Snip", canvases, defs);
    expect(at(plan, "n-config")).toMatchObject({ path: "snip/snip_api/config", language: undefined });
  });

  it("gives externals, and everything inside them, no path", () => {
    const { defs, canvases } = snip();
    const plan = buildPlan("Snip", canvases, defs);
    expect(at(plan, "n-person")).toMatchObject({ status: "external", path: null });
    expect(at(plan, "n-cache")).toMatchObject({ status: "external", path: null });
    expect(at(plan, "n-redis")).toMatchObject({ status: "external", path: null });
  });

  it("treats a File's drawn interior as a sketch that isn't built", () => {
    const { defs, canvases } = snip();
    const plan = buildPlan("Snip", canvases, defs);
    expect(at(plan, "n-router").path).toBe("snip/snip_api/router.py");
    expect(at(plan, "n-handler")).toMatchObject({ status: "sketch", path: null });
  });

  it("never builds port nodes", () => {
    const { defs, canvases } = snip();
    const plan = buildPlan("Snip", canvases, defs);
    expect(placementsOf(plan, "n-port")).toEqual([]);
  });

  it("counts an interior holding only ports as not drawn", () => {
    const { defs, canvases } = snip();
    canvases["c-web"] = canvas("c-web", [node("n-web-port", PORT_IN)]);
    defs.web = { ...defs.web, canvasId: "c-web" };
    expect(at(buildPlan("Snip", canvases, defs), "n-web").status).toBe("ai");
  });

  it("gives several top-level systems a subfolder each", () => {
    const { defs, canvases } = snip();
    defs.admin = def("admin", "Admin Portal");
    canvases["canvas-root"].nodes.push(node("n-admin", "admin"));
    const plan = buildPlan("Snip", canvases, defs);
    expect(at(plan, "n-snip")).toMatchObject({ path: "snip/snip", projectRoot: false });
    expect(at(plan, "n-admin").path).toBe("snip/admin_portal");
    expect(at(plan, "n-api").path).toBe("snip/snip/snip_api");
  });

  it("adds nothing for pockets (collapsed groups)", () => {
    const { defs, canvases } = snip();
    // Fold Snip itself into a pocket on the root, and Link Service into one inside Snip API
    defs["pocket-top"] = def("pocket-top", "Group", { expandable: true, canvasId: "c-pocket-top", pipMap: {} });
    defs["pocket-in"] = def("pocket-in", "Services", { expandable: true, canvasId: "c-pocket-in", pipMap: {} });
    canvases["canvas-root"].nodes = canvases["canvas-root"].nodes.filter((n) => n.id !== "n-snip");
    canvases["canvas-root"].nodes.push(node("n-pocket-top", "pocket-top"));
    canvases["c-pocket-top"] = canvas("c-pocket-top", [node("n-snip", "snip")]);
    canvases["c-api"].nodes = canvases["c-api"].nodes.filter((n) => n.id !== "n-links");
    canvases["c-api"].nodes.push(node("n-pocket-in", "pocket-in"));
    canvases["c-pocket-in"] = canvas("c-pocket-in", [node("n-links", "links")]);
    const plan = buildPlan("Snip", canvases, defs);
    expect(at(plan, "n-snip")).toMatchObject({ path: "snip", projectRoot: true });
    expect(at(plan, "n-links").path).toBe("snip/snip_api/link_service");
    expect(placementsOf(plan, "n-pocket-in")).toEqual([]);
  });

  it("builds an overridden node, and its children, on the typed path", () => {
    const { defs, canvases } = snip();
    canvases["c-snip"].nodes[1].pathOverride = "services/api";
    const plan = buildPlan("Snip", canvases, defs);
    expect(at(plan, "n-api")).toMatchObject({ path: "snip/services/api", overridden: true });
    expect(at(plan, "n-links").path).toBe("snip/services/api/link_service");
  });

  it("stops the lone system being the project folder when it's overridden", () => {
    const { defs, canvases } = snip();
    canvases["canvas-root"].nodes[1].pathOverride = "backend";
    const plan = buildPlan("Snip", canvases, defs);
    expect(at(plan, "n-snip")).toMatchObject({ path: "snip/backend", projectRoot: false });
    expect(at(plan, "n-web").path).toBe("snip/backend/web-app");
  });

  it("survives an interior that contains its own definition", () => {
    const defs = { loop: def("loop", "Loop", { canvasId: "c-loop" }) };
    const canvases = {
      "canvas-root": canvas("canvas-root", [node("n1", "loop")]),
      "c-loop": canvas("c-loop", [node("n2", "loop")]),
    };
    const plan = buildPlan("P", canvases, defs);
    expect(plan.placements.map((p) => p.path)).toEqual(["p", "p/loop"]);
  });
});

describe("clashes and reuse", () => {
  it("finds two nodes claiming the same path, ignoring case", () => {
    const { defs, canvases } = snip();
    defs.web = { ...defs.web, language: undefined, slug: "snip_api" };
    const plan = buildPlan("Snip", canvases, defs);
    expect([...pathClashes(plan).keys()]).toEqual(["snip/snip_api"]);
    canvases["c-snip"].nodes[0].pathOverride = "Snip_API";
    const typed = buildPlan("Snip", canvases, defs);
    expect(clashesWith(typed, at(typed, "n-api")).map((p) => p.nodeId)).toEqual(["n-web"]);
  });

  it("finds one drawn interior built under two paths", () => {
    const { defs, canvases } = snip();
    // Snip API placed a second time, inside Web App
    defs.web = { ...defs.web, canvasId: "c-web" };
    canvases["c-web"] = canvas("c-web", [node("n-api-2", "api")]);
    const plan = buildPlan("Snip", canvases, defs);
    const links = placementsOf(plan, "n-links").map((p) => p.path);
    expect(links).toEqual(["snip/web-app/snip_api/link_service", "snip/snip_api/link_service"]);
    expect(reusedInterior(plan, at(plan, "n-api")).map((p) => p.nodeId)).toEqual(["n-api-2"]);
    expect(reusedInterior(plan, at(plan, "n-db"))).toEqual([]);
  });

  it("picks the placement reached through the breadcrumb trail", () => {
    const { defs, canvases } = snip();
    defs.web = { ...defs.web, canvasId: "c-web" };
    canvases["c-web"] = canvas("c-web", [node("n-api-2", "api")]);
    const plan = buildPlan("Snip", canvases, defs);
    expect(placementForTrail(plan, "n-links", ["canvas-root", "c-snip", "c-api"])?.path).toBe(
      "snip/snip_api/link_service"
    );
    expect(placementForTrail(plan, "n-links", ["canvas-root", "c-snip", "c-web", "c-api"])?.path).toBe(
      "snip/web-app/snip_api/link_service"
    );
    expect(placementForTrail(plan, "n-links", ["somewhere"])?.path).toBe("snip/web-app/snip_api/link_service");
  });
});

describe("automatic path", () => {
  it("is the derived path, whatever the node's own override", () => {
    const { defs, canvases } = snip();
    canvases["c-snip"].nodes[1].pathOverride = "services/api";
    const trail = ["canvas-root", "c-snip"];
    expect(automaticPath("Snip", canvases, defs, "c-snip", "n-api", trail)).toBe("snip/snip_api");
    // Children still see the override above them
    expect(automaticPath("Snip", canvases, defs, "c-api", "n-links", [...trail, "c-api"])).toBe(
      "snip/services/api/link_service"
    );
  });

  it("is null for nodes that aren't built", () => {
    const { defs, canvases } = snip();
    expect(automaticPath("Snip", canvases, defs, "c-snip", "n-cache", ["canvas-root", "c-snip"])).toBeNull();
  });

  it("drops the project folder for display in the override field", () => {
    expect(relativeToProject("snip/snip_api/x.py", "snip")).toBe("snip_api/x.py");
    expect(relativeToProject("snip", "snip")).toBe("");
    expect(relativeToProject("snipe/x", "snip")).toBe("snipe/x");
  });
});

describe("definitionStatus", () => {
  it("gives a definition's kind line before it's placed", () => {
    const { defs, canvases } = snip();
    expect(definitionStatus(defs.cache, canvases)).toBe("external");
    expect(definitionStatus(defs.router, canvases)).toBe("file");
    expect(definitionStatus(defs.api, canvases)).toBe("drawn");
    expect(definitionStatus(defs.links, canvases)).toBe("ai");
  });
});

describe("normalizeOverride", () => {
  it("unifies separators and drops empty, . and .. segments", () => {
    expect(normalizeOverride("  /services\\api/ ")).toBe("services/api");
    expect(normalizeOverride("../x/./y")).toBe("x/y");
  });

  it("removes characters filesystems reject, keeping the user's casing", () => {
    expect(normalizeOverride('Src/Lib:*?"<x>|')).toBe("Src/Libx");
    expect(normalizeOverride("api. ")).toBe("api");
  });

  it("returns empty for nothing usable", () => {
    expect(normalizeOverride("")).toBe("");
    expect(normalizeOverride(" / .. / ")).toBe("");
  });
});
