// How layers are shown: one color per layer, used everywhere a layer appears
// (palette header, breadcrumbs, navigator), plus the label text.

import { LAYER_LABELS, Layer, isRetiredLayer } from "../types";

export const LAYER_COLORS: Record<Layer, string> = {
  context: "#60a5fa", // blue
  container: "#2dd4bf", // teal
  component: "#fbbf24", // amber
  code: "#7a7d92", // retired: neutral grey
};

/**
 * Label for a canvas's layer: "Container", "Code (retired)", or for a pocket
 * (a collapsed boundary's inside) "Container · collapsed".
 */
export function layerLabel(layer: Layer, pocket = false): string {
  const base = LAYER_LABELS[layer] + (isRetiredLayer(layer) ? " (retired)" : "");
  return pocket ? `${base} · collapsed` : base;
}
