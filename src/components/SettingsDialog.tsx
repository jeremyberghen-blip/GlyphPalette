import { X } from "lucide-react";
import { useSettings } from "../lib/settings";
import { AUTOSAVE_CHOICES } from "../lib/session";

/** App settings (per machine). Autosave interval is the first. */
export default function SettingsDialog({ onClose }: { onClose: () => void }) {
  const autosaveMinutes = useSettings((s) => s.autosaveMinutes);
  const update = useSettings((s) => s.update);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="w-[360px] rounded-lg border border-[#3a3d52] bg-[#22242e] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#2e3040] px-4 py-3">
          <span className="text-sm font-semibold text-[#e2e4ee]">Settings</span>
          <button onClick={onClose} className="text-[#7a7d92] hover:text-white">
            <X size={16} />
          </button>
        </div>
        <div className="space-y-1.5 px-4 py-4">
          <label className="block text-xs text-[#7a7d92]" htmlFor="autosave">
            Autosave
          </label>
          <select
            id="autosave"
            value={autosaveMinutes}
            onChange={(e) => update({ autosaveMinutes: Number(e.target.value) })}
            className="w-full rounded border border-[#3a3d52] bg-[#191a21] px-2 py-1 text-sm text-[#e2e4ee] outline-none focus:border-[#4c9aff]"
          >
            {AUTOSAVE_CHOICES.map((m) => (
              <option key={m} value={m}>
                {m === 0 ? "Never" : `Every ${m} minute${m === 1 ? "" : "s"}`}
              </option>
            ))}
          </select>
          <div className="text-xs text-[#565a72]">
            Saves to the project's file when there are unsaved changes. A new project autosaves
            once you've saved it the first time.
          </div>
        </div>
      </div>
    </div>
  );
}
