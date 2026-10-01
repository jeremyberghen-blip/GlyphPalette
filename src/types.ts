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

/**
 * Layers new work can be drawn on. "code" is retired (Hephaestus owns
 * function-level structure) but stays in `Layer` so older files still load
 * and their Code canvases stay editable.
 */
export const DRAWABLE_LAYERS: readonly Layer[] = ["context", "container", "component"];

export const LAYER_LABELS: Record<Layer, string> = {
  context: "Context",
  container: "Container",
  component: "Component",
  code: "Code",
};

export const isRetiredLayer = (l: Layer): boolean => l === "code";

/**
 * The layer one step deeper. Clamps at "component" — Component nodes nest
 * Component canvases. A legacy Code canvas's children stay Code.
 */
export function nextLayer(l: Layer): Layer {
  if (l === "code") return "code";
  const i = DRAWABLE_LAYERS.indexOf(l);
  return DRAWABLE_LAYERS[Math.min(i + 1, DRAWABLE_LAYERS.length - 1)];
}

/**
 * How a connection's bytes travel — HTTP, TCP, a message queue, in-process
 * calls. Drawn as a pip's outer circle and a wire's outer line.
 */
export interface Transport {
  id: string;
  name: string;
  color: string;
  /** Layers this transport is usual on — a hint for the node dialog, never a restriction. */
  layers?: Layer[];
  /** The style a new pip on this transport starts with (e.g. HTTP → REST/JSON). */
  defaultStyle?: string;
}

/**
 * What a connection's bytes mean — REST/JSON, SQL, events. Drawn as a pip's
 * inner circle and a wire's core. `ANY_STYLE` means pass-through: no core.
 */
export interface ApiStyle {
  id: string;
  name: string;
  color: string;
  /** Transports this style usually rides on — a hint for the node dialog. */
  transports?: string[];
}

export const ANY_STYLE = "s-any";

export interface PipDef {
  id: string;
  label: string;
  transportId: string;
  styleId: string;
  direction: PipDirection;
  /** Which side of the node the pip sits on. */
  side: "left" | "right" | "top" | "bottom";
  /**
   * Deleted from its definition while wires still used it: kept (drawn red,
   * broken) until those wires are removed, then dropped.
   */
  removed?: boolean;
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
  /**
   * True when this definition came from collapsing a boundary. Its canvas is
   * a *pocket*: a same-layer fold, not a deeper level (see lib/layers.ts).
   */
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

/**
 * A bend point on a wire: a short straight section pivoting on (x, y).
 * See lib/waypoints.ts.
 */
export interface Waypoint {
  x: number;
  y: number;
  /** Direction of the straight section, in radians (0 = +x, clockwise on screen). */
  angle: number;
  /** How far the section runs either side of (x, y); 0 is a plain corner. */
  half: number;
}

export interface Relationship {
  id: string;
  /**
   * The connection type the wire carried when it was drawn. A wire is broken
   * when either end pip no longer matches it (or was deleted).
   */
  transportId: string;
  styleId: string;
  /** Normalized so `from` is the outbound side when the link is directional. */
  from: RelEnd;
  to: RelEnd;
  /** Bend points, in order from `from` to `to`. Absent on a plain curved wire. */
  waypoints?: Waypoint[];
  /**
   * Bend points folded away inside collapsed boundaries this wire crosses,
   * keyed by the collapsed node's instance id, in that pocket's coordinates.
   * Restored when the node expands. See lib/waypoints.ts.
   */
  foldedWaypoints?: Record<string, Waypoint[]>;
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
