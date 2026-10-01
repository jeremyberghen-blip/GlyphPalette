import { Circle, Group, Label, Tag, Text, RegularPolygon } from "react-konva";
import Konva from "konva";
import { useState } from "react";
import { PipDef } from "../types";
import { PIP_RADIUS, sideVector, canConnect } from "../lib/graph";
import { useApp, getPip } from "../store";
import { connLabel, isAnyStyle } from "../lib/connections";

interface Props {
  nodeId: string;
  pip: PipDef;
  x: number;
  y: number;
}

/** Size of the in/out mark, small enough that the style core shows around it. */
const DIR_MARK = 2.2;

/** Angle (deg) so a triangle points along the given vector. */
function angleFor(v: { x: number; y: number }): number {
  return (Math.atan2(v.y, v.x) * 180) / Math.PI + 90;
}

export default function PipShape({ nodeId, pip, x, y }: Props) {
  const transport = useApp((s) => s.transports[pip.transportId]);
  const style = useApp((s) => s.styles[pip.styleId]);
  const label = useApp((s) => connLabel(pip, s.transports, s.styles));
  const wireDrag = useApp((s) => s.wireDrag);
  const [hover, setHover] = useState(false);

  const color = transport?.color ?? "#888";
  const core = !isAnyStyle(pip.styleId) ? style?.color : undefined;

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
          const stage = e.target.getStage();
          if (stage) stage.container().style.cursor = "pointer";
        }}
        onMouseLeave={(e) => {
          setHover(false);
          const stage = e.target.getStage();
          if (stage) stage.container().style.cursor = "";
        }}
      />
      {/* Style core; drawn under the direction mark, which stays small so the color reads */}
      {core && <Circle radius={PIP_RADIUS * 0.55} fill={core} listening={false} />}
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
          x={outward.x * 14}
          y={outward.y * 14 - 10}
          listening={false}
        >
          <Tag
            fill="#2b2d3a"
            stroke="#4a4e63"
            strokeWidth={1}
            cornerRadius={4}
          />
          <Text
            text={` ${pip.label} · ${label} ${
              pip.direction === "inbound"
                ? "(in)"
                : pip.direction === "outbound"
                ? "(out)"
                : pip.direction === "bidirectional"
                ? "(bi)"
                : ""
            } `}
            fontSize={11}
            fontFamily="Segoe UI, sans-serif"
            fill="#e2e4ee"
            padding={3}
          />
        </Label>
      )}
    </Group>
  );
}
