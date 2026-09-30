import { describe, expect, it } from "vitest";
import { STANDARD } from "./standardLibrary";

describe("standard library", () => {
  it("labels API Service's REST/JSON inbound pip 'API', not 'HTTP'", () => {
    const pip = STANDARD.definitions["def-server"].pips.find((p) => p.id === "p-srv-http")!;
    expect(pip.label).toBe("API");
    expect(pip.typeId).toBe("t-rest");
  });

  it("has no retired Code-layer definitions", () => {
    for (const d of Object.values(STANDARD.definitions)) expect(d.layers).not.toContain("code");
  });

  it("only references pip types it defines", () => {
    for (const d of Object.values(STANDARD.definitions))
      for (const p of d.pips) expect(STANDARD.pipTypes[p.typeId]).toBeDefined();
  });
});
