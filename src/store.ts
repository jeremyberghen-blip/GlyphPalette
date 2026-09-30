import { create } from "zustand";
import {
  CanvasData,
  Boundary,
  Layer,
  NodeDefinition,
  NodeInstance,
  PipDef,
  PipType,
  RelEnd,
  Relationship,
  Viewport,
  NODE_WIDTH,
  NODE_HEIGHT,
} from "./types";
import { canConnect, offsetToCenter } from "./lib/graph";
import { childLayer } from "./lib/layers";
import { STANDARD, isStandardDef } from "./lib/standardLibrary";
import { copyDefinition, incrementName, nameTaken, uniqueName } from "./lib/definitions";
import { ImportPlan } from "./lib/importDefs";
import { uid } from "./lib/ids";

export { nameTaken } from "./lib/definitions";
export { uid } from "./lib/ids";

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const nodeRect = (n: NodeInstance): Rect => ({
  x: n.x,
  y: n.y,
  width: NODE_WIDTH,
  height: NODE_HEIGHT,
});

export const rectsIntersect = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.width &&
  a.x + a.width > b.x &&
  a.y < b.y + b.height &&
  a.y + a.height > b.y;

// ---- Fresh project ----
//
// Definitions and pip types are the read-only standard library
// (lib/standardLibrary.ts) plus the project's own. A fresh project is a
// Context canvas holding one System node to decompose — the project's own
// copy, since standard nodes can't be renamed or given pips.

function freshProject(): Pick<AppState, "pipTypes" | "definitions" | "customIcons" | "canvases"> {
  const system: NodeDefinition = {
    ...structuredClone(STANDARD.definitions["def-system"]),
    id: `def-${uid()}`,
    name: "My System",
  };
  const root: CanvasData = {
    id: "canvas-root",
    layer: "context",
    nodes: [{ id: uid(), definitionId: system.id, x: -NODE_WIDTH / 2, y: -NODE_HEIGHT / 2 }],
    relationships: [],
    boundaries: [],
  };
  return {
    pipTypes: structuredClone(STANDARD.pipTypes),
    definitions: { ...structuredClone(STANDARD.definitions), [system.id]: system },
    customIcons: {},
    canvases: { [root.id]: root },
  };
}

// ---- Undo snapshots ----

export interface Snapshot {
  canvases: Record<string, CanvasData>;
  definitions: Record<string, NodeDefinition>;
  pipTypes: Record<string, PipType>;
  customIcons: Record<string, string>;
  activeCanvasId: string;
  trail: string[];
}

const UNDO_CAP = 50;

/** Returns a new undo stack with the current state appended. */
function pushSnap(s: {
  undoStack: Snapshot[];
  canvases: Record<string, CanvasData>;
  definitions: Record<string, NodeDefinition>;
  pipTypes: Record<string, PipType>;
  customIcons: Record<string, string>;
  activeCanvasId: string;
  trail: string[];
}): Snapshot[] {
  const snap: Snapshot = structuredClone({
    canvases: s.canvases,
    definitions: s.definitions,
    pipTypes: s.pipTypes,
    customIcons: s.customIcons,
    activeCanvasId: s.activeCanvasId,
    trail: s.trail,
  });
  const stack = [...s.undoStack, snap];
  if (stack.length > UNDO_CAP) stack.shift();
  return stack;
}

// ---- Clipboard (module-level, app-global, in-memory only) ----

interface ClipboardData {
  nodes: NodeInstance[];
  boundaries: Boundary[];
  relationships: Relationship[];
}
let clipboard: ClipboardData | null = null;
let pasteCount = 0;

// ---- Last cursor position on the canvas (world coords; not reactive) ----

let pointerWorld: { x: number; y: number } | null = null;
export const setPointerWorld = (p: { x: number; y: number } | null) => {
  pointerWorld = p;
};
export const getPointerWorld = () => pointerWorld;

// ---- Wire drag (relationship being pulled from a pip) ----

export interface WireDrag {
  fromNodeId: string;
  fromPipId: string;
  /** Cursor position in world coordinates. */
  cursor: { x: number; y: number };
  /** Compatible pip currently within snap range, if any. */
  snap: { nodeId: string; pipId: string } | null;
}

interface AppState {
  pipTypes: Record<string, PipType>;
  /**
   * Standard-library definitions (read-only; see isStandardDef) plus the
   * project's own. A standard definition's `canvasId` may be set in-project
   * when the user draws its interior.
   */
  definitions: Record<string, NodeDefinition>;
  /** User-uploaded icon images, id → data URL. Referenced as icon "custom:<id>". */
  customIcons: Record<string, string>;
  canvases: Record<string, CanvasData>;
  activeCanvasId: string;
  /** Canvas ids from root to the active canvas (breadcrumb path). */
  trail: string[];
  /** Per-canvas saved viewports; canvases start centered via App. */
  viewports: Record<string, Viewport>;
  viewport: Viewport;
  selection: string[]; // node instance ids and relationship ids on the active canvas
  /** Definition id currently being placed (ghost follows cursor), or null. */
  placingDefId: string | null;
  wireDrag: WireDrag | null;
  /** True while the user is drawing a new boundary box. */
  boundaryDrawing: boolean;
  /** Drawn box waiting for the name/icon dialog to confirm it. */
  pendingBoundaryRect: Rect | null;
  /** Snapshots for Ctrl+Z, newest last. Capped at 50. */
  undoStack: Snapshot[];

  /** Records the current graph state; call before a mutating gesture begins. */
  pushUndo: () => void;
  undo: () => void;
  copySelection: () => void;
  paste: () => void;
  /** Resets to a fresh project. */
  newProject: () => void;

  setPlacing: (defId: string | null) => void;
  setViewport: (v: Viewport) => void;
  setSelection: (ids: string[]) => void;
  addToSelection: (ids: string[]) => void;
  toggleSelected: (id: string) => void;
  moveNodes: (moves: { id: string; x: number; y: number }[]) => void;
  addNode: (definitionId: string, x: number, y: number) => void;
  deleteSelection: () => void;

  startWire: (nodeId: string, pipId: string, cursor: { x: number; y: number }) => void;
  updateWire: (cursor: { x: number; y: number }, snap: WireDrag["snap"]) => void;
  /** Completes the wire if snapped to a valid pip; always clears drag state. */
  endWire: () => void;

  setBoundaryDrawing: (on: boolean) => void;
  setPendingBoundaryRect: (r: Rect | null) => void;
  addBoundary: (name: string, icon: string, rect: Rect) => void;
  moveBoundaries: (moves: { id: string; x: number; y: number }[]) => void;
  resizeBoundary: (id: string, rect: Rect) => void;
  /** Collapses a boundary into a library-backed node with inherited pips. */
  collapseBoundary: (boundaryId: string) => void;
  /** Expands a collapsed-boundary node back onto the current canvas. */
  expandNode: (instanceId: string) => void;

  /** Opens a definition's inner canvas, creating an empty one on first entry. */
  enterDefinition: (defId: string) => void;
  goBack: () => void;
  /** Jump to a breadcrumb entry by index in the trail. */
  jumpTo: (trailIndex: number) => void;
  /** Navigate to an explicit canvas path (from the nav tree), optionally selecting a node. */
  navigateTo: (trail: string[], selectNodeId?: string) => void;

  /** Adds a custom pip type, usual on `layers` (see lib/pipTypes). Returns its id. */
  addPipType: (name: string, color: string, layers?: Layer[]) => string;
  addCustomIcon: (dataUrl: string) => string;
  /**
   * Adds or replaces a project definition. Caller must have validated name
   * uniqueness. Standard definitions are read-only and are ignored.
   */
  saveDefinition: (def: NodeDefinition) => void;
  /** Deletes a project definition; only valid when no instance uses it. */
  removeDefinition: (defId: string) => void;
  /** Adds definitions (and the pip types / icons they need) planned by lib/importDefs. */
  importDefinitions: (plan: ImportPlan) => void;
  /**
   * Adds an independent copy of a definition with the next numbered name
   * ("Link Service 2") and an empty interior. Returns the new id.
   */
  duplicateDefinition: (defId: string) => string | null;
  /**
   * Ctrl+D: gives each selected node a duplicated definition and places the
   * copies centered on `at` (or just offset, with no cursor), keeping their
   * layout and the wires between them. Collapsed groups are skipped.
   */
  duplicateSelection: (at: { x: number; y: number } | null) => void;
}

/** Looks up a pip definition from a node instance id. */
export function getPip(
  s: Pick<AppState, "canvases" | "activeCanvasId" | "definitions">,
  nodeId: string,
  pipId: string
): PipDef | null {
  const node = s.canvases[s.activeCanvasId].nodes.find((n) => n.id === nodeId);
  if (!node) return null;
  return s.definitions[node.definitionId]?.pips.find((p) => p.id === pipId) ?? null;
}

export const useApp = create<AppState>((set, get) => ({
  ...freshProject(),
  activeCanvasId: "canvas-root",
  trail: ["canvas-root"],
  viewports: {},
  viewport: { x: 0, y: 0, scale: 1 },
  selection: [],
  placingDefId: null,
  wireDrag: null,
  boundaryDrawing: false,
  pendingBoundaryRect: null,
  undoStack: [],

  pushUndo: () => set((s) => ({ undoStack: pushSnap(s) })),

  undo: () =>
    set((s) => {
      const stack = [...s.undoStack];
      const snap = stack.pop();
      if (!snap) return {};
      return {
        ...snap,
        undoStack: stack,
        selection: [],
        placingDefId: null,
        wireDrag: null,
        boundaryDrawing: false,
        pendingBoundaryRect: null,
      };
    }),

  copySelection: () =>
    set((s) => {
      const canvas = s.canvases[s.activeCanvasId];
      const sel = new Set(s.selection);
      const nodes = canvas.nodes.filter((n) => sel.has(n.id));
      const boundaries = canvas.boundaries.filter((c) => sel.has(c.id));
      if (nodes.length === 0 && boundaries.length === 0) return {};
      const nodeIds = new Set(nodes.map((n) => n.id));
      const relationships = canvas.relationships.filter(
        (r) => nodeIds.has(r.from.nodeId) && nodeIds.has(r.to.nodeId)
      );
      clipboard = structuredClone({ nodes, boundaries, relationships });
      pasteCount = 0;
      return {};
    }),

  paste: () =>
    set((s) => {
      if (!clipboard) return {};
      pasteCount++;
      const off = 20 * pasteCount;
      const canvas = s.canvases[s.activeCanvasId];
      const idMap = new Map<string, string>();
      const nodes: NodeInstance[] = clipboard.nodes.map((n) => {
        const id = uid();
        idMap.set(n.id, id);
        return { ...n, id, x: n.x + off, y: n.y + off };
      });
      const boundaries: Boundary[] = clipboard.boundaries.map((c) => {
        const id = uid();
        idMap.set(c.id, id);
        return { ...c, id, x: c.x + off, y: c.y + off };
      });
      const relationships: Relationship[] = clipboard.relationships.map((r) => ({
        ...r,
        id: uid(),
        from: { ...r.from, nodeId: idMap.get(r.from.nodeId)! },
        to: { ...r.to, nodeId: idMap.get(r.to.nodeId)! },
      }));
      return {
        undoStack: pushSnap(s),
        canvases: {
          ...s.canvases,
          [canvas.id]: {
            ...canvas,
            nodes: [...canvas.nodes, ...nodes],
            boundaries: [...canvas.boundaries, ...boundaries],
            relationships: [...canvas.relationships, ...relationships],
          },
        },
        selection: [...nodes.map((n) => n.id), ...boundaries.map((c) => c.id)],
      };
    }),

  newProject: () =>
    set(() => {
      return {
        ...freshProject(),
        activeCanvasId: "canvas-root",
        trail: ["canvas-root"],
        viewports: {},
        selection: [],
        placingDefId: null,
        wireDrag: null,
        boundaryDrawing: false,
        pendingBoundaryRect: null,
        undoStack: [],
      };
    }),

  setBoundaryDrawing: (boundaryDrawing) =>
    set({ boundaryDrawing, placingDefId: null }),
  setPendingBoundaryRect: (pendingBoundaryRect) => set({ pendingBoundaryRect }),

  addBoundary: (name, icon, rect) =>
    set((s) => {
      const canvas = s.canvases[s.activeCanvasId];
      const c: Boundary = { id: uid(), name, icon, ...rect };
      return {
        undoStack: pushSnap(s),
        canvases: {
          ...s.canvases,
          [canvas.id]: { ...canvas, boundaries: [...canvas.boundaries, c] },
        },
        pendingBoundaryRect: null,
        selection: [c.id],
      };
    }),

  moveBoundaries: (moves) =>
    set((s) => {
      const canvas = s.canvases[s.activeCanvasId];
      const byId = new Map(moves.map((m) => [m.id, m]));
      const boundaries = canvas.boundaries.map((c) => {
        const m = byId.get(c.id);
        return m ? { ...c, x: m.x, y: m.y } : c;
      });
      return { canvases: { ...s.canvases, [canvas.id]: { ...canvas, boundaries } } };
    }),

  resizeBoundary: (id, rect) =>
    set((s) => {
      const canvas = s.canvases[s.activeCanvasId];
      const boundaries = canvas.boundaries.map((c) =>
        c.id === id ? { ...c, ...rect } : c
      );
      return { canvases: { ...s.canvases, [canvas.id]: { ...canvas, boundaries } } };
    }),

  collapseBoundary: (boundaryId) =>
    set((s) => {
      const canvas = s.canvases[s.activeCanvasId];
      const box = canvas.boundaries.find((c) => c.id === boundaryId);
      if (!box) return {};

      const inside = new Set(
        canvas.nodes.filter((n) => rectsIntersect(nodeRect(n), box)).map((n) => n.id)
      );
      const innerRels = canvas.relationships.filter(
        (r) => inside.has(r.from.nodeId) && inside.has(r.to.nodeId)
      );
      const boundaryRels = canvas.relationships.filter(
        (r) => inside.has(r.from.nodeId) !== inside.has(r.to.nodeId)
      );

      // One inherited pip per distinct inner pip that crosses the boundary
      const pipMap: Record<string, RelEnd> = {};
      const newPips: PipDef[] = [];
      const innerEndToNewPip = new Map<string, string>(); // "nodeId|pipId" → new pip id
      for (const r of boundaryRels) {
        const innerEnd = inside.has(r.from.nodeId) ? r.from : r.to;
        const key = `${innerEnd.nodeId}|${innerEnd.pipId}`;
        if (innerEndToNewPip.has(key)) continue;
        const innerPip = getPip(s, innerEnd.nodeId, innerEnd.pipId);
        if (!innerPip) continue;
        const newId = `pip-${uid()}`;
        innerEndToNewPip.set(key, newId);
        pipMap[newId] = { ...innerEnd };
        newPips.push({ ...innerPip, id: newId });
      }

      // Unique library name: "Name", "Name 2", "Name 3", …
      const name = uniqueName(box.name.trim() || "Boundary", (n) => nameTaken(s.definitions, n));

      const innerCanvas: CanvasData = {
        id: `canvas-${uid()}`,
        layer: canvas.layer, // a pocket: same layer, just folded away
        nodes: canvas.nodes.filter((n) => inside.has(n.id)),
        relationships: innerRels,
        boundaries: [],
      };
      const def: NodeDefinition = {
        id: `def-${uid()}`,
        name,
        icon: box.icon,
        layers: [canvas.layer],
        pips: newPips,
        canvasId: innerCanvas.id,
        expandable: true,
        pipMap,
        sourceSize: { width: box.width, height: box.height },
      };
      const instance: NodeInstance = {
        id: uid(),
        definitionId: def.id,
        x: box.x + box.width / 2 - NODE_WIDTH / 2,
        y: box.y + box.height / 2 - NODE_HEIGHT / 2,
      };

      const relationships = canvas.relationships
        .filter((r) => !innerRels.includes(r))
        .map((r) => {
          const fromInside = inside.has(r.from.nodeId);
          const toInside = inside.has(r.to.nodeId);
          if (!fromInside && !toInside) return r;
          const end = fromInside ? r.from : r.to;
          const newPipId = innerEndToNewPip.get(`${end.nodeId}|${end.pipId}`);
          if (!newPipId) return r;
          const newEnd: RelEnd = { nodeId: instance.id, pipId: newPipId };
          return fromInside ? { ...r, from: newEnd } : { ...r, to: newEnd };
        });

      return {
        undoStack: pushSnap(s),
        definitions: { ...s.definitions, [def.id]: def },
        canvases: {
          ...s.canvases,
          [innerCanvas.id]: innerCanvas,
          [canvas.id]: {
            ...canvas,
            nodes: [...canvas.nodes.filter((n) => !inside.has(n.id)), instance],
            relationships,
            boundaries: canvas.boundaries.filter((c) => c.id !== boundaryId),
          },
        },
        selection: [instance.id],
      };
    }),

  expandNode: (instanceId) =>
    set((s) => {
      const canvas = s.canvases[s.activeCanvasId];
      const instance = canvas.nodes.find((n) => n.id === instanceId);
      if (!instance) return {};
      const def = s.definitions[instance.definitionId];
      if (!def?.expandable || !def.canvasId || !def.pipMap) return {};
      const inner = s.canvases[def.canvasId];
      if (!inner) return {};

      const size = def.sourceSize ?? { width: 400, height: 300 };
      const cx = instance.x + NODE_WIDTH / 2;
      const cy = instance.y + NODE_HEIGHT / 2;
      const box: Boundary = {
        id: uid(),
        name: def.name,
        icon: def.icon,
        x: cx - size.width / 2,
        y: cy - size.height / 2,
        width: size.width,
        height: size.height,
      };

      // Clone inner nodes with fresh ids, shifted so their bbox centers on the instance
      const idMap = new Map<string, string>();
      let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
      for (const n of inner.nodes) {
        bx0 = Math.min(bx0, n.x);
        by0 = Math.min(by0, n.y);
        bx1 = Math.max(bx1, n.x + NODE_WIDTH);
        by1 = Math.max(by1, n.y + NODE_HEIGHT);
      }
      const dx = inner.nodes.length ? cx - (bx0 + bx1) / 2 : 0;
      const dy = inner.nodes.length ? cy - (by0 + by1) / 2 : 0;
      const clones: NodeInstance[] = inner.nodes.map((n) => {
        const id = uid();
        idMap.set(n.id, id);
        return { ...n, id, x: n.x + dx, y: n.y + dy };
      });
      const clonedRels: Relationship[] = inner.relationships.map((r) => ({
        ...r,
        id: uid(),
        from: { ...r.from, nodeId: idMap.get(r.from.nodeId) ?? r.from.nodeId },
        to: { ...r.to, nodeId: idMap.get(r.to.nodeId) ?? r.to.nodeId },
      }));

      // Rewire boundary relationships from the instance's pips to the inner nodes
      const relationships = canvas.relationships.map((r) => {
        const remap = (end: RelEnd): RelEnd => {
          if (end.nodeId !== instanceId) return end;
          const target = def.pipMap![end.pipId];
          if (!target) return end;
          return {
            nodeId: idMap.get(target.nodeId) ?? target.nodeId,
            pipId: target.pipId,
          };
        };
        return { ...r, from: remap(r.from), to: remap(r.to) };
      });

      // Drop the definition (and its canvas) if this was the only instance anywhere
      const usedElsewhere = Object.values(s.canvases).some((c) =>
        c.nodes.some((n) => n.definitionId === def.id && n.id !== instanceId)
      );
      const definitions = { ...s.definitions };
      const canvases = { ...s.canvases };
      if (!usedElsewhere) {
        delete definitions[def.id];
        delete canvases[def.canvasId];
      }

      canvases[canvas.id] = {
        ...canvas,
        nodes: [...canvas.nodes.filter((n) => n.id !== instanceId), ...clones],
        relationships: [...relationships, ...clonedRels],
        boundaries: [...canvas.boundaries, box],
      };
      return { undoStack: pushSnap(s), definitions, canvases, selection: [box.id] };
    }),

  setPlacing: (placingDefId) => set({ placingDefId, boundaryDrawing: false }),
  setViewport: (viewport) =>
    set((s) => ({
      viewport,
      viewports: { ...s.viewports, [s.activeCanvasId]: viewport },
    })),

  enterDefinition: (defId) =>
    set((s) => {
      const def = s.definitions[defId];
      if (!def) return {};
      let canvasId = def.canvasId;
      let definitions = s.definitions;
      let canvases = s.canvases;
      if (!canvasId) {
        const parent = s.canvases[s.activeCanvasId];
        canvasId = `canvas-${uid()}`;
        canvases = {
          ...canvases,
          [canvasId]: {
            id: canvasId,
            layer: childLayer(parent?.layer ?? "container", def),
            nodes: [],
            relationships: [],
            boundaries: [],
          },
        };
        // A standard node's interior belongs to this project; the file keeps
        // it in `standardInteriors`.
        definitions = {
          ...definitions,
          [defId]: { ...def, canvasId },
        };
      }
      if (s.trail.includes(canvasId)) return {}; // no cycles into an ancestor
      return {
        definitions,
        canvases,
        activeCanvasId: canvasId,
        trail: [...s.trail, canvasId],
        viewport: s.viewports[canvasId] ?? s.viewport,
        selection: [],
        placingDefId: null,
        wireDrag: null,
      };
    }),

  goBack: () =>
    set((s) => {
      if (s.trail.length <= 1) return {};
      const trail = s.trail.slice(0, -1);
      const activeCanvasId = trail[trail.length - 1];
      return {
        trail,
        activeCanvasId,
        viewport: s.viewports[activeCanvasId] ?? s.viewport,
        selection: [],
        placingDefId: null,
        wireDrag: null,
      };
    }),

  jumpTo: (trailIndex) =>
    set((s) => {
      if (trailIndex < 0 || trailIndex >= s.trail.length - 1) return {};
      const trail = s.trail.slice(0, trailIndex + 1);
      const activeCanvasId = trail[trail.length - 1];
      return {
        trail,
        activeCanvasId,
        viewport: s.viewports[activeCanvasId] ?? s.viewport,
        selection: [],
        placingDefId: null,
        wireDrag: null,
      };
    }),

  navigateTo: (trail, selectNodeId) =>
    set((s) => {
      const activeCanvasId = trail[trail.length - 1];
      if (!s.canvases[activeCanvasId]) return {};
      return {
        trail,
        activeCanvasId,
        viewport: s.viewports[activeCanvasId] ?? s.viewport,
        selection: selectNodeId ? [selectNodeId] : [],
        placingDefId: null,
        wireDrag: null,
      };
    }),
  setSelection: (selection) => set({ selection }),
  addToSelection: (ids) =>
    set((s) => ({ selection: [...new Set([...s.selection, ...ids])] })),
  toggleSelected: (id) =>
    set((s) => ({
      selection: s.selection.includes(id)
        ? s.selection.filter((x) => x !== id)
        : [...s.selection, id],
    })),

  moveNodes: (moves) =>
    set((s) => {
      const canvas = s.canvases[s.activeCanvasId];
      const byId = new Map(moves.map((m) => [m.id, m]));
      const nodes = canvas.nodes.map((n) => {
        const m = byId.get(n.id);
        return m ? { ...n, x: m.x, y: m.y } : n;
      });
      return {
        canvases: { ...s.canvases, [canvas.id]: { ...canvas, nodes } },
      };
    }),

  addNode: (definitionId, x, y) =>
    set((s) => {
      const canvas = s.canvases[s.activeCanvasId];
      const node: NodeInstance = { id: uid(), definitionId, x, y };
      return {
        undoStack: pushSnap(s),
        canvases: {
          ...s.canvases,
          [canvas.id]: { ...canvas, nodes: [...canvas.nodes, node] },
        },
        selection: [node.id],
      };
    }),

  deleteSelection: () =>
    set((s) => {
      const canvas = s.canvases[s.activeCanvasId];
      const sel = new Set(s.selection);
      const nodes = canvas.nodes.filter((n) => !sel.has(n.id));
      const gone = new Set(
        canvas.nodes.filter((n) => sel.has(n.id)).map((n) => n.id)
      );
      // Drop relationships that were selected or attached to a deleted node
      const relationships = canvas.relationships.filter(
        (r) =>
          !sel.has(r.id) && !gone.has(r.from.nodeId) && !gone.has(r.to.nodeId)
      );
      const boundaries = canvas.boundaries.filter((c) => !sel.has(c.id));
      if (sel.size === 0) return {};
      return {
        undoStack: pushSnap(s),
        canvases: {
          ...s.canvases,
          [canvas.id]: { ...canvas, nodes, relationships, boundaries },
        },
        selection: [],
      };
    }),

  startWire: (fromNodeId, fromPipId, cursor) =>
    set({ wireDrag: { fromNodeId, fromPipId, cursor, snap: null }, selection: [] }),

  updateWire: (cursor, snap) =>
    set((s) => (s.wireDrag ? { wireDrag: { ...s.wireDrag, cursor, snap } } : {})),

  endWire: () =>
    set((s) => {
      const wd = s.wireDrag;
      if (!wd) return {};
      if (!wd.snap) return { wireDrag: null };
      const fromPip = getPip(s, wd.fromNodeId, wd.fromPipId);
      const toPip = getPip(s, wd.snap.nodeId, wd.snap.pipId);
      if (!fromPip || !toPip || !canConnect(fromPip, toPip)) {
        return { wireDrag: null };
      }
      // Normalize direction: `from` is the outbound side of a directional link
      let from = { nodeId: wd.fromNodeId, pipId: wd.fromPipId };
      let to = { nodeId: wd.snap.nodeId, pipId: wd.snap.pipId };
      if (fromPip.direction === "inbound") [from, to] = [to, from];

      const canvas = s.canvases[s.activeCanvasId];
      // No duplicate wires between the same two pips
      const dup = canvas.relationships.some(
        (r) =>
          (r.from.pipId === from.pipId && r.to.pipId === to.pipId && r.from.nodeId === from.nodeId && r.to.nodeId === to.nodeId) ||
          (r.from.pipId === to.pipId && r.to.pipId === from.pipId && r.from.nodeId === to.nodeId && r.to.nodeId === from.nodeId)
      );
      if (dup) return { wireDrag: null };

      const rel: Relationship = { id: uid(), typeId: fromPip.typeId, from, to };
      return {
        undoStack: pushSnap(s),
        wireDrag: null,
        canvases: {
          ...s.canvases,
          [canvas.id]: {
            ...canvas,
            relationships: [...canvas.relationships, rel],
          },
        },
        selection: [rel.id],
      };
    }),
  addPipType: (name, color, layers) => {
    const id = `t-${uid()}`;
    const type: PipType = { id, name, color, ...(layers?.length ? { layers } : {}) };
    set((s) => ({ pipTypes: { ...s.pipTypes, [id]: type } }));
    return id;
  },

  addCustomIcon: (dataUrl) => {
    const id = uid();
    set((s) => ({ customIcons: { ...s.customIcons, [id]: dataUrl } }));
    return id;
  },

  saveDefinition: (def) =>
    set((s) => {
      if (isStandardDef(def.id)) return {};
      // Pips may have been removed on edit — drop relationships that
      // reference a pip that no longer exists on this definition.
      const pipIds = new Set(def.pips.map((p) => p.id));
      const canvases = Object.fromEntries(
        Object.entries(s.canvases).map(([cid, c]) => {
          const instanceIds = new Set(
            c.nodes.filter((n) => n.definitionId === def.id).map((n) => n.id)
          );
          const relationships = c.relationships.filter((r) => {
            const fromGone =
              instanceIds.has(r.from.nodeId) && !pipIds.has(r.from.pipId);
            const toGone =
              instanceIds.has(r.to.nodeId) && !pipIds.has(r.to.pipId);
            return !fromGone && !toGone;
          });
          return [cid, { ...c, relationships }];
        })
      );
      return {
        undoStack: pushSnap(s),
        definitions: { ...s.definitions, [def.id]: { ...def, layers: def.layers?.length ? def.layers : (["container"] as Layer[]) } },
        canvases,
      };
    }),

  removeDefinition: (defId) =>
    set((s) => {
      if (isStandardDef(defId)) return {};
      const inUse = Object.values(s.canvases).some((c) =>
        c.nodes.some((n) => n.definitionId === defId)
      );
      if (inUse) return {};
      const definitions = { ...s.definitions };
      delete definitions[defId];
      return {
        undoStack: pushSnap(s),
        definitions,
        placingDefId: s.placingDefId === defId ? null : s.placingDefId,
      };
    }),

  duplicateDefinition: (defId) => {
    const s = get();
    const src = s.definitions[defId];
    if (!src || src.expandable) return null;
    const def = copyDefinition(
      src,
      `def-${uid()}`,
      incrementName(src.name, (n) => nameTaken(s.definitions, n))
    );
    set({ undoStack: pushSnap(s), definitions: { ...s.definitions, [def.id]: def } });
    return def.id;
  },

  duplicateSelection: (at) =>
    set((s) => {
      const canvas = s.canvases[s.activeCanvasId];
      const sel = new Set(s.selection);
      const picked = canvas.nodes.filter(
        (n) => sel.has(n.id) && s.definitions[n.definitionId] && !s.definitions[n.definitionId].expandable
      );
      if (!picked.length) return {};

      const definitions = { ...s.definitions };
      const { dx, dy } = at ? offsetToCenter(picked, at) : { dx: 40, dy: 40 };
      const idMap = new Map<string, string>();
      const nodes: NodeInstance[] = picked.map((n) => {
        const src = definitions[n.definitionId];
        const def = copyDefinition(
          src,
          `def-${uid()}`,
          incrementName(src.name, (name) => nameTaken(definitions, name))
        );
        definitions[def.id] = def;
        const id = uid();
        idMap.set(n.id, id);
        return { id, definitionId: def.id, x: n.x + dx, y: n.y + dy };
      });
      // Wires between duplicated nodes come along; pip ids carry over with the copies
      const relationships: Relationship[] = canvas.relationships
        .filter((r) => idMap.has(r.from.nodeId) && idMap.has(r.to.nodeId))
        .map((r) => ({
          ...r,
          id: uid(),
          from: { ...r.from, nodeId: idMap.get(r.from.nodeId)! },
          to: { ...r.to, nodeId: idMap.get(r.to.nodeId)! },
        }));
      return {
        undoStack: pushSnap(s),
        definitions,
        canvases: {
          ...s.canvases,
          [canvas.id]: {
            ...canvas,
            nodes: [...canvas.nodes, ...nodes],
            relationships: [...canvas.relationships, ...relationships],
          },
        },
        selection: nodes.map((n) => n.id),
      };
    }),

  importDefinitions: (plan) =>
    set((s) => {
      if (!plan.definitions.length) return {};
      const definitions = { ...s.definitions };
      for (const d of plan.definitions) definitions[d.id] = d;
      const pipTypes = { ...s.pipTypes };
      for (const t of plan.pipTypes) pipTypes[t.id] ??= t;
      return {
        undoStack: pushSnap(s),
        definitions,
        pipTypes,
        customIcons: { ...s.customIcons, ...plan.customIcons },
      };
    }),
}));

/** Display label for a canvas: owning definition's name, or "Root". */
export function canvasLabel(
  s: { definitions: Record<string, NodeDefinition> },
  canvasId: string
): string {
  if (canvasId === "canvas-root") return "Root";
  return (
    Object.values(s.definitions).find((d) => d.canvasId === canvasId)?.name ??
    "Canvas"
  );
}

export const useActiveCanvas = () =>
  useApp((s) => s.canvases[s.activeCanvasId]);
