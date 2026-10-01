import { describe, expect, it } from "vitest";
import { importCandidates, planImport } from "./importDefs";
import { loadProjectFile, parseProjectFile, ProjectContent } from "./projectFile";
import { STANDARD, isStandardDef } from "./standardLibrary";
import { NodeDefinition } from "../types";
import snipJson from "../test/fixtures/Snip.glyph?raw";

const snip = (): ProjectContent => loadProjectFile(parseProjectFile(snipJson), STANDARD);

const def = (id: string, name: string, extra: Partial<NodeDefinition> = {}): NodeDefinition => ({
  id,
  name,
  icon: "Box",
  layers: ["container"],
  pips: [],
  canvasId: null,
  ...extra,
});

let n = 0;
const newId = () => `new-${++n}`;

describe("importCandidates", () => {
  it("offers a project's own drawable nodes, not standard ones, pockets, or Code-only ones", () => {
    const names = importCandidates(snip(), isStandardDef).map((d) => d.name);
    expect(names).toContain("Links DB");
    expect(names).toContain("Snip API");
    expect(names).not.toContain("Cache"); // standard
    expect(names).not.toContain("Analytics"); // pocket
    expect(names).not.toContain("createLink()"); // retired Code layer only
  });
});

describe("planImport", () => {
  const target = {
    definitions: { ...STANDARD.definitions },
    transports: { ...STANDARD.transports },
    styles: { ...STANDARD.styles },
    customIcons: {},
  };

  it("brings nodes across with empty interiors", () => {
    const source = snip();
    const snipApi = Object.values(source.definitions).find((d) => d.name === "Snip API")!;
    const plan = planImport(source, target, [snipApi.id], "Snip", newId);
    expect(plan.definitions).toHaveLength(1);
    expect(plan.definitions[0].name).toBe("Snip API");
    expect(plan.definitions[0].canvasId).toBeNull();
    expect(plan.definitions[0].id).toBe(snipApi.id);
  });

  it("renames on a name or id clash so both coexist", () => {
    const source: ProjectContent = {
      definitions: { a: def("a", "Links DB"), b: def("b", "Unique") },
      transports: {}, styles: {},
      customIcons: {},
      canvases: {},
    };
    const here = { ...target, definitions: { ...target.definitions, b: def("b", "Other"), x: def("x", "Links DB") } };
    const plan = planImport(source, here, ["a", "b"], "Snip", newId);
    const [a, b] = plan.definitions;
    expect(a.name).toBe("Links DB (Snip)");
    expect(a.id).not.toBe("a");
    expect(b.name).toBe("Unique (Snip)"); // id clash
    expect(b.id).not.toBe("b");
  });

  it("numbers a clash that is still taken after adding the project name", () => {
    const source: ProjectContent = { definitions: { a: def("a", "DB") }, transports: {}, styles: {}, customIcons: {}, canvases: {} };
    const here = { ...target, definitions: { x: def("x", "DB"), y: def("y", "DB (Snip)") } };
    expect(planImport(source, here, ["a"], "Snip", newId).definitions[0].name).toBe("DB (Snip) 2");
  });

  it("brings missing transports and styles, and keeps existing ones", () => {
    const pip = (transportId: string, styleId: string) => ({
      id: `${transportId}-${styleId}`,
      label: "",
      transportId,
      styleId,
      direction: "inbound" as const,
      side: "left" as const,
    });
    const source: ProjectContent = {
      definitions: { a: def("a", "A", { pips: [pip("tr-http", "s-rest"), pip("tr-mqtt", "s-custom")] }) },
      transports: {
        "tr-http": { id: "tr-http", name: "HTTP", color: "#000" },
        "tr-mqtt": { id: "tr-mqtt", name: "MQTT", color: "#123" },
      },
      styles: {
        "s-rest": { id: "s-rest", name: "REST", color: "#000" },
        "s-custom": { id: "s-custom", name: "Custom", color: "#456" },
      },
      customIcons: {},
      canvases: {},
    };
    const plan = planImport(source, target, ["a"], "S", newId);
    expect(plan.transports.map((t) => t.id)).toEqual(["tr-mqtt"]);
    expect(plan.styles.map((t) => t.id)).toEqual(["s-custom"]);
  });

  it("copies custom icons, re-iding one whose id means something else here", () => {
    const source: ProjectContent = {
      definitions: { a: def("a", "A", { icon: "custom:i1" }), b: def("b", "B", { icon: "custom:i2" }) },
      transports: {}, styles: {},
      customIcons: { i1: "data:one", i2: "data:two" },
      canvases: {},
    };
    const here = { ...target, customIcons: { i2: "data:different" } };
    const plan = planImport(source, here, ["a", "b"], "S", newId, () => "fresh");
    expect(plan.customIcons).toEqual({ i1: "data:one", fresh: "data:two" });
    expect(plan.definitions[1].icon).toBe("custom:fresh");
  });
});
