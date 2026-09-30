import { useEffect } from "react";
import { useUnsavedPrompt } from "../lib/fileActions";

/** The Save / Don't save / Cancel dialog shown before unsaved work would be lost. */
export default function UnsavedPrompt() {
  const { question, resolve } = useUnsavedPrompt();

  useEffect(() => {
    if (!resolve) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") resolve("cancel");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [resolve]);

  if (!question || !resolve) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60">
      <div className="w-[380px] rounded-lg border border-[#3a3d52] bg-[#22242e] p-4 shadow-2xl">
        <div className="mb-1 text-sm font-semibold text-[#e2e4ee]">Unsaved changes</div>
        <div className="mb-4 text-sm text-[#c9cbd8]">{question}</div>
        <div className="flex justify-end gap-2">
          <button
            onClick={() => resolve("cancel")}
            className="rounded border border-[#3a3d52] px-3 py-1.5 text-sm text-[#c9cbd8] hover:border-[#7a7d92]"
          >
            Cancel
          </button>
          <button
            onClick={() => resolve("discard")}
            className="rounded border border-[#3a3d52] px-3 py-1.5 text-sm text-[#c9cbd8] hover:border-[#f87171] hover:text-[#fecaca]"
          >
            Don't save
          </button>
          <button
            onClick={() => resolve("save")}
            className="rounded bg-[#2b6cb0] px-3 py-1.5 text-sm text-white hover:bg-[#3182ce]"
            autoFocus
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
