import { X } from "lucide-react";
import { useToasts } from "../lib/toast";

/**
 * Pop-up messages: a small window dead center for saves/opens/exports (errors
 * in red, staying until clicked away), and a quiet note in the bottom-right
 * corner for autosaves.
 */
export default function Toasts() {
  const toasts = useToasts((s) => s.toasts);
  const dismiss = useToasts((s) => s.dismiss);
  const center = toasts.filter((t) => t.kind !== "autosave");
  const corner = toasts.filter((t) => t.kind === "autosave");

  return (
    <>
      <div className="pointer-events-none fixed inset-0 z-[60] flex flex-col items-center justify-center gap-2">
        {center.map((t) =>
          t.kind === "error" ? (
            <button
              key={t.id}
              onClick={() => dismiss(t.id)}
              className="pointer-events-auto flex max-w-md items-start gap-2 rounded-lg border border-[#7f1d1d] bg-[#2a1618]/95 px-4 py-3 text-left text-sm text-[#fecaca] shadow-2xl"
              title="Dismiss"
            >
              <span className="flex-1">{t.text}</span>
              <X size={14} className="mt-0.5 shrink-0 opacity-70" />
            </button>
          ) : (
            <div
              key={t.id}
              className="toast-fade rounded-lg border border-[#3a3d52] bg-[#22242e]/95 px-4 py-2.5 text-sm text-[#e2e4ee] shadow-2xl"
            >
              {t.text}
            </div>
          )
        )}
      </div>
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex flex-col items-end gap-1.5">
        {corner.map((t) => (
          <div
            key={t.id}
            className="toast-fade rounded border border-[#2e3040] bg-[#22242e]/90 px-2.5 py-1 text-xs text-[#8a8ea6] shadow-lg"
          >
            {t.text}
          </div>
        ))}
      </div>
    </>
  );
}
