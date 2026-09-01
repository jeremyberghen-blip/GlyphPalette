import { Shape } from "react-konva";
import Konva from "konva";
import { Relationship } from "../types";
import { useApp, getPip, useActiveCanvas } from "../store";
import { pipWorldPos, wireGeometry, sideVector } from "../lib/graph";

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

export default function RelationshipShape({ rel }: { rel: Relationship }) {
  const canvas = useActiveCanvas();
  const s = useApp.getState();
  const type = useApp((s) => s.pipTypes[rel.typeId]);
  const selected = useApp((s) => s.selection.includes(rel.id));

  const fromNode = canvas.nodes.find((n) => n.id === rel.from.nodeId);
  const toNode = canvas.nodes.find((n) => n.id === rel.to.nodeId);
  if (!fromNode || !toNode) return null;
  const fromDef = s.definitions[fromNode.definitionId];
  const toDef = s.definitions[toNode.definitionId];
  const p1 = pipWorldPos(fromNode, fromDef, rel.from.pipId);
  const p2 = pipWorldPos(toNode, toDef, rel.to.pipId);
  if (!p1 || !p2) return null;

  const fromPip = getPip(s, rel.from.nodeId, rel.from.pipId);
  const directional = fromPip?.direction === "outbound";
  const bidirectional = fromPip?.direction === "bidirectional";
  const color = type?.color ?? "#888";
  const g = wireGeometry(p1, p1.side, p2, p2.side);

  return (
    <Shape
      // stroke props are consumed only by hitFunc (wide invisible hit band);
      // sceneFunc draws the visible wire manually
      stroke={color}
      strokeWidth={14}
      sceneFunc={(ctx) => {
        ctx.beginPath();
        ctx.moveTo(g.x1, g.y1);
        ctx.bezierCurveTo(g.c1x, g.c1y, g.c2x, g.c2y, g.x2, g.y2);
        ctx.setAttr("lineWidth", selected ? 3 : 2);
        ctx.setAttr("strokeStyle", color);
        if (selected) {
          ctx.setAttr("shadowColor", color);
          ctx.setAttr("shadowBlur", 8);
        }
        ctx.stroke();
        ctx.setAttr("shadowBlur", 0);
        // Arrowheads point into the pip they terminate at (reverse of its outward normal)
        if (directional || bidirectional) {
          const inTo = sideVector(p2.side);
          drawArrow(ctx, g.x2, g.y2, { x: -inTo.x, y: -inTo.y }, color);
        }
        if (bidirectional) {
          const inFrom = sideVector(p1.side);
          drawArrow(ctx, g.x1, g.y1, { x: -inFrom.x, y: -inFrom.y }, color);
        }
      }}
      hitFunc={(ctx, shape) => {
        ctx.beginPath();
        ctx.moveTo(g.x1, g.y1);
        ctx.bezierCurveTo(g.c1x, g.c1y, g.c2x, g.c2y, g.x2, g.y2);
        ctx.fillStrokeShape(shape);
      }}
      onClick={(e) => {
        if (e.evt.button !== 0) return;
        e.cancelBubble = true;
        const app = useApp.getState();
        if (e.evt.ctrlKey || e.evt.shiftKey) app.toggleSelected(rel.id);
        else app.setSelection([rel.id]);
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
