import { describe, expect, it } from "vitest";
import { nextLayer } from "../types";
import { canvasOwner, childLayer, isPocket, repairPocketLayers } from "./layers";
import { parseProjectFile, loadProjectFile } from "./projectFile";
import { STANDARD } from "./standardLibrary";
import snipJson from "../test/fixtures/Snip.glyph?raw";

describe("nextLayer", () => {
  it("steps down one layer and clamps at Component", () => {
    expect(nextLayer("context")).toBe("container");
    expect(nextLayer("container")).toBe("component");
    expect(nextLayer("component")).toBe("component");
  });

  it("keeps legacy Code canvases' children at Code", () => {
    expect(nextLayer("code")).toBe("code");
  });
});

describe("childLayer", () => {
  it("goes one layer down for a node's interior", () => {
    expect(childLayer("container", {})).toBe("component");
  });

  it("stays at the same layer for a pocket", () => {
    expect(childLayer("container", { expandable: true })).toBe("container");
  });
});

describe("Snip.glyph pocket repair", () => {
  const ANALYTICS_POCKET = "canvas-mun8ytko-3g";
  const LINK_SERVICE_INTERIOR = "canvas-mumxbw32-2q";

  it("was saved with the pocket one layer too deep", () => {
    const raw = JSON.parse(snipJson);
    expect(raw.canvases[ANALYTICS_POCKET].layer).toBe("component");
  });

  it("moves the Analytics pocket back to Container and leaves legacy Code alone", () => {
    const content = loadProjectFile(parseProjectFile(snipJson), STANDARD);
    expect(content.canvases[ANALYTICS_POCKET].layer).toBe("container");
    expect(isPocket(content.definitions, ANALYTICS_POCKET)).toBe(true);
    expect(canvasOwner(content.definitions, ANALYTICS_POCKET)?.name).toBe("Analytics");
    expect(content.canvases[LINK_SERVICE_INTERIOR].layer).toBe("code");
  });

  it("changes nothing on a second pass", () => {
    const content = loadProjectFile(parseProjectFile(snipJson), STANDARD);
    expect(repairPocketLayers(content.canvases, content.definitions)).toEqual([]);
  });
});
