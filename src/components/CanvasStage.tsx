import { Stage, Layer, Rect, Circle, Group } from "react-konva";
import Konva from "konva";
import { useMemo, useRef, useState } from "react";
import { useApp, useActiveCanvas, getPip, setPointerWorld, useNodeDef, isLockedPort } from "../store";
import { lockedPortWires, resolveDef } from "../lib/ports";
import { canvasOwner } from "../lib/layers";
import { NODE_WIDTH, NODE_HEIGHT } from "../types";
import NodeShape, { NodeVisual } from "./NodeShape";
import RelationshipShape from "./RelationshipShape";
import BoundaryShape from "./BoundaryShape";
import NodeNameTooltip from "./NodeNameTooltip";
import WaypointHandles from "./WaypointHandles";
import { DEF_DRAG_TYPE } from "./LibraryPanel";
import { Shape } from "react-konva";
import { canConnect, pipWorldPos, wireGeometry } from "../lib/graph";

const MIN_SCALE = 0.1;
const MAX_SCALE = 4;
const GRID_SPACING = 40;

interface Marquee {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Live wire following the cursor while dragging out a relationship. */
function WirePreview() {
  const wireDrag = useApp((s) => s.wireDrag);
  const canvas = useActiveCanvas();
  const s = useApp.getState();
  if (!wireDrag) return null;
  const fromNode = canvas.nodes.find((n) => n.id === wireDrag.fromNodeId);
  if (!fromNode) return null;
  const def = resolveDef(s.definitions, canvas.id, fromNode.definitionId);
  const fromPip = getPip(s, wireDrag.fromNodeId, wireDrag.fromPipId);
  const p1 = def && pipWorldPos(fromNode, def, wireDrag.fromPipId);
  if (!p1 || !fromPip) return null;
  const color = s.transports[fromPip.transportId]?.color ?? "#888";

  let end = wireDrag.cursor;
  let endSide: Parameters<typeof wireGeometry>[3] = null;
  if (wireDrag.snap) {
    const sn = canvas.nodes.find((n) => n.id === wireDrag.snap!.nodeId);
    if (sn) {
      const snDef = resolveDef(s.definitions, canvas.id, sn.definitionId);
      const pos = snDef && pipWorldPos(sn, snDef, wireDrag.snap.pipId);
      if (pos) {
        end = pos;
        endSide = pos.side;
      }
    }
  }
  const g = wireGeometry(p1, p1.side, end, endSide);
  return (
    <Shape
      listening={false}
      sceneFunc={(ctx) => {
        ctx.beginPath();
        ctx.moveTo(g.x1, g.y1);
        ctx.bezierCurveTo(g.c1x, g.c1y, g.c2x, g.c2y, g.x2, g.y2);
        ctx.setAttr("lineWidth", 3);
        ctx.setAttr("strokeStyle", color);
        if (!wireDrag.snap) ctx.setAttr("lineDashOffset", 0);
        ctx.setLineDash(wireDrag.snap ? [] : [7, 5]);
        ctx.stroke();
      }}
    />
  );
}

/** Dot grid covering the visible world-space region. */
function GridDots({ width, height }: { width: number; height: number }) {
  const viewport = useApp((s) => s.viewport);
  const dots = useMemo(() => {
    const { x, y, scale } = viewport;
    // Visible world bounds
    const wx0 = -x / scale;
    const wy0 = -y / scale;
    const wx1 = (width - x) / scale;
    const wy1 = (height - y) / scale;
    const startX = Math.floor(wx0 / GRID_SPACING) * GRID_SPACING;
    const startY = Math.floor(wy0 / GRID_SPACING) * GRID_SPACING;
    const pts: { x: number; y: number }[] = [];
    // Cap the dot count so extreme zoom-out stays fast
    if ((wx1 - wx0) / GRID_SPACING > 200) return pts;
    for (let gx = startX; gx <= wx1; gx += GRID_SPACING) {
      for (let gy = startY; gy <= wy1; gy += GRID_SPACING) {
        pts.push({ x: gx, y: gy });
      }
    }
    return pts;
  }, [viewport, width, height]);

  return (
    <>
      {dots.map((d, i) => (
        <Circle key={i} x={d.x} y={d.y} radius={1.2} fill="#33364a" listening={false} perfectDrawEnabled={false} />
      ))}
    </>
  );
}

export default function CanvasStage({ width, height }: { width: number; height: number }) {
  const canvas = useActiveCanvas();
  const viewport = useApp((s) => s.viewport);
  const setViewport = useApp((s) => s.setViewport);
  const [marquee, setMarquee] = useState<Marquee | null>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const panning = useRef(false);
  const placingDefId = useApp((s) => s.placingDefId);
  const placingDef = useNodeDef(canvas.id, placingDefId);
  // Inside a pocket, its port nodes show the collapse's connections: drawn, locked
  const owner = useApp((s) => canvasOwner(s.definitions, canvas.id));
  const definitions = useApp((s) => s.definitions);
  const lockedWires = useMemo(
    () =>
      owner
        ? lockedPortWires(owner, canvas, (nodeId, pipId) => {
            const n = canvas.nodes.find((x) => x.id === nodeId);
            return n && resolveDef(definitions, canvas.id, n.definitionId)?.pips.find((p) => p.id === pipId);
          })
        : [],
    [owner, canvas, definitions]
  );
  const [ghostPos, setGhostPos] = useState<{ x: number; y: number } | null>(null);
  const wireDrag = useApp((s) => s.wireDrag);
  const boundaryDrawing = useApp((s) => s.boundaryDrawing);
  const [boundaryDraft, setBoundaryDraft] = useState<Marquee | null>(null);

  /** Nearest compatible pip within snap range of a world point, or null. */
  const findSnap = (world: { x: number; y: number }) => {
    const s = useApp.getState();
    const wd = s.wireDrag;
    if (!wd) return null;
    const fromPip = getPip(s, wd.fromNodeId, wd.fromPipId);
    if (!fromPip) return null;
    const SNAP_RANGE = 26;
    let best: { nodeId: string; pipId: string } | null = null;
    let bestDist = SNAP_RANGE;
    for (const n of canvas.nodes) {
      const def = resolveDef(s.definitions, canvas.id, n.definitionId);
      if (!def || isLockedPort(s, n.id)) continue;
      for (const pip of def.pips) {
        if (n.id === wd.fromNodeId && pip.id === wd.fromPipId) continue;
        if (!canConnect(fromPip, pip)) continue;
        const pos = pipWorldPos(n, def, pip.id);
        if (!pos) continue;
        const d = Math.hypot(pos.x - world.x, pos.y - world.y);
        if (d < bestDist) {
          bestDist = d;
          best = { nodeId: n.id, pipId: pip.id };
        }
      }
    }
    return best;
  };

  const toWorld = (sx: number, sy: number) => ({
    x: (sx - viewport.x) / viewport.scale,
    y: (sy - viewport.y) / viewport.scale,
  });

  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    const oldScale = viewport.scale;
    const factor = e.evt.deltaY < 0 ? 1.1 : 1 / 1.1;
    const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, oldScale * factor));
    // Keep the world point under the cursor fixed
    const worldX = (pointer.x - viewport.x) / oldScale;
    const worldY = (pointer.y - viewport.y) / oldScale;
    setViewport({
      x: pointer.x - worldX * scale,
      y: pointer.y - worldY * scale,
      scale,
    });
  };

  const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const stage = stageRef.current;
    if (!stage) return;
    if (e.evt.button === 1) {
      e.evt.preventDefault();
      panning.current = true;
      return;
    }
    // Placement mode: left click drops the node, any other button cancels
    if (placingDefId) {
      if (e.evt.button === 0) {
        const p = stage.getPointerPosition();
        if (!p) return;
        const w = toWorld(p.x, p.y);
        useApp.getState().addNode(placingDefId, w.x - NODE_WIDTH / 2, w.y - NODE_HEIGHT / 2);
      }
      useApp.getState().setPlacing(null);
      setGhostPos(null);
      return;
    }
    // Boundary drawing mode: drag out the new box
    if (boundaryDrawing && e.evt.button === 0) {
      const p = stage.getPointerPosition();
      if (!p) return;
      const w = toWorld(p.x, p.y);
      setBoundaryDraft({ x0: w.x, y0: w.y, x1: w.x, y1: w.y });
      return;
    }
    // Left-button on empty canvas starts a marquee
    if (e.evt.button === 0 && e.target === stage) {
      const p = stage.getPointerPosition();
      if (!p) return;
      const w = toWorld(p.x, p.y);
      setMarquee({ x0: w.x, y0: w.y, x1: w.x, y1: w.y });
      if (!e.evt.ctrlKey && !e.evt.shiftKey) {
        useApp.getState().setSelection([]);
      }
    }
  };

  const handleMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const stage = stageRef.current;
    if (!stage) return;
    const pointer = stage.getPointerPosition();
    if (pointer) setPointerWorld(toWorld(pointer.x, pointer.y)); // Ctrl+D target
    if (panning.current) {
      setViewport({
        x: viewport.x + e.evt.movementX,
        y: viewport.y + e.evt.movementY,
        scale: viewport.scale,
      });
      return;
    }
    if (placingDefId) {
      const p = stage.getPointerPosition();
      if (!p) return;
      const w = toWorld(p.x, p.y);
      setGhostPos({ x: w.x - NODE_WIDTH / 2, y: w.y - NODE_HEIGHT / 2 });
      return;
    }
    if (wireDrag) {
      const p = stage.getPointerPosition();
      if (!p) return;
      const w = toWorld(p.x, p.y);
      useApp.getState().updateWire(w, findSnap(w));
      return;
    }
    if (boundaryDraft) {
      const p = stage.getPointerPosition();
      if (!p) return;
      const w = toWorld(p.x, p.y);
      setBoundaryDraft({ ...boundaryDraft, x1: w.x, y1: w.y });
      return;
    }
    if (marquee) {
      const p = stage.getPointerPosition();
      if (!p) return;
      const w = toWorld(p.x, p.y);
      setMarquee({ ...marquee, x1: w.x, y1: w.y });
    }
  };

  const handleMouseUp = () => {
    panning.current = false;
    if (wireDrag) {
      useApp.getState().endWire();
      return;
    }
    if (boundaryDraft) {
      const x = Math.min(boundaryDraft.x0, boundaryDraft.x1);
      const y = Math.min(boundaryDraft.y0, boundaryDraft.y1);
      const w = Math.abs(boundaryDraft.x1 - boundaryDraft.x0);
      const h = Math.abs(boundaryDraft.y1 - boundaryDraft.y0);
      const s = useApp.getState();
      if (w > 40 && h > 40) {
        s.setPendingBoundaryRect({ x, y, width: w, height: h });
      }
      s.setBoundaryDrawing(false);
      setBoundaryDraft(null);
      return;
    }
    if (marquee) {
      const mx0 = Math.min(marquee.x0, marquee.x1);
      const my0 = Math.min(marquee.y0, marquee.y1);
      const mx1 = Math.max(marquee.x0, marquee.x1);
      const my1 = Math.max(marquee.y0, marquee.y1);
      // Ignore sub-3px drags — those are just clicks
      if ((mx1 - mx0) * viewport.scale > 3 || (my1 - my0) * viewport.scale > 3) {
        const hit = canvas.nodes
          .filter(
            (n) =>
              n.x < mx1 && n.x + NODE_WIDTH > mx0 && n.y < my1 && n.y + NODE_HEIGHT > my0
          )
          .map((n) => n.id);
        const hitBoxes = canvas.boundaries
          .filter((c) => c.x < mx1 && c.x + c.width > mx0 && c.y < my1 && c.y + c.height > my0)
          .map((c) => c.id);
        useApp.getState().addToSelection([...hit, ...hitBoxes]);
      }
      setMarquee(null);
    }
  };

  // Drag-to-place from the palette (HTML drag and drop onto the stage)
  const dropWorld = (e: React.DragEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return toWorld(e.clientX - rect.left, e.clientY - rect.top);
  };
  const isDefDrag = (e: React.DragEvent) => e.dataTransfer.types.includes(DEF_DRAG_TYPE);

  return (
    <div
      className="h-full w-full"
      onDragOver={(e) => {
        if (!isDefDrag(e)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        const w = dropWorld(e);
        setGhostPos({ x: w.x - NODE_WIDTH / 2, y: w.y - NODE_HEIGHT / 2 });
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setGhostPos(null);
      }}
      onDrop={(e) => {
        const defId = e.dataTransfer.getData(DEF_DRAG_TYPE);
        if (!defId) return;
        e.preventDefault();
        const w = dropWorld(e);
        const s = useApp.getState();
        s.addNode(defId, w.x - NODE_WIDTH / 2, w.y - NODE_HEIGHT / 2);
        s.setPlacing(null);
        setGhostPos(null);
      }}
    >
    <Stage
      ref={stageRef}
      width={width}
      height={height}
      x={viewport.x}
      y={viewport.y}
      scaleX={viewport.scale}
      scaleY={viewport.scale}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => setPointerWorld(null)}
      onContextMenu={(e) => e.evt.preventDefault()}
    >
      <Layer>
        <GridDots width={width} height={height} />
      </Layer>
      <Layer>
        {canvas.boundaries.map((c) => (
          <BoundaryShape key={c.id} box={c} />
        ))}
        {lockedWires.map((r) => (
          <RelationshipShape key={r.id} rel={r} locked />
        ))}
        {canvas.relationships.map((r) => (
          <RelationshipShape key={r.id} rel={r} />
        ))}
        <WirePreview />
        {canvas.nodes.map((n) => (
          <NodeShape key={n.id} node={n} />
        ))}
        <WaypointHandles />
        <NodeNameTooltip />
        {placingDef && ghostPos && (
          <Group x={ghostPos.x} y={ghostPos.y} opacity={0.55} listening={false}>
            <NodeVisual def={placingDef} ghost />
          </Group>
        )}
        {boundaryDraft && (
          <Rect
            x={Math.min(boundaryDraft.x0, boundaryDraft.x1)}
            y={Math.min(boundaryDraft.y0, boundaryDraft.y1)}
            width={Math.abs(boundaryDraft.x1 - boundaryDraft.x0)}
            height={Math.abs(boundaryDraft.y1 - boundaryDraft.y0)}
            cornerRadius={8}
            fill="rgba(76,154,255,0.06)"
            stroke="#4c9aff"
            dash={[8, 5]}
            strokeWidth={1.5 / viewport.scale}
            listening={false}
          />
        )}
        {marquee && (
          <Rect
            x={Math.min(marquee.x0, marquee.x1)}
            y={Math.min(marquee.y0, marquee.y1)}
            width={Math.abs(marquee.x1 - marquee.x0)}
            height={Math.abs(marquee.y1 - marquee.y0)}
            fill="rgba(76,154,255,0.12)"
            stroke="#4c9aff"
            strokeWidth={1 / viewport.scale}
            listening={false}
          />
        )}
      </Layer>
    </Stage>
    </div>
  );
}
