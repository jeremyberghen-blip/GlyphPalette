import { beforeEach, describe, expect, it } from "vitest";
import { useApp } from "./store";
import { NODE_WIDTH } from "./types";
import { isDirty } from "./lib/session";
import { buildProjectFile, loadProjectFile, parseProjectFile } from "./lib/projectFile";
import { STANDARD, isStandardDef } from "./lib/standardLibrary";

const s = () => useApp.getState();
const root = () => s().canvases["canvas-root"];

/** Places a node and returns its instance id. */
function place(defId: string, x = 0, y = 0): string {
  s().addNode(defId, x, y);
  return s().selection[0];
}

/** Drags a wire from one pip to another. */
function wire(fromNode: string, fromPip: string, toNode: string, toPip: string) {
  s().startWire(fromNode, fromPip, { x: 0, y: 0 });
  s().updateWire({ x: 0, y: 0 }, { nodeId: toNode, pipId: toPip });
  s().endWire();
}

beforeEach(() => s().newProject());

describe("smoke", () => {
  it("starts as a Context canvas holding one System node", () => {
    expect(root().layer).toBe("context");
    expect(root().nodes).toHaveLength(1);
    const system = s().definitions[root().nodes[0].definitionId];
    expect(system.name).toBe("My System");
    expect(isStandardDef(system.id)).toBe(false); // the project's own, so it can be renamed
  });

  it("saves and reloads a project without losing anything", () => {
    const web = place("def-webapp");
    const api = place("def-server", 300, 0);
    wire(web, "p-wa-api", api, "p-srv-http");
    const json = JSON.stringify(buildProjectFile(s(), STANDARD));
    const content = loadProjectFile(parseProjectFile(json), STANDARD);
    expect(content.canvases).toEqual(s().canvases);
    expect(content.definitions).toEqual(s().definitions);
  });
});

describe("save state", () => {
  const dirty = () => isDirty(s(), s().savedRefs);

  it("starts clean, and any content change makes it dirty", () => {
    expect(dirty()).toBe(false);
    place("def-cache");
    expect(dirty()).toBe(true);
    s().markSaved("C:/p/Snip.glyph");
    expect(dirty()).toBe(false);
  });

  it("panning and selecting don't count as changes", () => {
    s().setViewport({ x: 10, y: 10, scale: 2 });
    s().setSelection([root().nodes[0].id]);
    expect(dirty()).toBe(false);
  });

  it("New forgets the previous file, so the next save asks where", () => {
    s().markSaved("C:/p/Snip.glyph");
    s().newProject();
    expect(s().filePath).toBeNull();
    expect(dirty()).toBe(false);
  });
});

describe("wiring", () => {
  it("connects compatible pips, normalized outbound → inbound", () => {
    const web = place("def-webapp");
    const api = place("def-server", 300, 0);
    // Dragged from the inbound end: still stored outbound-first
    wire(api, "p-srv-http", web, "p-wa-api");
    const [rel] = root().relationships;
    expect(rel.from).toEqual({ nodeId: web, pipId: "p-wa-api" });
    expect(rel.to).toEqual({ nodeId: api, pipId: "p-srv-http" });
    expect(rel.typeId).toBe("t-rest");
  });

  it("refuses incompatible pips and duplicate wires", () => {
    const web = place("def-webapp");
    const api = place("def-server", 300, 0);
    wire(web, "p-wa-in", api, "p-srv-http"); // inbound HTTP → inbound REST
    expect(root().relationships).toHaveLength(0);
    wire(web, "p-wa-api", api, "p-srv-http");
    wire(web, "p-wa-api", api, "p-srv-http");
    expect(root().relationships).toHaveLength(1);
  });
});

describe("undo", () => {
  it("reverts the last change", () => {
    place("def-cache");
    expect(root().nodes).toHaveLength(2);
    s().undo();
    expect(root().nodes).toHaveLength(1);
  });
});

describe("boundaries", () => {
  it("collapse then expand restores the nodes and every wire", () => {
    const web = place("def-webapp", 0, 0);
    const api = place("def-server", 300, 0);
    const db = place("def-database", 600, 0);
    wire(web, "p-wa-api", api, "p-srv-http");
    wire(api, "p-srv-sql", db, "p-db-sql");
    s().addBoundary("Backend", "Box", { x: 280, y: -20, width: 480, height: 150 });
    const boxId = s().selection[0];

    s().collapseBoundary(boxId);
    const collapsed = root().nodes.find((n) => s().definitions[n.definitionId].expandable)!;
    expect(collapsed).toBeDefined();
    expect(root().relationships).toHaveLength(1); // web → collapsed node
    expect(s().definitions[collapsed.definitionId].pips).toHaveLength(1);

    s().expandNode(collapsed.id);
    const names = root().nodes.map((n) => s().definitions[n.definitionId].name).sort();
    expect(names).toEqual(["API Service", "Database", "My System", "Web App"]);
    expect(root().relationships).toHaveLength(2);
    expect(root().boundaries).toHaveLength(1);
  });

  it("gives a collapsed boundary a pocket at the same layer", () => {
    place("def-cache", 0, 0);
    s().addBoundary("Group", "Box", { x: -10, y: -10, width: 200, height: 150 });
    s().collapseBoundary(s().selection[0]);
    const def = s().definitions[root().nodes.find((n) => n.id === s().selection[0])!.definitionId];
    expect(s().canvases[def.canvasId!].layer).toBe(root().layer);
  });
});

describe("standard library", () => {
  it("is read-only: edits and deletes of standard definitions are ignored", () => {
    const before = s().definitions["def-cache"];
    s().saveDefinition({ ...before, name: "Renamed" });
    s().removeDefinition("def-cache");
    expect(s().definitions["def-cache"]).toEqual(before);
  });

  it("imports another project's nodes", () => {
    s().importDefinitions({
      definitions: [{ id: "def-x", name: "X", icon: "Box", layers: ["container"], pips: [], canvasId: null }],
      pipTypes: [{ id: "t-x", name: "X", color: "#fff" }],
      customIcons: {},
    });
    expect(s().definitions["def-x"].name).toBe("X");
    expect(s().pipTypes["t-x"]).toBeDefined();
    s().undo();
    expect(s().definitions["def-x"]).toBeUndefined();
  });
});

describe("duplicating", () => {
  it("Duplicate makes an independent, numbered copy with an empty interior", () => {
    s().enterDefinition("def-server"); // give it an interior first
    s().goBack();
    const id = s().duplicateDefinition("def-server")!;
    expect(s().definitions[id].name).toBe("API Service 2");
    expect(s().definitions[id].canvasId).toBeNull();
    expect(isStandardDef(id)).toBe(false);
    const again = s().duplicateDefinition("def-server")!;
    expect(s().definitions[again].name).toBe("API Service 3");
  });

  it("Ctrl+D copies selected nodes as new definitions at the cursor, wires included", () => {
    const web = place("def-webapp", 0, 0);
    const api = place("def-server", 300, 0);
    wire(web, "p-wa-api", api, "p-srv-http");
    s().setSelection([web, api]);
    s().duplicateSelection({ x: 1000, y: 1000 });

    const copies = root().nodes.filter((n) => s().selection.includes(n.id));
    expect(copies.map((n) => s().definitions[n.definitionId].name).sort()).toEqual(["API Service 2", "Web App 2"]);
    // Layout kept, centered on the cursor
    const [a, b] = copies;
    expect(b.x - a.x).toBe(300);
    expect((Math.min(a.x, b.x) + Math.max(a.x, b.x) + NODE_WIDTH) / 2).toBe(1000);
    // The wire between them came along
    const copyIds = new Set(copies.map((n) => n.id));
    expect(root().relationships.filter((r) => copyIds.has(r.from.nodeId) && copyIds.has(r.to.nodeId))).toHaveLength(1);
  });

  it("Ctrl+D skips collapsed groups", () => {
    place("def-cache", 0, 0);
    s().addBoundary("Group", "Box", { x: -10, y: -10, width: 200, height: 150 });
    s().collapseBoundary(s().selection[0]);
    const before = root().nodes.length;
    s().duplicateSelection(null);
    expect(root().nodes.length).toBe(before);
  });
});

describe("wire bend points", () => {
  /** Two wired nodes; returns their ids and the wire's id. */
  function wired() {
    const web = place("def-webapp", 0, 0);
    const api = place("def-server", 400, 0);
    wire(web, "p-wa-api", api, "p-srv-http");
    return { web, api, rel: root().relationships[0].id };
  }
  const waypoints = (rel: string) => root().relationships.find((r) => r.id === rel)!.waypoints ?? [];

  it("double-click adds one in path order and selects it; undo removes it", () => {
    const { rel } = wired();
    s().addWaypointAt(rel, { x: 300, y: 100 });
    s().addWaypointAt(rel, { x: 200, y: 100 });
    expect(waypoints(rel).map((w) => w.x)).toEqual([200, 300]);
    expect(s().selectedWaypoint).toEqual({ relId: rel, index: 0 });
    s().undo();
    expect(waypoints(rel).map((w) => w.x)).toEqual([300]);
  });

  it("Delete removes just the selected one", () => {
    const { rel } = wired();
    s().addWaypointAt(rel, { x: 200, y: 100 });
    s().addWaypointAt(rel, { x: 300, y: 100 });
    s().selectWaypoint(rel, 0);
    s().removeSelectedWaypoint();
    expect(waypoints(rel).map((w) => w.x)).toEqual([300]);
  });

  it("stay put when one end moves, and follow when both ends move together", () => {
    const { web, api, rel } = wired();
    s().addWaypointAt(rel, { x: 250, y: 100 });
    s().moveNodes([{ id: web, x: 0, y: 50 }]);
    expect(waypoints(rel)[0]).toMatchObject({ x: 250, y: 100 });
    s().moveNodes([
      { id: web, x: 10, y: 70 },
      { id: api, x: 410, y: 20 },
    ]);
    expect(waypoints(rel)[0]).toMatchObject({ x: 260, y: 120 });
  });

  it("paste and Ctrl+D carry them along, offset with the nodes", () => {
    const { web, api, rel } = wired();
    s().addWaypointAt(rel, { x: 250, y: 100 });
    s().setSelection([web, api]);
    s().copySelection();
    s().paste();
    const pasted = root().relationships.find((r) => r.id !== rel)!;
    expect(pasted.waypoints![0]).toMatchObject({ x: 270, y: 120 });
  });

  it("dragging the handle turns and lengthens the section", () => {
    const { rel } = wired();
    s().addWaypointAt(rel, { x: 250, y: 100 });
    s().dragWaypointHandle(rel, 0, { x: 250, y: 100 + 14 + 30 });
    expect(waypoints(rel)[0].half).toBeCloseTo(30);
  });

  /** The collapsed node on the root canvas. */
  const collapsedNode = () => root().nodes.find((n) => s().definitions[n.definitionId].expandable)!;
  const nodeOf = (defId: string) => root().nodes.find((n) => n.definitionId === defId)!;

  it("folds a crossing wire's bend points inside a collapsing box, and restores them on expand", () => {
    const { rel } = wired();
    s().addWaypointAt(rel, { x: 250, y: 100 }); // outside the box
    s().addWaypointAt(rel, { x: 380, y: 60 }); // inside, 20 left of API Service (x 400)
    s().addBoundary("B", "Box", { x: 350, y: -20, width: 250, height: 150 });
    s().collapseBoundary(s().selection[0]);
    expect(waypoints(rel).map((w) => w.x)).toEqual([250]);

    s().expandNode(collapsedNode().id);
    const api = nodeOf("def-server");
    const [outside, inside] = waypoints(rel);
    expect(outside.x).toBe(250); // never moved
    expect(inside.x - api.x).toBeCloseTo(-20); // back in place relative to its node
    expect(inside.y - api.y).toBeCloseTo(60);
  });

  it("restored bend points follow a collapsed node that was moved", () => {
    const { rel } = wired();
    s().addWaypointAt(rel, { x: 380, y: 60 });
    s().addBoundary("B", "Box", { x: 350, y: -20, width: 250, height: 150 });
    s().collapseBoundary(s().selection[0]);
    const node = collapsedNode();
    s().moveNodes([{ id: node.id, x: node.x + 100, y: node.y + 50 }]);
    const before = { x: collapsedNode().x, y: collapsedNode().y };
    s().expandNode(collapsedNode().id);
    const api = nodeOf("def-server");
    const [w] = waypoints(rel);
    expect(w.x - api.x).toBeCloseTo(-20);
    expect(w.y - api.y).toBeCloseTo(60);
    expect(api.x).toBeGreaterThan(before.x - 200); // content landed where the node was moved to
  });

  it("survives boxes collapsed inside boxes", () => {
    const web = place("def-webapp", 0, 0);
    const api = place("def-server", 400, 0);
    const db = place("def-database", 700, 0);
    wire(web, "p-wa-api", api, "p-srv-http");
    const rel = root().relationships[0].id;
    wire(api, "p-srv-sql", db, "p-db-sql");
    s().addWaypointAt(rel, { x: 250, y: 100 }); // inside the outer box only
    s().addWaypointAt(rel, { x: 380, y: 60 }); // inside the inner box: 20 left of API Service
    s().addBoundary("Inner", "Box", { x: 350, y: -20, width: 200, height: 150 });
    s().collapseBoundary(s().selection[0]);
    const innerAt = collapsedNode().x; // outer-only point sits 250 - innerAt from it
    s().addBoundary("Outer", "Box", { x: 200, y: -60, width: 700, height: 250 });
    s().collapseBoundary(s().selection[0]);
    expect(waypoints(rel)).toEqual([]);

    s().expandNode(collapsedNode().id); // outer
    const inner = collapsedNode();
    expect(waypoints(rel)).toHaveLength(1);
    expect(waypoints(rel)[0].x - inner.x).toBeCloseTo(250 - innerAt);

    s().expandNode(inner.id); // inner
    const apiNode = nodeOf("def-server");
    const [a, b] = waypoints(rel);
    expect(a.x - inner.x).toBeCloseTo(250 - innerAt); // unchanged by the inner expand
    expect(b.x - apiNode.x).toBeCloseTo(-20);
  });
});

describe("layers", () => {
  it("opens a node one layer down, and nests Component inside Component", () => {
    const sys = root().nodes[0];
    s().enterDefinition(sys.definitionId);
    expect(s().canvases[s().activeCanvasId].layer).toBe("container");
    place("def-server");
    s().enterDefinition("def-server");
    expect(s().canvases[s().activeCanvasId].layer).toBe("component");
    place("def-service");
    s().enterDefinition("def-service");
    expect(s().canvases[s().activeCanvasId].layer).toBe("component");
  });
});
