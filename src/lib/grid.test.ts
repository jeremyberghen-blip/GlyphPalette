import { describe, expect, it } from "vitest";
import { GRID_SPACING, gridBackground, gridSpacing, gridTile } from "./grid";

describe("gridSpacing", () => {
  it("is 40 at normal zoom and when zoomed in", () => {
    expect(gridSpacing(1)).toBe(GRID_SPACING);
    expect(gridSpacing(4)).toBe(40);
    expect(gridSpacing(0.4)).toBe(40); // exactly 16px apart on screen
  });

  it("doubles when zoomed out, so lines stay at least 16px apart on screen", () => {
    expect(gridSpacing(0.39)).toBe(80);
    expect(gridSpacing(0.2)).toBe(80);
    expect(gridSpacing(0.1)).toBe(160);
  });

  it("never loops on a nonsense zoom", () => {
    expect(gridSpacing(0)).toBe(40);
    expect(gridSpacing(-1)).toBe(40);
  });
});

describe("gridBackground", () => {
  it("sizes one tile to one grid cell on screen", () => {
    expect(gridBackground({ x: 0, y: 0, scale: 1 }).backgroundSize).toBe("40px 40px");
    expect(gridBackground({ x: 0, y: 0, scale: 2 }).backgroundSize).toBe("80px 80px");
    expect(gridBackground({ x: 0, y: 0, scale: 0.2 }).backgroundSize).toBe("16px 16px");
  });

  it("offsets the tiles so lines sit on world multiples of the spacing as the view pans", () => {
    expect(gridBackground({ x: 100, y: -30, scale: 1 }).backgroundPosition).toBe("20px 10px");
    expect(gridBackground({ x: 0, y: 0, scale: 1 }).backgroundPosition).toBe("0px 0px");
  });

  it("uses one tileable image", () => {
    const { backgroundImage } = gridBackground({ x: 0, y: 0, scale: 1 });
    expect(backgroundImage.startsWith('url("data:image/svg+xml,')).toBe(true);
    expect(backgroundImage).toBe(gridTile(40));
  });
});
