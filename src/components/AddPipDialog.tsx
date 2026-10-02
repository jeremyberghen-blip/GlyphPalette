import { useState } from "react";
import { create } from "zustand";
import { useApp, uid } from "../store";
import { PipDef } from "../types";
import { defaultConnType } from "../lib/connections";
import { defaultSide } from "../lib/pips";
import PipFields from "./PipFields";
import { LegendPanel } from "./LegendButton";

/** The definition getting a new pip (from a node's right-click menu), if the window is open. */
export const useAddPipDialog = create<{ defId: string | null }>(() => ({ defId: null }));
export const openAddPipDialog = (defId: string) => useAddPipDialog.setState({ defId });
const close = () => useAddPipDialog.setState({ defId: null });

/** Add pip…: one pip's fields in a small window, added to the node's definition on OK. */
export default function AddPipDialog() {
  const defId = useAddPipDialog((s) => s.defId);
  return defId ? <Dialog key={defId} defId={defId} /> : null;
}

function Dialog({ defId }: { defId: string }) {
  const def = useApp((s) => s.definitions[defId]);
  const [pip, setPip] = useState<PipDef>(() => {
    const s = useApp.getState();
    return {
      id: `pip-${uid()}`,
      label: "",
      ...defaultConnType(s.transports, s.styles, def?.layers ?? ["container"]),
      direction: "inbound",
      side: defaultSide("inbound"),
    };
  });
  // The side follows the direction until it's picked by hand
  const [sideChosen, setSideChosen] = useState(false);

  if (!def) return null;
  const ok = pip.label.trim().length > 0 && !!pip.transportId;
  const add = () => {
    if (!ok) return;
    useApp.getState().addPip(defId, { ...pip, label: pip.label.trim() });
    close();
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center gap-3 bg-black/60"
      onKeyDown={(e) => e.key === "Escape" && close()}
    >
      <LegendPanel className="max-[720px]:hidden" />
      <div className="w-[360px] rounded-lg border border-[#3a3d52] bg-[#22242e] p-4 shadow-2xl">
        <div className="mb-3 text-sm font-semibold text-[#e2e4ee]">Add pip — {def.name}</div>
        <PipFields
          pip={pip}
          layers={def.layers}
          layout="form"
          autoFocusLabel
          onLabelEnter={add}
          onChange={(patch) => {
            if (patch.side) setSideChosen(true);
            setPip((p) => ({
              ...p,
              ...patch,
              ...(patch.direction && !patch.side && !sideChosen ? { side: defaultSide(patch.direction) } : {}),
            }));
          }}
        />
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={close}
            className="rounded border border-[#3a3d52] px-3 py-1.5 text-sm text-[#c9cbd8] hover:border-[#7a7d92]"
          >
            Cancel
          </button>
          <button
            onClick={add}
            disabled={!ok}
            title={ok ? undefined : "Give the pip a label"}
            className="rounded bg-[#2b6cb0] px-4 py-1.5 text-sm text-white hover:bg-[#3182ce] disabled:opacity-40"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
