import { describe, expect, it } from "vitest";
import { defaultPipType, groupPipTypes } from "./pipTypes";
import { STANDARD } from "./standardLibrary";
import { PipType } from "../types";

const names = (ts: PipType[]) => ts.map((t) => t.name);

describe("standard pip-type affinity", () => {
  it("suggests transport types on Container definitions", () => {
    const { usual, other } = groupPipTypes(STANDARD.pipTypes, ["container"]);
    expect(names(usual)).toEqual(["HTTP", "REST/JSON", "gRPC", "TCP/IP", "SQL", "Event", "Queue", "File I/O"]);
    expect(names(other)).toEqual(["Call", "Import"]);
  });

  it("suggests Call/Import and File I/O on Component definitions", () => {
    const { usual } = groupPipTypes(STANDARD.pipTypes, ["component"]);
    expect(names(usual)).toEqual(["File I/O", "Call", "Import"]);
  });

  it("merges suggestions for a definition on several layers", () => {
    const { usual, other } = groupPipTypes(STANDARD.pipTypes, ["context", "component"]);
    expect(usual).toHaveLength(10);
    expect(other).toHaveLength(0);
  });

  it("defaults a new pip to the first usual type", () => {
    expect(defaultPipType(STANDARD.pipTypes, ["container"])).toBe("t-http");
    expect(defaultPipType(STANDARD.pipTypes, ["component"])).toBe("t-call");
  });
});

describe("types without a hint", () => {
  it("count as usual everywhere", () => {
    const custom = { c: { id: "c", name: "Custom", color: "#fff" } };
    expect(names(groupPipTypes(custom, ["component"]).usual)).toEqual(["Custom"]);
  });
});
