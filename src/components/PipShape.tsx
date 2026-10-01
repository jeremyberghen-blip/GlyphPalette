import { Circle, Group, Label, Tag, Text, RegularPolygon } from "react-konva";
import { useNodeHover } from "./InfoCard";
import Konva from "konva";
import { useState } from "react";
import { PipDef } from "../types";
import { PIP_RADIUS, sideVector, canConnect } from "../lib/graph";
import { useApp, getPip, isLockedPort } from "../store";
import { connLabel, isAnyStyle } from "../lib/connections";
import { BROKEN_COLOR, brokenReason, wiresAt } from "../lib/broken";

interface Props {
  nodeId: string;
  /** Name of the node's definition, for broken-link tooltips. */
  ownerName: string;
  pip: PipDef;
  x: number;
  y: number;
}

/** Size of the in/out mark, small enough that the style core shows around it. */
const DIR_MARK = 3.3;

/** Angle (deg) so a triangle points along the given vector. */
function angleFor(v: { x: number; y: number }): number {
  return (Math.atan2(v.y, v.x) * 180) / Math.PI + 90;
}

export default function PipShape({ nodeId, ownerName, pip, x, y }: Props) {
  const transport = useApp((s) => s.transports[pip.transportId]);
  const style = useApp((s) => s.styles[pip.styleId]);
  const label = useApp((s) => connLabel(pip, s.transports, s.styles));
  const wireDrag = useApp((s) => s.wireDrag);
  const [hover, setHover] = useState(false);

  // Broken: deleted from its definition, or retyped so an attached wire no longer fits
  const broken = useApp((s) => {
    const canvas = s.canvases[s.activeCanvasId];
    return brokenReason(pip, wiresAt(canvas, nodeId, pip.id), ownerName, s.transports, s.styles);
  });

  const color = broken ? BROKEN_COLOR : transport?.color ?? "#888";
  const core = !broken && !isAnyStyle(pip.styleId) ? style?.color : undefined;

  // While a wire is being dragged, light up compatible pips and dim the rest
  let validTarget = false;
  let dimmed = false;
  if (wireDrag) {
    if (wireDrag.fromNodeId === nodeId && wireDrag.fromPipId === pip.id) {
      // origin pip stays bright
    } else {
      const s = useApp.getState();
      const fromPip = getPip(s, wireDrag.fromNodeId, wireDrag.fromPipId);
      validTarget = !!fromPip && canConnect(fromPip, pip);
      dimmed = !validTarget;
    }
  }
  const snapped =
    wireDrag?.snap?.nodeId === nodeId && wireDrag?.snap?.pipId === pip.id;

  const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (e.evt.button !== 0) return;
    e.cancelBubble = true; // keep the node from starting a drag
    if (isLockedPort(useApp.getState(), nodeId)) return; // a pocket's ports aren't rewired by hand
    const stage = e.target.getStage();
    if (!stage) return;
    const p = stage.getPointerPosition();
    if (!p) return;
    const world = {
      x: (p.x - stage.x()) / stage.scaleX(),
      y: (p.y - stage.y()) / stage.scaleY(),
    };
    useApp.getState().startWire(nodeId, pip.id, world);
  };

  const outward = sideVector(pip.side);
  const inward = { x: -outward.x, y: -outward.y };

  return (
    <Group x={x} y={y} opacity={dimmed ? 0.25 : 1}>
      {(validTarget || snapped) && (
        <Circle
          radius={PIP_RADIUS + (snapped ? 5 : 3)}
          stroke={color}
          strokeWidth={snapped ? 2.5 : 1.5}
          opacity={snapped ? 1 : 0.7}
          listening={false}
        />
      )}
      <Circle
        radius={PIP_RADIUS}
        fill={color}
        stroke="#191a21"
        strokeWidth={1.5}
        hitStrokeWidth={8}
        onMouseDown={handleMouseDown}
        onClick={(e) => (e.cancelBubble = true)}
        onMouseEnter={(e) => {
          setHover(true);
          useNodeHover.setState({ overPip: true }); // the pip's own tooltip, not the node's card
          const stage = e.target.getStage();
          if (stage) stage.container().style.cursor = "pointer";
        }}
        onMouseLeave={(e) => {
          setHover(false);
          useNodeHover.setState({ overPip: false });
          const stage = e.target.getStage();
          if (stage) stage.container().style.cursor = "";
        }}
      />
      {/* Style core; drawn under the direction mark, which stays small so the color reads */}
      {/* Black outline keeps the style color distinct from the transport ring */}
      {core && (
        <Circle radius={PIP_RADIUS * 0.55} fill={core} stroke="#000000" strokeWidth={1.25} listening={false} />
      )}
      {/* Direction marker: triangle out = outbound, in = inbound, diamond = bidirectional */}
      {pip.direction === "outbound" && (
        <RegularPolygon
          sides={3}
          radius={DIR_MARK}
          fill="#191a21"
          rotation={angleFor(outward)}
          listening={false}
        />
      )}
      {pip.direction === "inbound" && (
        <RegularPolygon
          sides={3}
          radius={DIR_MARK}
          fill="#191a21"
          rotation={angleFor(inward)}
          listening={false}
        />
      )}
      {pip.direction === "bidirectional" && (
        <RegularPolygon
          sides={4}
          radius={DIR_MARK}
          fill="#191a21"
          listening={false}
        />
      )}
      {(hover || snapped) && transport && (
        <Label
          x={outward.x * (PIP_RADIUS + 8)}
          y={outward.y * (PIP_RADIUS + 8) - 10}
          // A long broken-link note on a left-side pip opens leftward, off the node
          offsetX={broken && outward.x < 0 ? 240 : 0}
          listening={false}
        >
          <Tag fill={broken ? "#2a1618" : "#2b2d3a"} stroke={broken ? "#7f1d1d" : "#4a4e63"} strokeWidth={1} cornerRadius={4} />
          <Text
            text={broken ?? ` ${pip.label} · ${label} ${
              pip.direction === "inbound"
                ? "(in)"
                : pip.direction === "outbound"
                ? "(out)"
                : pip.direction === "bidirectional"
                ? "(bi)"
                : ""
            } `}
            width={broken ? 240 : undefined}
            fontSize={11}
            fontFamily="Segoe UI, sans-serif"
            fill={broken ? "#fecaca" : "#e2e4ee"}
            padding={broken ? 5 : 3}
          />
        </Label>
      )}
    </Group>
  );
}
