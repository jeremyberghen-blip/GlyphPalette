import { describe, expect, it } from "vitest";
import { LAYER_COLORS, layerLabel } from "./layerStyle";
import { LAYERS } from "../types";

describe("layerLabel", () => {
  it("names drawable layers plainly", () => {
    expect(layerLabel("container")).toBe("Container");
  });

  it("marks the retired Code layer", () => {
    expect(layerLabel("code")).toBe("Code (retired)");
  });

  it("marks pockets as collapsed groups at their parent's layer", () => {
    expect(layerLabel("container", true)).toBe("Container · collapsed");
  });
});

describe("LAYER_COLORS", () => {
  it("gives every layer its own color", () => {
    const colors = LAYERS.map((l) => LAYER_COLORS[l]);
    expect(new Set(colors).size).toBe(LAYERS.length);
  });
});
