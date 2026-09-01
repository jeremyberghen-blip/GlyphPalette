import { useMemo, useState } from "react";
import { icons, X } from "lucide-react";
import { useApp } from "../store";

const DEFAULT_ICONS = ["Folder", "Box", "Layers", "Package", "Boxes", "FolderOpen", "Group", "Grid2x2", "LayoutGrid", "Server", "Cloud", "Network", "Shield", "Database", "Cpu", "Globe", "Lock", "Workflow", "Container", "Warehouse"];

/** Name + icon dialog shown after drawing a new boundary box. */
export default function BoundaryModal() {
  const rect = useApp((s) => s.pendingBoundaryRect);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("Folder");
  const [search, setSearch] = useState("");

  const results = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return DEFAULT_ICONS;
    return Object.keys(icons)
      .filter((n) => n.toLowerCase().includes(q))
      .slice(0, 40);
  }, [search]);

  if (!rect) return null;
  const close = () => useApp.getState().setPendingBoundaryRect(null);
  const create = () => {
    useApp.getState().addBoundary(name.trim() || "Boundary", icon, rect);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-[380px] rounded-lg border border-[#3a3d52] bg-[#22242e] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#2e3040] px-4 py-3">
          <span className="text-sm font-semibold text-[#e2e4ee]">New Boundary</span>
          <button onClick={close} className="text-[#7a7d92] hover:text-white">
            <X size={16} />
          </button>
        </div>
        <div className="space-y-3 px-4 py-3">
          <div>
            <label className="mb-1 block text-xs text-[#7a7d92]">Label</label>
            <input
              className="w-full rounded border border-[#3a3d52] bg-[#191a21] px-2 py-1 text-sm text-[#e2e4ee] outline-none focus:border-[#4c9aff]"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Backend Services"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") create();
                if (e.key === "Escape") close();
              }}
            />
          </div>
          <div>
            <div className="mb-1 flex items-center gap-2">
              <label className="text-xs text-[#7a7d92]">Icon</label>
              <input
                className="flex-1 rounded border border-[#3a3d52] bg-[#191a21] px-2 py-0.5 text-xs text-[#e2e4ee] outline-none focus:border-[#4c9aff]"
                placeholder="Search icons…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="grid max-h-28 grid-cols-8 gap-1 overflow-y-auto rounded border border-[#2e3040] bg-[#191a21] p-1.5">
              {results.map((n) => {
                const I = icons[n as keyof typeof icons];
                if (!I) return null;
                return (
                  <button
                    key={n}
                    title={n}
                    onClick={() => setIcon(n)}
                    className={`flex h-8 items-center justify-center rounded hover:bg-[#2b2d3a] ${
                      icon === n ? "bg-[#2b3a55] ring-1 ring-[#4c9aff]" : ""
                    }`}
                  >
                    <I size={16} color="#c9cbd8" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-[#2e3040] px-4 py-3">
          <button
            onClick={close}
            className="rounded border border-[#3a3d52] px-3 py-1.5 text-sm text-[#c9cbd8] hover:border-[#7a7d92]"
          >
            Cancel
          </button>
          <button
            onClick={create}
            className="rounded bg-[#2b6cb0] px-4 py-1.5 text-sm text-white hover:bg-[#3182ce]"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}
