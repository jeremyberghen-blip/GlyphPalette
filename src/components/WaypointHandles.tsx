import { Circle, Group, Line } from "react-konva";
import Konva from "konva";
import { useApp, useActiveCanvas } from "../store";
import { HANDLE_RING, handlePosition } from "../lib/waypoints";

const setCursor = (e: Konva.KonvaEventObject<MouseEvent>, cursor: string) => {
  const stage = e.target.getStage();
  if (stage) stage.container().style.cursor = cursor;
};

/**
 * Handles for the bend points of selected wires: drag a dot to move it, click
 * it to select it (Delete removes it). A selected bend point also shows its
 * rotation/length handle — drag it around to turn the straight section, and
 * further out to lengthen it; the faint ring is length 0.
 */
export default function WaypointHandles() {
  const canvas = useActiveCanvas();
  const selection = useApp((s) => s.selection);
  const selectedWaypoint = useApp((s) => s.selectedWaypoint);
  const scale = useApp((s) => s.viewport.scale);
  const transports = useApp((s) => s.transports);
  const size = 1 / scale; // keep handles the same size on screen at any zoom

  const rels = canvas.relationships.filter((r) => selection.includes(r.id) && r.waypoints?.length);
  return (
    <>
      {rels.map((r) =>
        r.waypoints!.map((w, i) => {
          const color = transports[r.transportId]?.color ?? "#888";
          const isSelected = selectedWaypoint?.relId === r.id && selectedWaypoint.index === i;
          const h = handlePosition(w);
          return (
            <Group key={`${r.id}-${i}`}>
              {isSelected && (
                <>
                  <Circle
                    x={w.x}
                    y={w.y}
                    radius={HANDLE_RING}
                    stroke={color}
                    strokeWidth={size}
                    dash={[3 * size, 3 * size]}
                    opacity={0.5}
                    listening={false}
                  />
                  <Line points={[w.x, w.y, h.x, h.y]} stroke={color} strokeWidth={size} opacity={0.6} listening={false} />
                  <Circle
                    x={h.x}
                    y={h.y}
                    radius={4.5 * size}
                    fill="#e2e4ee"
                    stroke={color}
                    strokeWidth={1.5 * size}
                    draggable
                    onMouseDown={(e) => (e.cancelBubble = true)}
                    onDragStart={(e) => {
                      e.cancelBubble = true;
                      useApp.getState().pushUndo();
                    }}
                    onDragMove={(e) => {
                      e.cancelBubble = true;
                      useApp.getState().dragWaypointHandle(r.id, i, { x: e.target.x(), y: e.target.y() });
                      // Snap back onto the constrained position (never inside the ring)
                      const w2 = useApp.getState().canvases[canvas.id].relationships.find((x) => x.id === r.id)?.waypoints?.[i];
                      if (w2) e.target.position(handlePosition(w2));
                    }}
                    onMouseEnter={(e) => setCursor(e, "grab")}
                    onMouseLeave={(e) => setCursor(e, "")}
                  />
                </>
              )}
              <Circle
                x={w.x}
                y={w.y}
                radius={5 * size}
                fill={isSelected ? color : "#191a21"}
                stroke={color}
                strokeWidth={2 * size}
                draggable
                onMouseDown={(e) => (e.cancelBubble = true)}
                onClick={(e) => {
                  e.cancelBubble = true;
                  useApp.getState().selectWaypoint(r.id, i);
                }}
                onDragStart={(e) => {
                  e.cancelBubble = true;
                  const s = useApp.getState();
                  s.pushUndo();
                  s.selectWaypoint(r.id, i);
                }}
                onDragMove={(e) => {
                  e.cancelBubble = true;
                  useApp.getState().moveWaypoint(r.id, i, { x: e.target.x(), y: e.target.y() });
                }}
                onMouseEnter={(e) => setCursor(e, "move")}
                onMouseLeave={(e) => setCursor(e, "")}
              />
            </Group>
          );
        })
      )}
    </>
  );
}
