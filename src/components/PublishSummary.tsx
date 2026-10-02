import { useEffect } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { usePublishSummary } from "../lib/fileActions";

const close = () => usePublishSummary.setState({ result: null });

/** After Publish: where `architecture.json` went, what's in it, and anything worth fixing. */
export default function PublishSummary() {
  const result = usePublishSummary((s) => s.result);

  useEffect(() => {
    if (!result) return;
    const onKey = (e: KeyboardEvent) => (e.key === "Escape" || e.key === "Enter") && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [result]);

  if (!result) return null;
  const { path, summary, warnings } = result;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60">
      <div className="w-[520px] rounded-lg border border-[#3a3d52] bg-[#22242e] p-4 shadow-2xl">
        <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-[#e2e4ee]">
          <CheckCircle2 size={16} className="text-[#4ade80]" /> Published for Hephaestus
        </div>
        <div className="mb-3 break-all font-mono text-xs text-[#8a8ea6]">{path}</div>
        <div className="mb-3 text-sm text-[#c9cbd8]">{summary}</div>
        {warnings.length ? (
          <div className="rounded border border-[#4a3a1a] bg-[#2a2418] p-2">
            <div className="mb-1 text-xs font-semibold text-[#fbbf24]">
              {warnings.length} thing{warnings.length === 1 ? "" : "s"} worth a look — published anyway
            </div>
            <ul className="max-h-60 space-y-1 overflow-y-auto">
              {warnings.map((w, i) => (
                <li key={i} className="flex gap-1.5 text-xs text-[#e9d9b0]">
                  <AlertTriangle size={12} className="mt-0.5 shrink-0 text-[#fbbf24]" />
                  <span className="min-w-0 break-words">{w}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="text-xs text-[#7a7d92]">No warnings.</div>
        )}
        <div className="mt-4 flex justify-end">
          <button
            onClick={close}
            className="rounded bg-[#2b6cb0] px-4 py-1.5 text-sm text-white hover:bg-[#3182ce]"
            autoFocus
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
