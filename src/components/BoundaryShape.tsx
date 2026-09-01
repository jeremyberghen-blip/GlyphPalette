import { Group, Rect, Text, Image as KImage, Circle, Line } from "react-konva";
import Konva from "konva";
import { useRef } from "react";
import { Boundary, NODE_WIDTH, NODE_HEIGHT } from "../types";
import { useApp, rectsIntersect } from "../store";
import { useIcon } from "../lib/icons";

const HEADER_H = 26;
const MIN_SIZE = 80;
const HANDLE = 7;

interface DragPeers {
  startX: number;
  startY: number;
  nodes: { id: string; x: number; y: number }[];
  boundaries: { id: string; x: number; y: number }[];
}

export default function BoundaryShape({ box }: { box: Boundary }) {
  const selected = useApp((s) => s.selection.includes(box.id));
  const icon = useIcon(box.icon, "#c9cbd8");
  const peers = useRef<DragPeers | null>(null);

  const headerW = Math.min(box.width - 12, Math.max(90, box.name.length * 8 + 40));

  const select = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (e.evt.button !== 0) return;
    e.cancelBubble = true;
    const s = useApp.getState();
    if (e.evt.ctrlKey || e.evt.shiftKey) s.toggleSelected(box.id);
    else s.setSelection([box.id]);
  };

  // Header drag: move the container and everything overlapping it
  const onDragStart = (e: Konva.KonvaEventObject<DragEvent>) => {
    e.cancelBubble = true;
    const s = useApp.getState();
    s.pushUndo();
    if (!s.selection.includes(box.id)) s.setSelection([box.id]);
    const canvas = s.canvases[s.activeCanvasId];
    const rect = { x: box.x, y: box.y, width: box.width, height: box.height };
    peers.current = {
      startX: e.target.x(),
      startY: e.target.y(),
      nodes: canvas.nodes
        .filter((n) =>
          rectsIntersect({ x: n.x, y: n.y, width: NODE_WIDTH, height: NODE_HEIGHT }, rect)
        )
        .map((n) => ({ id: n.id, x: n.x, y: n.y })),
      boundaries: canvas.boundaries
        .filter(
          (c) =>
            c.id === box.id ||
            rectsIntersect({ x: c.x, y: c.y, width: c.width, height: c.height }, rect)
        )
        .map((c) => ({ id: c.id, x: c.x, y: c.y })),
    };
  };

  const onDragMove = (e: Konva.KonvaEventObject<DragEvent>) => {
    const p = peers.current;
    if (!p) return;
    const dx = e.target.x() - p.startX;
    const dy = e.target.y() - p.startY;
    const s = useApp.getState();
    s.moveNodes(p.nodes.map((n) => ({ id: n.id, x: n.x + dx, y: n.y + dy })));
    s.moveBoundaries(p.boundaries.map((c) => ({ id: c.id, x: c.x + dx, y: c.y + dy })));
  };

  const onDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    peers.current = null;
    // The header group's own x/y was mutated by Konva's drag — snap it back to
    // its layout position; the container's real position lives in the store.
    e.target.position({ x: box.x + (box.width - headerW) / 2, y: box.y - HEADER_H / 2 });
  };

  // Resize handles: 4 corners + 4 edge midpoints
  const handles: { hx: number; hy: number; cursor: string; ax: number; ay: number }[] = [
    { hx: 0, hy: 0, cursor: "nwse-resize", ax: -1, ay: -1 },
    { hx: 0.5, hy: 0, cursor: "ns-resize", ax: 0, ay: -1 },
    { hx: 1, hy: 0, cursor: "nesw-resize", ax: 1, ay: -1 },
    { hx: 1, hy: 0.5, cursor: "ew-resize", ax: 1, ay: 0 },
    { hx: 1, hy: 1, cursor: "nwse-resize", ax: 1, ay: 1 },
    { hx: 0.5, hy: 1, cursor: "ns-resize", ax: 0, ay: 1 },
    { hx: 0, hy: 1, cursor: "nesw-resize", ax: -1, ay: 1 },
    { hx: 0, hy: 0.5, cursor: "ew-resize", ax: -1, ay: 0 },
  ];

  const resizeFrom = useRef<Boundary | null>(null);

  return (
    <>
      {/* Body fill: visual only, never blocks clicks on nodes inside */}
      <Rect
        x={box.x}
        y={box.y}
        width={box.width}
        height={box.height}
        cornerRadius={8}
        fill="rgba(76,154,255,0.05)"
        listening={false}
      />
      {/* Border: clickable for selection */}
      <Rect
        x={box.x}
        y={box.y}
        width={box.width}
        height={box.height}
        cornerRadius={8}
        stroke={selected ? "#4c9aff" : "#4a4e63"}
        strokeWidth={selected ? 2 : 1.5}
        dash={[8, 5]}
        fillEnabled={false}
        hitStrokeWidth={10}
        onClick={select}
      />

      {/* Header: boxed icon + label, top center; drag handle for the container */}
      <Group
        x={box.x + (box.width - headerW) / 2}
        y={box.y - HEADER_H / 2}
        draggable
        onDragStart={onDragStart}
        onDragMove={onDragMove}
        onDragEnd={onDragEnd}
        onClick={select}
        onMouseEnter={(e) => {
          const st = e.target.getStage();
          if (st) st.container().style.cursor = "move";
        }}
        onMouseLeave={(e) => {
          const st = e.target.getStage();
          if (st) st.container().style.cursor = "";
        }}
      >
        <Rect
          width={headerW}
          height={HEADER_H}
          cornerRadius={6}
          fill="#2b2d3a"
          stroke={selected ? "#4c9aff" : "#4a4e63"}
          strokeWidth={1.5}
          shadowColor="black"
          shadowBlur={5}
          shadowOpacity={0.35}
        />
        {icon && (
          <KImage image={icon} x={7} y={5} width={16} height={16} listening={false} />
        )}
        <Text
          text={box.name}
          x={28}
          y={7}
          width={headerW - 34}
          fontSize={12}
          fontFamily="Segoe UI, sans-serif"
          fill="#e2e4ee"
          listening={false}
          wrap="none"
          ellipsis
        />
      </Group>

      {/* Collapse button, top-right inside the box, when selected */}
      {selected && (
        <Group
          x={box.x + box.width - 16}
          y={box.y + 16}
          onClick={(e) => {
            e.cancelBubble = true;
            useApp.getState().collapseBoundary(box.id);
          }}
          onMouseEnter={(e) => {
            const st = e.target.getStage();
            if (st) st.container().style.cursor = "pointer";
          }}
          onMouseLeave={(e) => {
            const st = e.target.getStage();
            if (st) st.container().style.cursor = "";
          }}
        >
          <Circle radius={10} fill="#2b3a55" stroke="#4c9aff" strokeWidth={1.5} />
          {/* minimize glyph: inward arrows */}
          <Line points={[-4, -1.5, 0, -1.5, 0, -5.5]} stroke="#e2e4ee" strokeWidth={1.5} listening={false} />
          <Line points={[4, 1.5, 0, 1.5, 0, 5.5]} stroke="#e2e4ee" strokeWidth={1.5} listening={false} />
        </Group>
      )}

      {/* Resize handles */}
      {selected &&
        handles.map((h, i) => (
          <Rect
            key={i}
            x={box.x + h.hx * box.width - HANDLE / 2}
            y={box.y + h.hy * box.height - HANDLE / 2}
            width={HANDLE}
            height={HANDLE}
            fill="#4c9aff"
            stroke="#191a21"
            strokeWidth={1}
            draggable
            onMouseEnter={(e) => {
              const st = e.target.getStage();
              if (st) st.container().style.cursor = h.cursor;
            }}
            onMouseLeave={(e) => {
              const st = e.target.getStage();
              if (st) st.container().style.cursor = "";
            }}
            onDragStart={(e) => {
              e.cancelBubble = true;
              useApp.getState().pushUndo();
              resizeFrom.current = { ...box };
            }}
            onDragMove={(e) => {
              const start = resizeFrom.current;
              if (!start) return;
              const px = e.target.x() + HANDLE / 2;
              const py = e.target.y() + HANDLE / 2;
              let { x, y, width, height } = start;
              if (h.ax === -1) {
                width = Math.max(MIN_SIZE, x + width - px);
                x = start.x + start.width - width;
              } else if (h.ax === 1) {
                width = Math.max(MIN_SIZE, px - x);
              }
              if (h.ay === -1) {
                height = Math.max(MIN_SIZE, y + height - py);
                y = start.y + start.height - height;
              } else if (h.ay === 1) {
                height = Math.max(MIN_SIZE, py - y);
              }
              useApp.getState().resizeBoundary(box.id, { x, y, width, height });
            }}
            onDragEnd={(e) => {
              resizeFrom.current = null;
              const b = useApp
                .getState()
                .canvases[useApp.getState().activeCanvasId].boundaries.find(
                  (c) => c.id === box.id
                );
              if (b) {
                e.target.position({
                  x: b.x + h.hx * b.width - HANDLE / 2,
                  y: b.y + h.hy * b.height - HANDLE / 2,
                });
              }
            }}
          />
        ))}
    </>
  );
}
