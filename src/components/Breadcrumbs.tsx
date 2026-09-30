import { ArrowLeft, ChevronRight } from "lucide-react";
import { useApp, canvasLabel } from "../store";
import { isPocket } from "../lib/layers";
import { LAYER_COLORS, layerLabel } from "../lib/layerStyle";

/** Floating back button + breadcrumb trail, top-left corner of the canvas. */
export default function Breadcrumbs() {
  const trail = useApp((s) => s.trail);
  const definitions = useApp((s) => s.definitions);
  const canvases = useApp((s) => s.canvases);
  if (trail.length <= 1) return null;

  const tag = (cid: string) => {
    const layer = canvases[cid]?.layer;
    if (!layer) return null;
    return (
      <span
        className="ml-1 rounded border px-1 text-[9px] font-semibold uppercase tracking-wide"
        style={{ color: LAYER_COLORS[layer], borderColor: `${LAYER_COLORS[layer]}66` }}
      >
        {layerLabel(layer, isPocket(definitions, cid))}
      </span>
    );
  };

  return (
    <div className="pointer-events-none absolute left-3 top-3 z-10 flex items-center gap-1.5">
      <button
        onClick={() => useApp.getState().goBack()}
        className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full border border-[#3a3d52] bg-[#22242e]/90 text-[#c9cbd8] shadow-lg hover:border-[#4c9aff] hover:text-white"
        title="Back (up one level)"
      >
        <ArrowLeft size={15} />
      </button>
      <div className="pointer-events-auto flex items-center gap-0.5 rounded-full border border-[#3a3d52] bg-[#22242e]/90 px-3 py-1.5 text-xs shadow-lg">
        {trail.map((cid, i) => (
          <span key={cid} className="flex items-center gap-0.5">
            {i > 0 && <ChevronRight size={11} className="text-[#565a72]" />}
            {i < trail.length - 1 ? (
              <button
                onClick={() => useApp.getState().jumpTo(i)}
                className="text-[#8a8ea6] hover:text-[#4c9aff]"
              >
                {canvasLabel({ definitions }, cid)}
                {tag(cid)}
              </button>
            ) : (
              <span className="font-semibold text-[#e2e4ee]">
                {canvasLabel({ definitions }, cid)}
                {tag(cid)}
              </span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
