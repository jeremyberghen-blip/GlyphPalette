import { Group, Rect, Text, Image as KImage, Circle, Line } from "react-konva";
import Konva from "konva";
import { useMemo, useRef } from "react";
import { NodeInstance, NodeDefinition, NODE_WIDTH, NODE_HEIGHT } from "../types";
import { useApp, useNodeDef } from "../store";
import { wiresAt } from "../lib/broken";
import { canvasOwner } from "../lib/layers";
import { useIcon } from "../lib/icons";
import { pipOffsets } from "../lib/graph";
import PipShape from "./PipShape";
import { useNodeHover } from "./NodeNameTooltip";

const ICON_SIZE = 40;

/** Internal nodes: cool slate. External (managed elsewhere, never built): warm stone. */
const NODE_COLORS = {
  internal: { fill: "#22242e", stroke: "#4a4e63", label: "#c9cbd8" },
  external: { fill: "#2a2621", stroke: "#73695a", label: "#cfc6b8" },
};

/** Presentational node body — shared by real nodes and the placement ghost. */
export function NodeVisual({
  def,
  selected = false,
  ghost = false,
  external = !!def.external,
}: {
  def: NodeDefinition;
  selected?: boolean;
  ghost?: boolean;
  /** Drawn as external: the definition is, or it sits inside something external. */
  external?: boolean;
}) {
  const icon = useIcon(def.icon || "CircleQuestionMark");
  const colors = external ? NODE_COLORS.external : NODE_COLORS.internal;
  return (
    <>
      <Rect
        width={NODE_WIDTH}
        height={NODE_HEIGHT}
        cornerRadius={10}
        fill={colors.fill}
        stroke={selected || ghost ? "#4c9aff" : colors.stroke}
        strokeWidth={selected ? 2.5 : 1.5}
        dash={ghost ? [6, 4] : undefined}
        shadowColor={selected ? "#4c9aff" : "black"}
        shadowBlur={selected ? 12 : 6}
        shadowOpacity={selected ? 0.55 : 0.3}
        shadowEnabled={!ghost}
      />
      {icon && (
        <KImage
          image={icon}
          x={(NODE_WIDTH - ICON_SIZE) / 2}
          y={14}
          width={ICON_SIZE}
          height={ICON_SIZE}
          listening={false}
        />
      )}
      <Text
        text={def.name}
        x={4}
        y={NODE_HEIGHT - 32}
        width={NODE_WIDTH - 8}
        align="center"
        fontSize={14}
        fontFamily="Segoe UI, sans-serif"
        fill={colors.label}
        listening={false}
        wrap="none"
        ellipsis
      />
    </>
  );
}

interface Props {
  node: NodeInstance;
}

export default function NodeShape({ node }: Props) {
  const canvasId = useApp((s) => s.activeCanvasId);
  const storedDef = useNodeDef(canvasId, node.definitionId);
  // Deleted pips show only where this node still has a wire on them
  const wiredGhosts = useApp((s) =>
    storedDef?.pips.some((p) => p.removed)
      ? storedDef.pips
          .filter((p) => p.removed && wiresAt(s.canvases[s.activeCanvasId], node.id, p.id).length > 0)
          .map((p) => p.id)
          .join(",")
      : ""
  );
  const def = useMemo(
    () => storedDef && { ...storedDef, pips: storedDef.pips.filter((p) => !p.removed || wiredGhosts.split(",").includes(p.id)) },
    [storedDef, wiredGhosts]
  );
  const selected = useApp((s) => s.selection.includes(node.id));
  // Everything inside an external node is external too
  const insideExternal = useApp((s) => s.trail.some((cid) => !!canvasOwner(s.definitions, cid)?.external));
  // Positions of every selected node at drag start, so multi-drag moves the group.
  const dragOrigin = useRef<{ startX: number; startY: number; peers: { id: string; x: number; y: number }[] } | null>(null);

  if (!def) return null;

  const handleDragStart = (e: Konva.KonvaEventObject<DragEvent>) => {
    const s = useApp.getState();
    s.pushUndo();
    let sel = s.selection;
    if (!sel.includes(node.id)) {
      sel = [node.id];
      s.setSelection(sel);
    }
    const canvas = s.canvases[s.activeCanvasId];
    dragOrigin.current = {
      startX: e.target.x(),
      startY: e.target.y(),
      peers: canvas.nodes
        .filter((n) => sel.includes(n.id))
        .map((n) => ({ id: n.id, x: n.x, y: n.y })),
    };
  };

  const handleDragMove = (e: Konva.KonvaEventObject<DragEvent>) => {
    const origin = dragOrigin.current;
    if (!origin) return;
    const dx = e.target.x() - origin.startX;
    const dy = e.target.y() - origin.startY;
    useApp.getState().moveNodes(
      origin.peers.map((p) => ({ id: p.id, x: p.x + dx, y: p.y + dy }))
    );
  };

  const handleClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (e.evt.button !== 0) return;
    e.cancelBubble = true;
    const s = useApp.getState();
    if (e.evt.ctrlKey || e.evt.shiftKey) {
      s.toggleSelected(node.id);
    } else {
      s.setSelection([node.id]);
    }
  };

  return (
    <Group
      x={node.x}
      y={node.y}
      draggable
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={() => (dragOrigin.current = null)}
      onClick={handleClick}
      onMouseEnter={() => useNodeHover.setState({ nodeId: node.id })}
      onMouseLeave={() => useNodeHover.setState({ nodeId: null })}
      onDblClick={(e) => {
        if (e.evt.button !== 0) return;
        e.cancelBubble = true;
        useApp.getState().enterDefinition(node.definitionId);
      }}
    >
      <NodeVisual def={def} selected={selected} external={!!def.external || insideExternal} />
      {selected && def.expandable && (
        <Group
          x={NODE_WIDTH - 4}
          y={4}
          onClick={(e) => {
            e.cancelBubble = true;
            useApp.getState().expandNode(node.id);
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
          <Circle radius={9} fill="#2b3a55" stroke="#4c9aff" strokeWidth={1.5} />
          {/* expand glyph: outward arrows */}
          <Line points={[-1.5, 1.5, -4.5, 1.5, -4.5, 4.5]} stroke="#e2e4ee" strokeWidth={1.5} listening={false} />
          <Line points={[1.5, -1.5, 4.5, -1.5, 4.5, -4.5]} stroke="#e2e4ee" strokeWidth={1.5} listening={false} />
        </Group>
      )}
      {[...pipOffsets(def).entries()].map(([pipId, off]) => {
        const pip = def.pips.find((p) => p.id === pipId)!;
        return (
          <PipShape key={pipId} nodeId={node.id} ownerName={def.portOf ?? def.name} pip={pip} x={off.x} y={off.y} />
        );
      })}
    </Group>
  );
}
