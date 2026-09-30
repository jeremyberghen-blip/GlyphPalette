import { beforeEach, describe, expect, it } from "vitest";
import { useApp } from "./store";
import { buildProjectFile, mergeWithLibrary, parseProjectFile } from "./lib/projectFile";
import { SEED_LIBRARY } from "./lib/defaultLibrary";

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
    expect(s().definitions[root().nodes[0].definitionId].name).toBe("System");
  });

  it("saves and reloads a project without losing anything", () => {
    const web = place("def-webapp");
    const api = place("def-server", 300, 0);
    wire(web, "p-wa-api", api, "p-srv-http");
    const json = JSON.stringify(buildProjectFile(s(), s().defaultLibraryIds));
    const { content } = mergeWithLibrary(parseProjectFile(json), SEED_LIBRARY);
    expect(content.canvases).toEqual(s().canvases);
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
    expect(names).toEqual(["API Service", "Database", "System", "Web App"]);
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
