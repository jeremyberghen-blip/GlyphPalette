import { useMemo, useState } from "react";
import { icons, Plus, Pencil, Trash2, Search, Library, Import, Copy, Shuffle } from "lucide-react";
import { LAYER_LABELS, NodeDefinition } from "../types";
import { LAYER_COLORS, layerLabel } from "../lib/layerStyle";
import { useApp } from "../store";
import { canvasOwner } from "../lib/layers";
import { isStandardDef } from "../lib/standardLibrary";
import { pickGlyphFile, readProjectContent } from "../lib/persist";
import { ProjectContent } from "../lib/projectFile";
import { toast } from "../lib/toast";
import DefinitionWizard from "./DefinitionWizard";
import ImportDialog from "./ImportDialog";

/** MIME type carrying a definition id when a palette card is dragged onto the canvas. */
export const DEF_DRAG_TYPE = "application/x-glyph-def";

// Blank drag image, so only the canvas's own ghost node follows the cursor
const BLANK_DRAG_IMAGE = new Image();
BLANK_DRAG_IMAGE.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

function DefCard({
  def,
  inUse,
  standard,
  onEdit,
  onPermute,
}: {
  def: NodeDefinition;
  inUse: boolean;
  /** Standard-library node: read-only, so no edit or delete. */
  standard: boolean;
  onEdit: () => void;
  onPermute: () => void;
}) {
  const placing = useApp((s) => s.placingDefId === def.id);
  const customIcons = useApp((s) => s.customIcons);
  const Lucide = !def.icon.startsWith("custom:")
    ? icons[def.icon as keyof typeof icons]
    : null;

  return (
    <div
      onClick={() => useApp.getState().setPlacing(placing ? null : def.id)}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(DEF_DRAG_TYPE, def.id);
        e.dataTransfer.effectAllowed = "copy";
        e.dataTransfer.setDragImage(BLANK_DRAG_IMAGE, 0, 0);
        useApp.getState().setPlacing(def.id); // drives the canvas ghost
      }}
      onDragEnd={() => {
        // Dropped off the canvas, or cancelled with Esc: nothing placed
        if (useApp.getState().placingDefId === def.id) useApp.getState().setPlacing(null);
      }}
      className={`group flex cursor-pointer items-center gap-2.5 rounded border px-2.5 py-2 select-none ${
        placing
          ? "border-[#4c9aff] bg-[#2b3a55]"
          : "border-[#2e3040] bg-[#22242e] hover:border-[#4a4e63]"
      }`}
      title={`${def.name}\nClick then click the canvas, or drag onto it, to place`}
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-[#191a21]">
        {Lucide ? (
          <Lucide size={18} color="#c9cbd8" />
        ) : (
          <img
            src={customIcons[def.icon.slice(7)]}
            className="h-5 w-5 object-contain"
            alt=""
          />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm text-[#e2e4ee]">{def.name}</span>
          {standard && (
            <Library size={11} className="shrink-0 text-[#565a72]" aria-label="Standard library" />
          )}
        </div>
        <div className="text-[10px] text-[#565a72]">
          {def.pips.length} pip{def.pips.length === 1 ? "" : "s"}
        </div>
      </div>
      <div className="hidden shrink-0 items-center gap-0.5 group-hover:flex">
        <button
          onClick={(e) => {
            e.stopPropagation();
            useApp.getState().duplicateDefinition(def.id);
          }}
          className="rounded p-1 text-[#7a7d92] hover:bg-[#2b2d3a] hover:text-white"
          title="Duplicate — a copy with the next numbered name"
        >
          <Copy size={13} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPermute();
          }}
          className="rounded p-1 text-[#7a7d92] hover:bg-[#2b2d3a] hover:text-white"
          title="Permute — a new node based on this one"
        >
          <Shuffle size={13} />
        </button>
        {!standard && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              className="rounded p-1 text-[#7a7d92] hover:bg-[#2b2d3a] hover:text-white"
              title="Edit definition"
            >
              <Pencil size={13} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                useApp.getState().removeDefinition(def.id);
              }}
              disabled={inUse}
              className="rounded p-1 text-[#7a7d92] hover:bg-[#2b2d3a] hover:text-[#f87171] disabled:cursor-not-allowed disabled:opacity-30"
              title={inUse ? "In use on a canvas — remove instances first" : "Delete definition"}
            >
              <Trash2 size={13} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-0.5 pt-1 text-[10px] font-semibold uppercase tracking-wider text-[#565a72]">
      {children}
    </div>
  );
}

export default function LibraryPanel() {
  const definitions = useApp((s) => s.definitions);
  const canvases = useApp((s) => s.canvases);
  const pipTypes = useApp((s) => s.pipTypes);
  const activeLayer = useApp((s) => s.canvases[s.activeCanvasId]?.layer ?? "container");
  const pocketName = useApp((s) => {
    const owner = canvasOwner(s.definitions, s.activeCanvasId);
    return owner?.expandable ? owner.name : null;
  });
  const [search, setSearch] = useState("");
  const [wizard, setWizard] = useState<{
    open: boolean;
    editing: NodeDefinition | null;
    base: NodeDefinition | null;
  }>({ open: false, editing: null, base: null });
  const [importing, setImporting] = useState<{ source: ProjectContent; name: string } | null>(null);

  const usedDefIds = useMemo(() => {
    const used = new Set<string>();
    for (const c of Object.values(canvases))
      for (const n of c.nodes) used.add(n.definitionId);
    return used;
  }, [canvases]);

  const defs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return Object.values(definitions)
      .filter((d) => d.layers?.includes(activeLayer))
      .filter((d) => !d.expandable) // collapsed groups are folds, not reusable parts
      .filter((d) => !q || d.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [definitions, search, activeLayer]);
  const projectDefs = defs.filter((d) => !isStandardDef(d.id));
  const standardDefs = defs.filter((d) => isStandardDef(d.id));

  const startImport = async () => {
    const picked = await pickGlyphFile("Import nodes from another project");
    if (!picked) return;
    try {
      setImporting({ source: readProjectContent(picked.text), name: picked.name });
    } catch (e) {
      toast(`Couldn't read ${picked.name}: ${(e as Error).message}`, "error");
    }
  };

  const card = (d: NodeDefinition) => (
    <DefCard
      key={d.id}
      def={d}
      inUse={usedDefIds.has(d.id)}
      standard={isStandardDef(d.id)}
      onEdit={() => setWizard({ open: true, editing: d, base: null })}
      onPermute={() => setWizard({ open: true, editing: null, base: d })}
    />
  );

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-[#2e3040] bg-[#1e1f28]">
      <div className="border-b border-[#2e3040] p-2.5">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span
            className="truncate text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: LAYER_COLORS[activeLayer] }}
            title={pocketName ? `Inside the collapsed group ${pocketName}` : undefined}
          >
            {layerLabel(activeLayer)} layer
            {pocketName && ` · ${pocketName} (collapsed)`}
          </span>
          <button
            onClick={() => void startImport()}
            className="shrink-0 rounded p-1 text-[#7a7d92] hover:bg-[#2b2d3a] hover:text-white"
            title="Import nodes from another project"
          >
            <Import size={13} />
          </button>
        </div>
        <button
          onClick={() => setWizard({ open: true, editing: null, base: null })}
          className="flex w-full items-center justify-center gap-1.5 rounded bg-[#2b6cb0] px-3 py-1.5 text-sm text-white hover:bg-[#3182ce]"
        >
          <Plus size={15} /> New Node
        </button>
        <div className="relative mt-2">
          <Search size={13} className="absolute left-2 top-2 text-[#565a72]" />
          <input
            className="w-full rounded border border-[#3a3d52] bg-[#191a21] py-1 pl-7 pr-2 text-sm text-[#e2e4ee] outline-none focus:border-[#4c9aff]"
            placeholder="Search library…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 space-y-1.5 overflow-y-auto p-2.5">
        {projectDefs.length > 0 && (
          <>
            <SectionHeader>This project</SectionHeader>
            {projectDefs.map(card)}
          </>
        )}
        {standardDefs.length > 0 && (
          <>
            <SectionHeader>Standard</SectionHeader>
            {standardDefs.map(card)}
          </>
        )}
        {defs.length === 0 && (
          <div className="p-3 text-center text-xs text-[#565a72]">
            No {LAYER_LABELS[activeLayer].toLowerCase()}-layer nodes
            {search ? " match." : " yet — add one above."}
          </div>
        )}
      </div>

      <div className="border-t border-[#2e3040] p-2.5">
        <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#565a72]">
          Pip Types
        </div>
        <div className="flex flex-wrap gap-1.5">
          {Object.values(pipTypes).map((t) => (
            <span
              key={t.id}
              className="flex items-center gap-1.5 rounded-full border border-[#2e3040] bg-[#22242e] px-2 py-0.5 text-[11px] text-[#c9cbd8]"
            >
              <span className="h-2 w-2 rounded-full" style={{ background: t.color }} />
              {t.name}
            </span>
          ))}
        </div>
      </div>

      {wizard.open && (
        <DefinitionWizard
          editing={wizard.editing}
          base={wizard.base}
          onClose={() => setWizard({ open: false, editing: null, base: null })}
        />
      )}
      {importing && (
        <ImportDialog
          source={importing.source}
          sourceName={importing.name}
          onClose={() => setImporting(null)}
          onImported={(summary) => toast(summary)}
        />
      )}
    </aside>
  );
}
