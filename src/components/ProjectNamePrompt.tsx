import { useEffect, useState } from "react";
import { useNamePrompt } from "../lib/fileActions";
import { projectFolderName } from "../lib/paths";

/** New project: asks for its name, which also names its build folder. */
export default function ProjectNamePrompt() {
  const { initial, resolve } = useNamePrompt();
  const [name, setName] = useState("");

  useEffect(() => {
    if (initial !== null) setName(initial);
  }, [initial]);

  if (initial === null || !resolve) return null;
  const trimmed = name.trim();
  const create = () => trimmed && resolve(trimmed);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60">
      <div className="w-[380px] rounded-lg border border-[#3a3d52] bg-[#22242e] p-4 shadow-2xl">
        <div className="mb-3 text-sm font-semibold text-[#e2e4ee]">New project</div>
        <label className="mb-1 block text-xs text-[#7a7d92]">Project name</label>
        <input
          className="w-full rounded border border-[#3a3d52] bg-[#191a21] px-2 py-1 text-sm text-[#e2e4ee] outline-none focus:border-[#4c9aff]"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Snip"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") create();
            if (e.key === "Escape") resolve(null);
          }}
        />
        <div className="mt-1 h-4 text-xs text-[#7a7d92]">
          {trimmed && (
            <>
              Builds into <span className="font-mono text-[#c9cbd8]">{projectFolderName(trimmed)}/</span> · nothing is
              saved until you save
            </>
          )}
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <button
            onClick={() => resolve(null)}
            className="rounded border border-[#3a3d52] px-3 py-1.5 text-sm text-[#c9cbd8] hover:border-[#7a7d92]"
          >
            Cancel
          </button>
          <button
            onClick={create}
            disabled={!trimmed}
            className="rounded bg-[#2b6cb0] px-3 py-1.5 text-sm text-white hover:bg-[#3182ce] disabled:opacity-40 disabled:hover:bg-[#2b6cb0]"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}
