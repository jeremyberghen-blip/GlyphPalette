import { useMemo, useState } from "react";
import { create } from "zustand";
import { AlertTriangle } from "lucide-react";
import { useApp } from "../store";
import {
  automaticPath,
  buildPlan,
  normalizeOverride,
  placementForTrail,
  placementsOf,
  relativeToProject,
} from "../lib/paths";

/** The node (on the active canvas) whose path is being overridden, if the dialog is open. */
export const usePathDialog = create<{ nodeId: string | null }>(() => ({ nodeId: null }));
export const openPathDialog = (nodeId: string) => usePathDialog.setState({ nodeId });
const close = () => usePathDialog.setState({ nodeId: null });

/** Override path…: shows the computed path and takes a full path from the project folder. */
export default function PathOverrideDialog() {
  const nodeId = usePathDialog((s) => s.nodeId);
  return nodeId ? <Dialog key={nodeId} nodeId={nodeId} /> : null;
}

function Dialog({ nodeId }: { nodeId: string }) {
  const projectName = useApp((s) => s.projectName);
  const canvases = useApp((s) => s.canvases);
  const definitions = useApp((s) => s.definitions);
  const trail = useApp((s) => s.trail);
  const canvasId = useApp((s) => s.activeCanvasId);
  const node = canvases[canvasId]?.nodes.find((n) => n.id === nodeId);
  const def = node ? definitions[node.definitionId] : undefined;

  const plan = useMemo(() => buildPlan(projectName, canvases, definitions), [projectName, canvases, definitions]);
  const auto = useMemo(
    () => automaticPath(projectName, canvases, definitions, canvasId, nodeId, trail),
    [projectName, canvases, definitions, canvasId, nodeId, trail]
  );
  const here = placementForTrail(plan, nodeId, trail);
  const autoRel = auto ? relativeToProject(auto, plan.projectFolder) : "";
  const [text, setText] = useState(node?.pathOverride ?? autoRel);

  if (!node || !def || !here) return null;
  const typed = normalizeOverride(text);
  const isFile = here.status === "file";
  const shared = placementsOf(plan, nodeId).length;
  const save = () => {
    // Typing the automatic path back in is the same as no override (it keeps following renames)
    useApp.getState().setPathOverride(nodeId, typed === autoRel ? null : typed);
    close();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60">
      <div className="w-[460px] rounded-lg border border-[#3a3d52] bg-[#22242e] p-4 shadow-2xl">
        <div className="mb-3 text-sm font-semibold text-[#e2e4ee]">Override path — {def.name}</div>

        <div className="mb-3 text-xs">
          <div className="mb-0.5 text-[#7a7d92]">Automatic path</div>
          <div className="break-all font-mono text-[#c9cbd8]">
            {auto}
            {!isFile && "/"}
          </div>
        </div>

        <label className="mb-1 block text-xs text-[#7a7d92]">
          Path from the project folder{isFile && " — include the file name"}
        </label>
        <div className="flex items-center rounded border border-[#3a3d52] bg-[#191a21] focus-within:border-[#4c9aff]">
          <span className="pl-2 font-mono text-sm text-[#7a7d92]">{plan.projectFolder}/</span>
          <input
            className="min-w-0 flex-1 bg-transparent py-1 pr-2 font-mono text-sm text-[#e2e4ee] outline-none"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={isFile ? "config/settings.py" : "services/links"}
            autoFocus
            onFocus={(e) => e.target.select()}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") close();
            }}
          />
        </div>
        <div className="mt-1 text-xs text-[#7a7d92]">
          {typed === autoRel ? (
            "Same as the automatic path — it will keep following renames."
          ) : !typed ? (
            "Empty — the automatic path is used."
          ) : (
            <>
              Builds at{" "}
              <span className="break-all font-mono text-[#c9cbd8]">
                {[plan.projectFolder, typed].filter(Boolean).join("/")}
                {!isFile && "/"}
              </span>
              {!isFile && " — what's inside follows it"}
            </>
          )}
        </div>
        {shared > 1 && (
          <div className="mt-2 flex gap-1.5 text-xs text-[#fbbf24]">
            <AlertTriangle size={13} className="mt-px shrink-0" />
            This node is built in {shared} places (something it's inside is placed more than once); an override sends
            every one of them to this path.
          </div>
        )}

        <div className="mt-4 flex items-center gap-2">
          {node.pathOverride && (
            <button
              onClick={() => {
                useApp.getState().setPathOverride(nodeId, null);
                close();
              }}
              className="rounded border border-[#3a3d52] px-3 py-1.5 text-sm text-[#c9cbd8] hover:border-[#7a7d92]"
            >
              Use automatic
            </button>
          )}
          <div className="flex-1" />
          <button
            onClick={close}
            className="rounded border border-[#3a3d52] px-3 py-1.5 text-sm text-[#c9cbd8] hover:border-[#7a7d92]"
          >
            Cancel
          </button>
          <button onClick={save} className="rounded bg-[#2b6cb0] px-3 py-1.5 text-sm text-white hover:bg-[#3182ce]">
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
