import { Shape } from "react-konva";
import Konva from "konva";
import { Relationship } from "../types";
import { useApp, useActiveCanvas, useNodeDef } from "../store";
import { pipWorldPos, wireGeometry, sideVector } from "../lib/graph";
import { traceRounded, wireVertices } from "../lib/waypoints";
import { isAnyStyle } from "../lib/connections";
import { BROKEN_COLOR, wireBroken } from "../lib/broken";

/** Outer (transport) line width; the style core is half of it. */
export const WIRE_WIDTH = 5;

/** Draws a small arrowhead at (x,y) pointing along `dir`. */
function drawArrow(
  ctx: Konva.Context,
  x: number,
  y: number,
  dir: { x: number; y: number },
  color: string
) {
  const len = Math.hypot(dir.x, dir.y) || 1;
  const ux = dir.x / len;
  const uy = dir.y / len;
  const size = 9;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x - ux * size - uy * (size * 0.55), y - uy * size + ux * (size * 0.55));
  ctx.lineTo(x - ux * size + uy * (size * 0.55), y - uy * size - ux * (size * 0.55));
  ctx.closePath();
  ctx.setAttr("fillStyle", color);
  ctx.fill();
}

/** World position of the pointer on this shape's stage. */
function pointerWorld(e: Konva.KonvaEventObject<MouseEvent>) {
  const stage = e.target.getStage();
  const p = stage?.getPointerPosition();
  if (!stage || !p) return null;
  return { x: (p.x - stage.x()) / stage.scaleX(), y: (p.y - stage.y()) / stage.scaleY() };
}

export default function RelationshipShape({
  rel,
  locked = false,
}: {
  rel: Relationship;
  /** Drawn automatically (a pocket's port connections): dashed, not selectable or editable. */
  locked?: boolean;
}) {
  const canvas = useActiveCanvas();
  const transport = useApp((s) => s.transports[rel.transportId]);
  const style = useApp((s) => s.styles[rel.styleId]);
  const selected = useApp((s) => s.selection.includes(rel.id));
  const fromNode = canvas.nodes.find((n) => n.id === rel.from.nodeId);
  const toNode = canvas.nodes.find((n) => n.id === rel.to.nodeId);
  // Subscribe to both ends' definitions, so editing a pip (side, type, deletion)
  // redraws the wire even though the canvas itself didn't change
  const fromDef = useNodeDef(canvas.id, fromNode?.definitionId);
  const toDef = useNodeDef(canvas.id, toNode?.definitionId);
  if (!fromNode || !toNode || !fromDef || !toDef) return null;
  const p1 = pipWorldPos(fromNode, fromDef, rel.from.pipId);
  const p2 = pipWorldPos(toNode, toDef, rel.to.pipId);
  if (!p1 || !p2) return null;

  const fromPip = fromDef.pips.find((p) => p.id === rel.from.pipId);
  const toPip = toDef.pips.find((p) => p.id === rel.to.pipId);
  const directional = fromPip?.direction === "outbound";
  const bidirectional = fromPip?.direction === "bidirectional";
  // A wire whose end pip was deleted or retyped out from under it is broken: all red
  const broken = wireBroken(rel, fromPip, toPip);
  const color = broken ? BROKEN_COLOR : transport?.color ?? "#888";
  const core = !broken && !isAnyStyle(rel.styleId) ? style?.color : undefined;

  // Plain wires are one curve; wires with bend points are straight runs with rounded corners
  const bent = !!rel.waypoints?.length;
  const g = wireGeometry(p1, p1.side, p2, p2.side);
  const vertices = bent ? wireVertices(p1, p1.side, p2, p2.side, rel.waypoints!) : [];
  const tracePath = (ctx: Konva.Context) => {
    ctx.beginPath();
    if (bent) {
      traceRounded(ctx, vertices);
    } else {
      ctx.moveTo(g.x1, g.y1);
      ctx.bezierCurveTo(g.c1x, g.c1y, g.c2x, g.c2y, g.x2, g.y2);
    }
  };

  return (
    <Shape
      // stroke props are consumed only by hitFunc (wide invisible hit band);
      // sceneFunc draws the visible wire manually
      stroke={color}
      strokeWidth={14}
      listening={!locked}
      sceneFunc={(ctx) => {
        tracePath(ctx);
        ctx.setAttr("lineCap", "round");
        ctx.setAttr("lineJoin", "round");
        ctx.setAttr("lineWidth", selected ? WIRE_WIDTH + 1 : WIRE_WIDTH);
        if (locked) ctx.setLineDash([10, 6]);
        ctx.setAttr("strokeStyle", color);
        if (selected) {
          ctx.setAttr("shadowColor", color);
          ctx.setAttr("shadowBlur", 8);
        }
        ctx.stroke();
        ctx.setAttr("shadowBlur", 0);
        if (core) {
          tracePath(ctx);
          ctx.setAttr("lineWidth", WIRE_WIDTH / 2);
          ctx.setAttr("strokeStyle", core);
          ctx.stroke();
        }
        ctx.setLineDash([]);
        // Arrowheads point into the pip they terminate at (reverse of its outward normal)
        if (directional || bidirectional) {
          const inTo = sideVector(p2.side);
          drawArrow(ctx, p2.x, p2.y, { x: -inTo.x, y: -inTo.y }, color);
        }
        if (bidirectional) {
          const inFrom = sideVector(p1.side);
          drawArrow(ctx, p1.x, p1.y, { x: -inFrom.x, y: -inFrom.y }, color);
        }
      }}
      hitFunc={(ctx, shape) => {
        tracePath(ctx);
        ctx.fillStrokeShape(shape);
      }}
      onClick={(e) => {
        if (e.evt.button !== 0) return;
        e.cancelBubble = true;
        const app = useApp.getState();
        if (e.evt.ctrlKey || e.evt.shiftKey) app.toggleSelected(rel.id);
        else app.setSelection([rel.id]);
      }}
      onDblClick={(e) => {
        if (e.evt.button !== 0) return;
        e.cancelBubble = true;
        const at = pointerWorld(e);
        if (at) useApp.getState().addWaypointAt(rel.id, at);
      }}
      onMouseEnter={(e) => {
        const stage = e.target.getStage();
        if (stage) stage.container().style.cursor = "pointer";
      }}
      onMouseLeave={(e) => {
        const stage = e.target.getStage();
        if (stage) stage.container().style.cursor = "";
      }}
    />
  );
}
