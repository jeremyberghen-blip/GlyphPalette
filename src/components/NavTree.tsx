import { useState } from "react";
import {
  icons,
  ChevronRight,
  ChevronDown,
  PanelRightClose,
  PanelRightOpen,
  Home,
} from "lucide-react";
import { Layer, NodeInstance } from "../types";
import { useApp } from "../store";
import { LAYER_COLORS, layerLabel } from "../lib/layerStyle";

/** Colored dot for the layer a row opens into; the layer name shows on hover. */
function LayerDot({ layer, pocket = false }: { layer: Layer; pocket?: boolean }) {
  return (
    <span
      className="ml-auto mr-1 h-2 w-2 shrink-0 rounded-full"
      style={{ background: LAYER_COLORS[layer] }}
      title={layerLabel(layer, pocket)}
    />
  );
}

const MAX_DEPTH = 16;

function TreeNode({
  node,
  trail,
  depth,
}: {
  node: NodeInstance;
  /** Canvas path leading to (and including) the canvas this node sits on. */
  trail: string[];
  depth: number;
}) {
  const def = useApp((s) => s.definitions[node.definitionId]);
  const canvases = useApp((s) => s.canvases);
  const activeCanvasId = useApp((s) => s.activeCanvasId);
  const selected = useApp(
    (s) => s.activeCanvasId === trail[trail.length - 1] && s.selection.includes(node.id)
  );
  const [open, setOpen] = useState(false);
  const customIcons = useApp((s) => s.customIcons);
  if (!def) return null;

  const childCanvas = def.canvasId ? canvases[def.canvasId] : null;
  // A node is expandable when it has a canvas that isn't already an ancestor (cycle guard)
  const expandable =
    !!childCanvas && depth < MAX_DEPTH && !trail.includes(childCanvas.id);
  const insideThis = childCanvas && activeCanvasId === childCanvas.id;

  const Lucide = !def.icon.startsWith("custom:")
    ? icons[def.icon as keyof typeof icons]
    : null;

  return (
    <div>
      <div
        className={`flex cursor-pointer items-center gap-1 rounded px-1 py-0.5 text-xs hover:bg-[#2b2d3a] ${
          selected || insideThis ? "bg-[#2b3a55] text-white" : "text-[#c9cbd8]"
        }`}
        style={{ paddingLeft: depth * 14 + 4 }}
        onClick={() => {
          if (expandable) {
            // Enter the node's canvas (folder behavior)
            useApp.getState().navigateTo([...trail, childCanvas!.id]);
            setOpen(true);
          } else {
            // Leaf: go to its parent canvas and select it
            useApp.getState().navigateTo(trail, node.id);
          }
        }}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            setOpen(!open);
          }}
          className={`flex h-4 w-4 shrink-0 items-center justify-center text-[#565a72] hover:text-white ${
            expandable ? "" : "invisible"
          }`}
        >
          {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        </button>
        {Lucide ? (
          <Lucide size={13} className="shrink-0" />
        ) : (
          <img
            src={customIcons[def.icon.slice(7)]}
            className="h-3.5 w-3.5 shrink-0 object-contain"
            alt=""
          />
        )}
        <span className="truncate">{def.name}</span>
        {childCanvas && <LayerDot layer={childCanvas.layer} pocket={!!def.expandable} />}
      </div>
      {open && expandable && (
        <div>
          {childCanvas!.nodes.map((n) => (
            <TreeNode
              key={n.id}
              node={n}
              trail={[...trail, childCanvas!.id]}
              depth={depth + 1}
            />
          ))}
          {childCanvas!.nodes.length === 0 && (
            <div
              className="px-1 py-0.5 text-[10px] italic text-[#565a72]"
              style={{ paddingLeft: (depth + 1) * 14 + 24 }}
            >
              empty
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function NavTree() {
  const [collapsed, setCollapsed] = useState(false);
  const root = useApp((s) => s.canvases["canvas-root"]);
  const activeCanvasId = useApp((s) => s.activeCanvasId);

  if (collapsed) {
    return (
      <div className="flex w-9 shrink-0 flex-col items-center border-l border-[#2e3040] bg-[#1e1f28] pt-2">
        <button
          onClick={() => setCollapsed(false)}
          className="rounded p-1.5 text-[#7a7d92] hover:bg-[#2b2d3a] hover:text-white"
          title="Show navigator"
        >
          <PanelRightOpen size={16} />
        </button>
      </div>
    );
  }

  return (
    <aside className="flex w-56 shrink-0 flex-col border-l border-[#2e3040] bg-[#1e1f28]">
      <div className="flex items-center justify-between border-b border-[#2e3040] px-2.5 py-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[#565a72]">
          Navigator
        </span>
        <button
          onClick={() => setCollapsed(true)}
          className="rounded p-1 text-[#7a7d92] hover:bg-[#2b2d3a] hover:text-white"
          title="Hide navigator"
        >
          <PanelRightClose size={14} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-1.5">
        <div
          className={`flex cursor-pointer items-center gap-1.5 rounded px-1.5 py-0.5 text-xs hover:bg-[#2b2d3a] ${
            activeCanvasId === "canvas-root" ? "bg-[#2b3a55] text-white" : "text-[#c9cbd8]"
          }`}
          onClick={() => useApp.getState().navigateTo(["canvas-root"])}
        >
          <Home size={12} className="shrink-0" />
          <span>Root</span>
          <LayerDot layer={root.layer} />
        </div>
        {root.nodes.map((n) => (
          <TreeNode key={n.id} node={n} trail={["canvas-root"]} depth={1} />
        ))}
      </div>
    </aside>
  );
}
