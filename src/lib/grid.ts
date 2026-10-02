// The canvas background: a minimal line grid drawn as one small tile that
// the browser repeats behind the canvas (a CSS background). Its cost is the
// same at every zoom. It replaced v1.4.0's dot grid, which drew each dot as
// its own canvas object — over 30,000 of them zoomed out, which bogged GP
// down (v1.4.1).

/** World units between grid lines at normal zoom. */
export const GRID_SPACING = 40;
/** Lines never get closer than this on screen; zoomed out, the spacing doubles instead. */
export const MIN_SCREEN_SPACING = 16;
const LINE_COLOR = "rgba(255,255,255,0.05)";

/** World units between grid lines at a zoom: 40, doubled until they're at least 16px apart on screen. */
export function gridSpacing(scale: number): number {
  if (!(scale > 0)) return GRID_SPACING;
  let spacing = GRID_SPACING;
  while (spacing * scale < MIN_SCREEN_SPACING) spacing *= 2;
  return spacing;
}

/** One grid cell as a tileable SVG image (a line along its top and left edges), for CSS. */
export function gridTile(sizePx: number, color = LINE_COLOR): string {
  const s = +sizePx.toFixed(3);
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='${s}' height='${s}'>` +
    `<path d='M0 0.5H${s}M0.5 0V${s}' stroke='${color}' stroke-width='1' fill='none'/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/**
 * The canvas's CSS background at a viewport: the tile, its on-screen size,
 * and an offset that puts the lines on world multiples of the spacing (so
 * they pan and zoom with the content).
 */
export function gridBackground(v: { x: number; y: number; scale: number }): {
  backgroundImage: string;
  backgroundSize: string;
  backgroundPosition: string;
} {
  const size = gridSpacing(v.scale) * v.scale;
  const wrap = (a: number) => +(((a % size) + size) % size).toFixed(3);
  return {
    backgroundImage: gridTile(size),
    backgroundSize: `${+size.toFixed(3)}px ${+size.toFixed(3)}px`,
    backgroundPosition: `${wrap(v.x)}px ${wrap(v.y)}px`,
  };
}
