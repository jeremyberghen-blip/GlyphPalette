import { create } from "zustand";
import {
  CanvasData,
  Boundary,
  Layer,
  NodeDefinition,
  NodeInstance,
  PipDef,
  Transport,
  ApiStyle,
  RelEnd,
  Relationship,
  Viewport,
  Waypoint,
  NODE_WIDTH,
  NODE_HEIGHT,
} from "./types";
import { canConnect, offsetToCenter, pipWorldPos } from "./lib/graph";
import { wireType } from "./lib/connections";
import { instanceDef, keepWiredPips, pruneRemovedPips } from "./lib/broken";
import { canPlacePort, isPortDefId, portDefinition, resolveDef } from "./lib/ports";
import { canvasOwner, childLayer, isPocket } from "./lib/layers";
import { useMemo } from "react";
import {
  addWaypoint,
  applyHandle,
  foldWaypoints,
  remapFoldedKeys,
  translateWaypoints,
  unfoldWaypoints,
} from "./lib/waypoints";
import { STANDARD, isStandardDef } from "./lib/standardLibrary";
import { copyDefinition, incrementName, nameTaken, uniqueName } from "./lib/definitions";
import { ImportPlan } from "./lib/importDefs";
import { uid } from "./lib/ids";
import { ContentRefs, DEFAULT_PROJECT_NAME, contentRefs } from "./lib/session";
import { normalizeOverride } from "./lib/paths";

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

function freshProject(): Pick<AppState, "transports" | "styles" | "definitions" | "customIcons" | "canvases"> {
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
    transports: structuredClone(STANDARD.transports),
    styles: structuredClone(STANDARD.styles),
    definitions: { ...structuredClone(STANDARD.definitions), [system.id]: system },
    customIcons: {},
    canvases: { [root.id]: root },
  };
}

// ---- Undo snapshots ----

export interface Snapshot {
  canvases: Record<string, CanvasData>;
  definitions: Record<string, NodeDefinition>;
  transports: Record<string, Transport>;
  styles: Record<string, ApiStyle>;
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
  transports: Record<string, Transport>;
  styles: Record<string, ApiStyle>;
  customIcons: Record<string, string>;
  activeCanvasId: string;
  trail: string[];
}): Snapshot[] {
  const snap: Snapshot = structuredClone({
    canvases: s.canvases,
    definitions: s.definitions,
    transports: s.transports,
    styles: s.styles,
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
  /** The project's name, saved in the file; its build folder is named after it (lib/paths.ts). */
  projectName: string;
  /** Connection transports (standard + the project's own). See lib/connections.ts. */
  transports: Record<string, Transport>;
  /** Connection API styles (standard + the project's own). */
  styles: Record<string, ApiStyle>;
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
  /** The waypoint whose rotation handle is showing (its wire is selected), if any. */
  selectedWaypoint: { relId: string; index: number } | null;
  /** Where the open project is saved; null until its first save (Tauri only). */
  filePath: string | null;
  /** Content as of the last save/open/new — compared by reference to detect unsaved changes. */
  savedRefs: ContentRefs;
  /** When the project was last saved/opened/created (ms), for autosave timing. */
  savedAt: number;

  /** Records the current graph state; call before a mutating gesture begins. */
  pushUndo: () => void;
  undo: () => void;
  copySelection: () => void;
  paste: () => void;
  /** Resets to a fresh, untitled project. */
  /** Starts over with a fresh project called `name`. */
  newProject: (name?: string) => void;
  setProjectName: (name: string) => void;
  /**
   * Sets where a node on the active canvas builds — a full path from the
   * project folder — or clears it (null or blank) back to the derived path.
   */
  setPathOverride: (nodeId: string, path: string | null) => void;
  /** Records the current content as saved (at `filePath`). */
  markSaved: (filePath: string | null) => void;

  /** Double-click on a wire: adds a waypoint there, in path order. */
  addWaypointAt: (relId: string, at: { x: number; y: number }) => void;
  selectWaypoint: (relId: string, index: number) => void;
  /** Drags a waypoint's center (call pushUndo when the drag starts). */
  moveWaypoint: (relId: string, index: number, to: { x: number; y: number }) => void;
  /** Drags a waypoint's rotation/length handle (call pushUndo when the drag starts). */
  dragWaypointHandle: (relId: string, index: number, to: { x: number; y: number }) => void;
  /** Delete key with a waypoint selected. */
  removeSelectedWaypoint: () => void;

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

  /** Adds a custom transport, usual on `layers` (see lib/connections). Returns its id. */
  addTransport: (name: string, color: string, layers?: Layer[]) => string;
  /** Adds a custom API style, usual with `transports`. Returns its id. */
  addStyle: (name: string, color: string, transports?: string[], kind?: ApiStyle["kind"]) => string;
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
  /** Adds one pip to a definition (the canvas's Add pip…). Standard definitions are read-only. */
  addPip: (defId: string, pip: PipDef) => void;
  /**
   * Permute in place: saves `def` (a new definition) and switches the node
   * on the active canvas to it. Wires stay on pips the copy kept; any whose
   * pip was dropped stay too, as broken-but-kept links.
   */
  permuteNodeInto: (nodeId: string, def: NodeDefinition) => void;
}

/** Looks up a pip definition from a node instance id. */
export function getPip(
  s: Pick<AppState, "canvases" | "activeCanvasId" | "definitions">,
  nodeId: string,
  pipId: string
): PipDef | null {
  const node = s.canvases[s.activeCanvasId].nodes.find((n) => n.id === nodeId);
  if (!node) return null;
  return resolveDef(s.definitions, s.activeCanvasId, node.definitionId)?.pips.find((p) => p.id === pipId) ?? null;
}

/** True if this node is a port on a pocket canvas, whose pips can't be wired by hand. */
export function isLockedPort(
  s: Pick<AppState, "canvases" | "activeCanvasId" | "definitions">,
  nodeId: string
): boolean {
  const node = s.canvases[s.activeCanvasId].nodes.find((n) => n.id === nodeId);
  return !!node && isPortDefId(node.definitionId) && isPocket(s.definitions, s.activeCanvasId);
}

/**
 * The definition a node uses, reactively — stored, or (for a port node) built
 * from the node whose interior `canvasId` is. Stable between renders.
 */
export function useNodeDef(canvasId: string, defId: string | null | undefined): NodeDefinition | undefined {
  const port = !!defId && isPortDefId(defId);
  const owner = useApp((s) => (port ? canvasOwner(s.definitions, canvasId) : undefined));
  const stored = useApp((s) => (!port && defId ? s.definitions[defId] : undefined));
  return useMemo(
    () => (port ? (owner ? portDefinition(owner, defId as never) : undefined) : stored),
    [port, owner, stored, defId]
  );
}

const initial = freshProject();

export const useApp = create<AppState>((set, get) => ({
  ...initial,
  projectName: DEFAULT_PROJECT_NAME,
  filePath: null,
  savedRefs: contentRefs({ ...initial, projectName: DEFAULT_PROJECT_NAME }),
  savedAt: Date.now(),
  selectedWaypoint: null,
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
        selectedWaypoint: null,
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
      // Port nodes belong to their canvas (one of each) and aren't copied
      const nodes = canvas.nodes.filter((n) => sel.has(n.id) && !isPortDefId(n.definitionId));
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
        // A copy builds at its own derived path: a copied override would clash at once
        const copy: NodeInstance = { ...n, id, x: n.x + off, y: n.y + off };
        delete copy.pathOverride;
        return copy;
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
        waypoints: translateWaypoints(r.waypoints, off, off),
        foldedWaypoints: remapFoldedKeys(r.foldedWaypoints, idMap),
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

  newProject: (name = DEFAULT_PROJECT_NAME) =>
    set(() => {
      const fresh = { ...freshProject(), projectName: name.trim() || DEFAULT_PROJECT_NAME };
      return {
        ...fresh,
        // Forget the last file, so the next save asks where (it used to
        // silently overwrite the previously opened project).
        filePath: null,
        savedRefs: contentRefs(fresh),
        savedAt: Date.now(),
        selectedWaypoint: null,
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

  addWaypointAt: (relId, at) =>
    set((s) => {
      const canvas = s.canvases[s.activeCanvasId];
      const rel = canvas.relationships.find((r) => r.id === relId);
      if (!rel) return {};
      const end = (e: RelEnd) => {
        const node = canvas.nodes.find((n) => n.id === e.nodeId);
        const def = node && resolveDef(s.definitions, canvas.id, node.definitionId);
        return node && def ? pipWorldPos(node, instanceDef(def, canvas, node.id), e.pipId) : null;
      };
      const p1 = end(rel.from);
      const p2 = end(rel.to);
      if (!p1 || !p2) return {};
      const waypoints = addWaypoint(p1, p2, rel.waypoints ?? [], at);
      const index = waypoints.findIndex((w) => !rel.waypoints?.includes(w));
      return {
        undoStack: pushSnap(s),
        canvases: withRel(s, relId, (r) => ({ ...r, waypoints })),
        selection: [relId],
        selectedWaypoint: { relId, index },
      };
    }),

  selectWaypoint: (relId, index) => set({ selection: [relId], selectedWaypoint: { relId, index } }),

  moveWaypoint: (relId, index, to) =>
    set((s) => ({
      canvases: withWaypoint(s, relId, index, (w) => ({ ...w, x: to.x, y: to.y })),
    })),

  dragWaypointHandle: (relId, index, to) =>
    set((s) => ({ canvases: withWaypoint(s, relId, index, (w) => applyHandle(w, to)) })),

  removeSelectedWaypoint: () =>
    set((s) => {
      const sw = s.selectedWaypoint;
      if (!sw) return {};
      return {
        undoStack: pushSnap(s),
        canvases: withRel(s, sw.relId, (r) => {
          const waypoints = (r.waypoints ?? []).filter((_, i) => i !== sw.index);
          return { ...r, waypoints: waypoints.length ? waypoints : undefined };
        }),
        selectedWaypoint: null,
      };
    }),

  setProjectName: (name) =>
    set((s) => {
      const projectName = name.trim();
      return projectName && projectName !== s.projectName ? { projectName } : {};
    }),

  setPathOverride: (nodeId, path) =>
    set((s) => {
      const canvas = s.canvases[s.activeCanvasId];
      const node = canvas.nodes.find((n) => n.id === nodeId);
      if (!node) return {};
      const pathOverride = path ? normalizeOverride(path) : "";
      if ((node.pathOverride ?? "") === pathOverride) return {};
      const updated: NodeInstance = { ...node, pathOverride };
      if (!pathOverride) delete updated.pathOverride;
      return {
        undoStack: pushSnap(s),
        canvases: {
          ...s.canvases,
          [canvas.id]: { ...canvas, nodes: canvas.nodes.map((n) => (n.id === nodeId ? updated : n)) },
        },
      };
    }),

  markSaved: (filePath) =>
    set((s) => ({ filePath, savedRefs: contentRefs(s), savedAt: Date.now() })),

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

      // A port node is never swept into a collapse: it stands for this canvas's edge
      const inside = new Set(
        canvas.nodes
          .filter((n) => !isPortDefId(n.definitionId) && rectsIntersect(nodeRect(n), box))
          .map((n) => n.id)
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
          // Bend points inside the box fold away with it (restored on expand)
          const folded = foldWaypoints(r, box, instance.id);
          return fromInside ? { ...folded, from: newEnd } : { ...folded, to: newEnd };
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
      const innerNodes = inner.nodes.filter((n) => !isPortDefId(n.definitionId));
      const clones: NodeInstance[] = innerNodes.map((n) => {
        const id = uid();
        idMap.set(n.id, id);
        return { ...n, id, x: n.x + dx, y: n.y + dy };
      });
      const clonedRels: Relationship[] = inner.relationships
        .filter((r) => idMap.has(r.from.nodeId) && idMap.has(r.to.nodeId))
        .map((r) => ({
        ...r,
        id: uid(),
        from: { ...r.from, nodeId: idMap.get(r.from.nodeId) ?? r.from.nodeId },
        to: { ...r.to, nodeId: idMap.get(r.to.nodeId) ?? r.to.nodeId },
        waypoints: translateWaypoints(r.waypoints, dx, dy),
        foldedWaypoints: remapFoldedKeys(r.foldedWaypoints, idMap),
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
        // Bend points folded inside this node come back, at the end that leads in
        const insideEnd = r.from.nodeId === instanceId ? "from" : r.to.nodeId === instanceId ? "to" : null;
        const unfolded = insideEnd ? unfoldWaypoints(r, instanceId, insideEnd, dx, dy) : r;
        return {
          ...unfolded,
          from: remap(r.from),
          to: remap(r.to),
          foldedWaypoints: remapFoldedKeys(unfolded.foldedWaypoints, idMap),
        };
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
      const delta = new Map<string, { dx: number; dy: number }>();
      const nodes = canvas.nodes.map((n) => {
        const m = byId.get(n.id);
        if (!m) return n;
        delta.set(n.id, { dx: m.x - n.x, dy: m.y - n.y });
        return { ...n, x: m.x, y: m.y };
      });
      // A wire's bend points stay put unless both its ends move together
      const relationships = canvas.relationships.map((r) => {
        const a = delta.get(r.from.nodeId);
        const b = delta.get(r.to.nodeId);
        if (!r.waypoints?.length || !a || !b || a.dx !== b.dx || a.dy !== b.dy) return r;
        return { ...r, waypoints: translateWaypoints(r.waypoints, a.dx, a.dy) };
      });
      return {
        canvases: { ...s.canvases, [canvas.id]: { ...canvas, nodes, relationships } },
      };
    }),

  addNode: (definitionId, x, y) =>
    set((s) => {
      const canvas = s.canvases[s.activeCanvasId];
      if (isPortDefId(definitionId) && !canPlacePort(s.definitions, canvas, definitionId)) return {};
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
      const canvases = { ...s.canvases, [canvas.id]: { ...canvas, nodes, relationships, boundaries } };
      return {
        undoStack: pushSnap(s),
        canvases,
        // A deleted pip goes once its last wire does
        definitions: pruneRemovedPips(s.definitions, canvases),
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
      // A pocket's ports show the collapse's own connections; they can't be rewired here
      if (isLockedPort(s, wd.fromNodeId) || isLockedPort(s, wd.snap.nodeId)) return { wireDrag: null };
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

      const rel: Relationship = { id: uid(), ...wireType(fromPip, toPip), from, to };
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
  addTransport: (name, color, layers) => {
    const id = `tr-${uid()}`;
    const t: Transport = { id, name, color, ...(layers?.length ? { layers } : {}) };
    set((s) => ({ undoStack: pushSnap(s), transports: { ...s.transports, [id]: t } }));
    return id;
  },

  addStyle: (name, color, transports, kind) => {
    const id = `s-${uid()}`;
    const st: ApiStyle = { id, name, color, ...(transports?.length ? { transports } : {}), ...(kind ? { kind } : {}) };
    set((s) => ({ undoStack: pushSnap(s), styles: { ...s.styles, [id]: st } }));
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
      // Deleted or retyped pips never take their wires with them: a deleted pip
      // stays (marked removed) while wired, and mismatched wires show as broken.
      const saved = keepWiredPips(s.definitions[def.id], {
        ...def,
        layers: def.layers?.length ? def.layers : (["container"] as Layer[]),
      }, s.canvases);
      return {
        undoStack: pushSnap(s),
        definitions: { ...s.definitions, [def.id]: saved },
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
          waypoints: translateWaypoints(r.waypoints, dx, dy),
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

  addPip: (defId, pip) =>
    set((s) => {
      const def = s.definitions[defId];
      if (!def || isStandardDef(defId)) return {};
      return {
        undoStack: pushSnap(s),
        definitions: { ...s.definitions, [defId]: { ...def, pips: [...def.pips, pip] } },
      };
    }),

  permuteNodeInto: (nodeId, def) =>
    set((s) => {
      const canvas = s.canvases[s.activeCanvasId];
      const node = canvas.nodes.find((n) => n.id === nodeId);
      const old = node && s.definitions[node.definitionId];
      if (!node || !old || s.definitions[def.id]) return {};
      const canvases = {
        ...s.canvases,
        [canvas.id]: {
          ...canvas,
          nodes: canvas.nodes.map((n) => (n.id === nodeId ? { ...n, definitionId: def.id } : n)),
        },
      };
      // The node's wires were drawn on the old definition's pips (the copy keeps their ids)
      const saved = keepWiredPips(
        { ...old, id: def.id, canvasId: def.canvasId },
        { ...def, layers: def.layers?.length ? def.layers : (["container"] as Layer[]) },
        canvases
      );
      return {
        undoStack: pushSnap(s),
        definitions: { ...s.definitions, [def.id]: saved },
        canvases,
        selection: [nodeId],
      };
    }),

  importDefinitions: (plan) =>
    set((s) => {
      if (!plan.definitions.length) return {};
      const definitions = { ...s.definitions };
      for (const d of plan.definitions) definitions[d.id] = d;
      const transports = { ...s.transports };
      for (const t of plan.transports) transports[t.id] ??= t;
      const styles = { ...s.styles };
      for (const st of plan.styles) styles[st.id] ??= st;
      return {
        undoStack: pushSnap(s),
        definitions,
        transports,
        styles,
        customIcons: { ...s.customIcons, ...plan.customIcons },
      };
    }),
}));

/** Canvases with one relationship on the active canvas replaced. */
function withRel(
  s: Pick<AppState, "canvases" | "activeCanvasId">,
  relId: string,
  fn: (r: Relationship) => Relationship
): Record<string, CanvasData> {
  const canvas = s.canvases[s.activeCanvasId];
  return {
    ...s.canvases,
    [canvas.id]: {
      ...canvas,
      relationships: canvas.relationships.map((r) => (r.id === relId ? fn(r) : r)),
    },
  };
}

/** Canvases with one waypoint of one relationship replaced. */
function withWaypoint(
  s: Pick<AppState, "canvases" | "activeCanvasId">,
  relId: string,
  index: number,
  fn: (w: Waypoint) => Waypoint
): Record<string, CanvasData> {
  return withRel(s, relId, (r) =>
    r.waypoints?.[index]
      ? { ...r, waypoints: r.waypoints.map((w, i) => (i === index ? fn(w) : w)) }
      : r
  );
}

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
