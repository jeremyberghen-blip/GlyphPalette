import { describe, expect, it } from "vitest";
import { STANDARD } from "./standardLibrary";

describe("standard library", () => {
  it("labels API Service's REST/JSON inbound pip 'API', not 'HTTP'", () => {
    const pip = STANDARD.definitions["def-server"].pips.find((p) => p.id === "p-srv-http")!;
    expect(pip.label).toBe("API");
    expect(pip.transportId).toBe("tr-http");
    expect(pip.styleId).toBe("s-rest");
  });

  it("has no retired Code-layer definitions", () => {
    for (const d of Object.values(STANDARD.definitions)) expect(d.layers).not.toContain("code");
  });

  it("uses no red, which is reserved for broken links", () => {
    const isRed = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
      return r > 180 && g < 110 && b < 110;
    };
    const colors = [...Object.values(STANDARD.transports), ...Object.values(STANDARD.styles)];
    expect(colors.filter((c) => isRed(c.color)).map((c) => c.name)).toEqual([]);
    expect(isRed("#ef4444")).toBe(true); // the broken-link red itself
  });

  it("only references transports and styles it defines", () => {
    for (const d of Object.values(STANDARD.definitions))
      for (const p of d.pips) {
        expect(STANDARD.transports[p.transportId]).toBeDefined();
        expect(STANDARD.styles[p.styleId]).toBeDefined();
      }
  });
});
