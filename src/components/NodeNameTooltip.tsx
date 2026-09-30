import { useEffect, useState } from "react";
import { Label, Tag, Text } from "react-konva";
import Konva from "konva";
import { create } from "zustand";
import { useApp, useActiveCanvas } from "../store";
import { NODE_WIDTH } from "../types";
import { isTruncated } from "../lib/text";

const HOVER_DELAY_MS = 400;
/** Matches the node label in NodeVisual: 14px Segoe UI in NODE_WIDTH - 8. */
const LABEL_WIDTH = NODE_WIDTH - 8;
const measurer = new Konva.Text({ fontSize: 14, fontFamily: "Segoe UI, sans-serif" });
const measure = (t: string) => measurer.measureSize(t).width;

/** Which node the pointer is over (set by NodeShape). */
export const useNodeHover = create<{ nodeId: string | null }>(() => ({ nodeId: null }));

/**
 * Full name above a hovered node whose label is cut off, after a short pause
 * so it doesn't flicker as the mouse sweeps across a busy canvas. Rendered
 * after the nodes so it sits on top of them.
 */
export default function NodeNameTooltip() {
  const nodeId = useNodeHover((s) => s.nodeId);
  const canvas = useActiveCanvas();
  const definitions = useApp((s) => s.definitions);
  const dragging = useApp((s) => !!s.wireDrag);
  const [shownId, setShownId] = useState<string | null>(null);

  useEffect(() => {
    setShownId(null);
    if (!nodeId) return;
    const t = setTimeout(() => setShownId(nodeId), HOVER_DELAY_MS);
    return () => clearTimeout(t);
  }, [nodeId]);

  const node = shownId ? canvas.nodes.find((n) => n.id === shownId) : undefined;
  const name = node ? definitions[node.definitionId]?.name : undefined;
  if (!node || !name || dragging || !isTruncated(name, LABEL_WIDTH, measure)) return null;

  return (
    <Label x={node.x + NODE_WIDTH / 2} y={node.y - 6} listening={false}>
      <Tag
        fill="#2b2d3a"
        stroke="#4a4e63"
        strokeWidth={1}
        cornerRadius={4}
        pointerDirection="down"
        pointerWidth={10}
        pointerHeight={5}
      />
      <Text
        text={name}
        fontSize={13}
        fontFamily="Segoe UI, sans-serif"
        fill="#e2e4ee"
        padding={5}
      />
    </Label>
  );
}
