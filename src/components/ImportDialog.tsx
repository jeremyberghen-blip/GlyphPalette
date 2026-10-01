import { useMemo, useState } from "react";
import { icons, X } from "lucide-react";
import { DRAWABLE_LAYERS, LAYER_LABELS, NodeDefinition } from "../types";
import { livePips } from "../lib/definitions";
import { useApp } from "../store";
import { ProjectContent } from "../lib/projectFile";
import { importCandidates, planImport } from "../lib/importDefs";
import { isStandardDef } from "../lib/standardLibrary";

interface Props {
  source: ProjectContent;
  /** Source project's name, appended to colliding imports: "Links DB (Snip)". */
  sourceName: string;
  onClose: () => void;
  /** Called with a one-line summary after importing. */
  onImported: (summary: string) => void;
}

/** Pick which of another project's definitions to bring into this one. */
export default function ImportDialog({ source, sourceName, onClose, onImported }: Props) {
  const candidates = useMemo(() => importCandidates(source, isStandardDef), [source]);
  const [picked, setPicked] = useState<Set<string>>(() => new Set(candidates.map((d) => d.id)));

  // Grouped under the first drawable layer each definition belongs to
  const groups = useMemo(() => {
    const byLayer = new Map<string, NodeDefinition[]>();
    for (const d of candidates) {
      const layer = DRAWABLE_LAYERS.find((l) => d.layers.includes(l))!;
      byLayer.set(layer, [...(byLayer.get(layer) ?? []), d]);
    }
    return DRAWABLE_LAYERS.filter((l) => byLayer.has(l)).map((l) => ({ layer: l, defs: byLayer.get(l)! }));
  }, [candidates]);

  const toggle = (id: string) =>
    setPicked((p) => {
      const next = new Set(p);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const doImport = () => {
    const s = useApp.getState();
    const ids = candidates.filter((d) => picked.has(d.id)).map((d) => d.id);
    const plan = planImport(source, s, ids, sourceName);
    s.importDefinitions(plan);
    const renamed = plan.definitions.filter((d) => source.definitions[d.id]?.name !== d.name).length;
    onImported(
      `Imported ${plan.definitions.length} node${plan.definitions.length === 1 ? "" : "s"} from ${sourceName}` +
        (renamed ? ` (${renamed} renamed to avoid clashes)` : "")
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="flex max-h-[80vh] w-[420px] flex-col rounded-lg border border-[#3a3d52] bg-[#22242e] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#2e3040] px-4 py-3">
          <span className="text-sm font-semibold text-[#e2e4ee]">Import nodes from {sourceName}</span>
          <button onClick={onClose} className="text-[#7a7d92] hover:text-white">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
          {candidates.length === 0 && (
            <div className="text-sm text-[#8a8ea6]">
              {sourceName} has no nodes of its own to import — it only uses standard ones.
            </div>
          )}
          {groups.map(({ layer, defs }) => (
            <div key={layer}>
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[#565a72]">
                {LAYER_LABELS[layer]}
              </div>
              {defs.map((d) => {
                const Lucide = !d.icon.startsWith("custom:") ? icons[d.icon as keyof typeof icons] : null;
                return (
                  <label
                    key={d.id}
                    className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm text-[#e2e4ee] hover:bg-[#2b2d3a]"
                  >
                    <input type="checkbox" checked={picked.has(d.id)} onChange={() => toggle(d.id)} />
                    {Lucide ? <Lucide size={14} className="shrink-0 text-[#c9cbd8]" /> : <span className="w-3.5" />}
                    <span className="truncate">{d.name}</span>
                    <span className="ml-auto shrink-0 text-[10px] text-[#565a72]">
                      {livePips(d)} pip{livePips(d) === 1 ? "" : "s"}
                    </span>
                  </label>
                );
              })}
            </div>
          ))}
          {candidates.length > 0 && (
            <div className="text-xs text-[#565a72]">
              Nodes come across without their interiors. A node whose name is already used here
              gets "({sourceName})" added so both can coexist.
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 border-t border-[#2e3040] px-4 py-3">
          {candidates.length > 0 && (
            <button
              onClick={() =>
                setPicked(picked.size === candidates.length ? new Set() : new Set(candidates.map((d) => d.id)))
              }
              className="text-xs text-[#8a8ea6] hover:text-white"
            >
              {picked.size === candidates.length ? "Select none" : "Select all"}
            </button>
          )}
          <button onClick={onClose} className="ml-auto rounded px-3 py-1.5 text-sm text-[#c9cbd8] hover:bg-[#2b2d3a]">
            Cancel
          </button>
          <button
            onClick={doImport}
            disabled={picked.size === 0}
            className="rounded bg-[#2b6cb0] px-3 py-1.5 text-sm text-white hover:bg-[#3182ce] disabled:opacity-40"
          >
            Import {picked.size || ""}
          </button>
        </div>
      </div>
    </div>
  );
}
