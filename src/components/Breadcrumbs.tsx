import { ArrowLeft, ChevronRight } from "lucide-react";
import { useApp, canvasLabel } from "../store";

/** Floating back button + breadcrumb trail, top-left corner of the canvas. */
export default function Breadcrumbs() {
  const trail = useApp((s) => s.trail);
  const definitions = useApp((s) => s.definitions);
  if (trail.length <= 1) return null;

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
              </button>
            ) : (
              <span className="font-semibold text-[#e2e4ee]">
                {canvasLabel({ definitions }, cid)}
              </span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
