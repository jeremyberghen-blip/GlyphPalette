// Core data model for Glyph Palette.
// Definitions live in the Library; instances live on Canvases and refer back
// to a definition by id. (Library and pips arrive in later stages — the shapes
// are declared now so the store doesn't churn.)

export type PipDirection = "inbound" | "outbound" | "bidirectional" | "none";

/**
 * C4-style decomposition level. A canvas sits at one layer; a node definition
 * declares which layers it may be placed on. Ordered coarse → fine.
 */
export type Layer = "context" | "container" | "component" | "code";

export const LAYERS: readonly Layer[] = ["context", "container", "component", "code"];

export const LAYER_LABELS: Record<Layer, string> = {
  context: "Context",
  container: "Container",
  component: "Component",
  code: "Code",
};

/** The layer one step deeper, clamped at "code". */
export function nextLayer(l: Layer): Layer {
  const i = LAYERS.indexOf(l);
  return LAYERS[Math.min(i + 1, LAYERS.length - 1)];
}

export interface PipType {
  id: string;
  name: string; // e.g. "TCP/IP", "HTTP"
  color: string;
}

export interface PipDef {
  id: string;
  label: string;
  typeId: string;
  direction: PipDirection;
  /** Which side of the node the pip sits on. */
  side: "left" | "right" | "top" | "bottom";
}

export interface NodeDefinition {
  id: string;
  /** Unique across the library. */
  name: string;
  /** Lucide icon name, or "custom:<id>" for user-saved images. */
  icon: string;
  /** Which C4 layers this definition may be placed on. Non-empty. */
  layers: Layer[];
  pips: PipDef[];
  /** Canvas depicting this component's internals, if any. Shared by reference. */
  canvasId: string | null;
  /** True when this definition came from collapsing a container. */
  expandable?: boolean;
  /** For collapsed boundaries: which inner node/pip each inherited pip maps to. */
  pipMap?: Record<string, RelEnd>;
  /** Original container size, restored on expansion. */
  sourceSize?: { width: number; height: number };
}

export interface Boundary {
  id: string;
  name: string;
  icon: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface NodeInstance {
  id: string;
  definitionId: string;
  x: number;
  y: number;
}

export interface RelEnd {
  nodeId: string;
  pipId: string;
}

export interface Relationship {
  id: string;
  typeId: string;
  /** Normalized so `from` is the outbound side when the link is directional. */
  from: RelEnd;
  to: RelEnd;
}

export interface CanvasData {
  id: string;
  /** C4 decomposition level of this canvas. Root is "context". */
  layer: Layer;
  nodes: NodeInstance[];
  relationships: Relationship[];
  boundaries: Boundary[];
}

export interface Viewport {
  x: number;
  y: number;
  scale: number;
}

export const NODE_WIDTH = 120;
export const NODE_HEIGHT = 96;
