import { useMemo, useRef, useState } from "react";
import { icons } from "lucide-react";
import { X, Plus, Trash2, Upload } from "lucide-react";
import {
  DRAWABLE_LAYERS,
  LAYERS,
  LAYER_LABELS,
  Layer,
  NodeDefinition,
  PipDef,
  PipDirection,
} from "../types";
import { useApp, uid, nameTaken } from "../store";
import { defaultConnType } from "../lib/connections";
import { LANGUAGES, LANGUAGE_IDS, LanguageId, slugify } from "../lib/naming";
import { BuildsAs, buildFacts, buildsAs } from "../lib/definitions";
import { defaultSide, groupPipsByDirection } from "../lib/pips";
import PipFields, { inputCls } from "./PipFields";
import { create } from "zustand";

interface WizardState {
  open: boolean;
  editing: NodeDefinition | null;
  base: NodeDefinition | null;
  /** Permute in place: the node (on the active canvas) that switches to the new definition. */
  replaceNodeId: string | null;
}

/** Which node dialog is open (LibraryPanel renders it); palette cards and canvas menus open it. */
export const useWizard = create<WizardState>(() => ({ open: false, editing: null, base: null, replaceNodeId: null }));
/**
 * Opens the node dialog: new, editing a definition, or a Permute of `base` —
 * which, given `replaceNodeId`, also puts the new definition on that node.
 */
export const openWizard = (
  opts: { editing?: NodeDefinition | null; base?: NodeDefinition | null; replaceNodeId?: string | null } = {}
) =>
  useWizard.setState({
    open: true,
    editing: opts.editing ?? null,
    base: opts.base ?? null,
    replaceNodeId: opts.replaceNodeId ?? null,
  });
export const closeWizard = () => useWizard.setState({ open: false, editing: null, base: null, replaceNodeId: null });

const BUILDS_AS: { value: BuildsAs; label: string; hint: string }[] = [
  { value: "folder", label: "Folder", hint: "A folder. If you don't draw its inside, the AI decides what goes in it." },
  { value: "file", label: "File", hint: "Always a single file." },
  {
    value: "external",
    label: "External — not built",
    hint: "Managed by someone else or outsourced: drawn for context, never built (neither a file nor a folder).",
  },
];

/** The dialog's pip sections, in order; adding to one starts a pip with its direction. */
const SECTIONS: { key: "inbound" | "outbound" | "other"; title: string; direction: PipDirection }[] = [
  { key: "inbound", title: "Inbound", direction: "inbound" },
  { key: "outbound", title: "Outbound", direction: "outbound" },
  { key: "other", title: "Both ways / other", direction: "bidirectional" },
];

interface Props {
  /** Definition being edited, or null when creating a new one. */
  editing: NodeDefinition | null;
  /**
   * Permute: pre-fill a *new* definition from this one — every field except
   * the name, which starts blank.
   */
  base?: NodeDefinition | null;
  /** With `base`: the node on the active canvas that switches to the new definition. */
  replaceNodeId?: string | null;
  onClose: () => void;
}

export default function DefinitionWizard({ editing, base = null, replaceNodeId = null, onClose }: Props) {
  const transports = useApp((s) => s.transports);
  const styles = useApp((s) => s.styles);
  const definitions = useApp((s) => s.definitions);
  const activeLayer = useApp((s) => s.canvases[s.activeCanvasId]?.layer ?? "container");

  const source = editing ?? base;
  const [name, setName] = useState(editing?.name ?? "");
  const [icon, setIcon] = useState(source?.icon ?? "Box");
  // A typed slug is kept only when editing (a Permute's slug follows its new name)
  const [slug, setSlug] = useState(editing?.slug ?? "");
  const [builds, setBuilds] = useState<BuildsAs>(source ? buildsAs(source) : "folder");
  const [language, setLanguage] = useState<LanguageId | "">(source?.language ?? "");
  const [layers, setLayers] = useState<Layer[]>(
    source?.layers?.length ? [...source.layers] : [activeLayer]
  );
  const [pips, setPips] = useState<PipDef[]>(
    () => source?.pips.filter((p) => !p.removed).map((p) => ({ ...p })) ?? []
  );
  // The pip just added from a section, so its label gets the focus
  const [justAdded, setJustAdded] = useState<string | null>(null);

  const toggleLayer = (l: Layer) =>
    setLayers((ls) =>
      ls.includes(l) ? ls.filter((x) => x !== l) : [...LAYERS].filter((x) => ls.includes(x) || x === l)
    );
  const [iconSearch, setIconSearch] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const customIcons = useApp((s) => s.customIcons);

  const trimmed = name.trim();
  const dupName = nameTaken(definitions, trimmed, editing?.id);
  const valid = trimmed.length > 0 && !dupName && layers.length > 0;
  const external = builds === "external";

  const iconResults = useMemo(() => {
    const q = iconSearch.trim().toLowerCase();
    const names = Object.keys(icons);
    const hits = q
      ? names.filter((n) => n.toLowerCase().includes(q))
      : ["Server", "Database", "Globe", "Shield", "Box", "Cloud", "Cpu", "HardDrive", "Network", "Router", "Lock", "Key", "Mail", "MessageSquare", "Folder", "FileText", "Users", "Terminal", "Container", "Layers", "Workflow", "Zap", "Radio", "Wifi", "Smartphone", "Monitor", "Printer", "Camera", "Timer", "Cog"];
    return hits.slice(0, 60);
  }, [iconSearch]);

  const groups = groupPipsByDirection(pips);

  const updatePip = (id: string, patch: Partial<PipDef>) =>
    setPips((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  const addPip = (direction: PipDirection) => {
    const id = `pip-${uid()}`;
    setPips((ps) => [
      ...ps,
      { id, label: "", ...defaultConnType(transports, styles, layers), direction, side: defaultSide(direction) },
    ]);
    setJustAdded(id);
  };

  const save = () => {
    const def: NodeDefinition = {
      id: editing?.id ?? `def-${uid()}`,
      name: trimmed,
      icon,
      layers,
      pips: pips.filter((p) => p.label.trim() && p.transportId && p.styleId),
      canvasId: editing?.canvasId ?? null,
      // Facts for building: stored only when they differ from the defaults
      ...(slug.trim() ? { slug: slugify(slug) } : {}),
      ...buildFacts(builds, language),
      ...(editing?.expandable ? { expandable: editing.expandable, pipMap: editing.pipMap, sourceSize: editing.sourceSize } : {}),
    };
    if (replaceNodeId) useApp.getState().permuteNodeInto(replaceNodeId, def);
    else useApp.getState().saveDefinition(def);
    onClose();
  };

  const handleUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const id = useApp.getState().addCustomIcon(reader.result as string);
      setIcon(`custom:${id}`);
    };
    reader.readAsDataURL(file);
  };

  const SelectedLucide =
    !icon.startsWith("custom:") && icons[icon as keyof typeof icons];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="flex max-h-[85vh] w-[740px] flex-col rounded-lg border border-[#3a3d52] bg-[#22242e] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#2e3040] px-4 py-3">
          <span className="text-sm font-semibold text-[#e2e4ee]">
            {editing
              ? `Edit "${editing.name}"`
              : base
                ? `Permute "${base.name}"`
                : "New Node Definition"}
          </span>
          <button onClick={onClose} className="text-[#7a7d92] hover:text-white">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-3">
          {replaceNodeId && base && (
            <div className="rounded border border-[#2b3a55] bg-[#1f2a3d] px-3 py-2 text-xs text-[#c9cbd8]">
              The node you right-clicked will use this new definition instead of the standard {base.name}; its
              wires stay connected. Other {base.name} nodes stay as they are.
            </div>
          )}

          {/* Name */}
          <div>
            <label className="mb-1 block text-xs text-[#7a7d92]">Name (unique)</label>
            <input
              className={inputCls + " w-full"}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Auth Server"
              autoFocus={!editing}
            />
            {dupName && (
              <div className="mt-1 text-xs text-[#f87171]">
                A definition named "{trimmed}" already exists.
              </div>
            )}
          </div>

          {/* Slug: the file-safe name, derived from the name unless typed */}
          <div>
            <label className="mb-1 block text-xs text-[#7a7d92]">
              Slug — its file/folder name, before each language's naming style is applied
            </label>
            <input
              className={inputCls + " w-full font-mono"}
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder={slugify(trimmed || "node")}
            />
            {slug.trim() && slugify(slug) !== slug.trim() && (
              <div className="mt-1 text-xs text-[#7a7d92]">
                Saved as <span className="font-mono text-[#c9cbd8]">{slugify(slug)}</span>
              </div>
            )}
          </div>

          {/* Building: what it builds as (or External: not built), and its language */}
          <div>
            <label className="mb-1 block text-xs text-[#7a7d92]">Builds as</label>
            <div className="flex flex-wrap items-center gap-3">
              <select
                className={inputCls}
                value={builds}
                onChange={(e) => setBuilds(e.target.value as BuildsAs)}
                title={BUILDS_AS.find((b) => b.value === builds)?.hint}
              >
                {BUILDS_AS.map((b) => (
                  <option key={b.value} value={b.value} title={b.hint}>
                    {b.label}
                  </option>
                ))}
              </select>
              <select
                className={inputCls + " disabled:cursor-not-allowed disabled:opacity-40"}
                value={language}
                disabled={external}
                onChange={(e) => setLanguage(e.target.value as LanguageId | "")}
                title={
                  external
                    ? "External nodes aren't built, so they have no language"
                    : "Language — Inherit uses the language of whatever it's placed inside"
                }
              >
                <option value="">Language: inherit</option>
                {LANGUAGE_IDS.map((id) => (
                  <option key={id} value={id}>
                    {LANGUAGES[id].name}
                  </option>
                ))}
              </select>
              <span className="text-xs text-[#7a7d92]">{BUILDS_AS.find((b) => b.value === builds)?.hint}</span>
            </div>
          </div>

          {/* Layers */}
          <div>
            <label className="mb-1 block text-xs text-[#7a7d92]">
              Layers — where this node can be placed
            </label>
            <div className="flex gap-1.5">
              {/* The retired Code layer is only offered to remove it from old definitions */}
              {LAYERS.filter((l) => DRAWABLE_LAYERS.includes(l) || source?.layers.includes(l)).map((l) => (
                <button
                  key={l}
                  onClick={() => toggleLayer(l)}
                  className={`flex-1 rounded border px-2 py-1.5 text-xs ${
                    layers.includes(l)
                      ? "border-[#4c9aff] bg-[#2b3a55] text-white"
                      : "border-[#3a3d52] bg-[#191a21] text-[#8a8ea6] hover:border-[#4a4e63]"
                  }`}
                >
                  {LAYER_LABELS[l]}
                </button>
              ))}
            </div>
            {layers.length === 0 && (
              <div className="mt-1 text-xs text-[#f87171]">Pick at least one layer.</div>
            )}
          </div>

          {/* Icon */}
          <div>
            <label className="mb-1 block text-xs text-[#7a7d92]">Icon</label>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded border border-[#3a3d52] bg-[#191a21]">
                {icon.startsWith("custom:") ? (
                  <img
                    src={customIcons[icon.slice(7)]}
                    className="h-9 w-9 object-contain"
                    alt="custom icon"
                  />
                ) : (
                  SelectedLucide && <SelectedLucide size={30} color="#e2e4ee" />
                )}
              </div>
              <input
                className={inputCls + " flex-1"}
                placeholder="Search 1,700+ icons…"
                value={iconSearch}
                onChange={(e) => setIconSearch(e.target.value)}
              />
              <button
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-1.5 rounded border border-[#3a3d52] bg-[#262835] px-2.5 py-1.5 text-xs hover:border-[#4c9aff]"
                title="Save a PNG/SVG image into the icon library"
              >
                <Upload size={13} /> Upload
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUpload(f);
                  e.target.value = "";
                }}
              />
            </div>
            <div className="mt-2 grid max-h-36 grid-cols-10 gap-1 overflow-y-auto rounded border border-[#2e3040] bg-[#191a21] p-2">
              {iconResults.map((n) => {
                const I = icons[n as keyof typeof icons];
                if (!I) return null;
                return (
                  <button
                    key={n}
                    title={n}
                    onClick={() => setIcon(n)}
                    className={`flex h-9 items-center justify-center rounded hover:bg-[#2b2d3a] ${
                      icon === n ? "bg-[#2b3a55] ring-1 ring-[#4c9aff]" : ""
                    }`}
                  >
                    <I size={18} color="#c9cbd8" />
                  </button>
                );
              })}
              {Object.entries(customIcons).map(([id, url]) => (
                <button
                  key={id}
                  title="Custom icon"
                  onClick={() => setIcon(`custom:${id}`)}
                  className={`flex h-9 items-center justify-center rounded hover:bg-[#2b2d3a] ${
                    icon === `custom:${id}` ? "bg-[#2b3a55] ring-1 ring-[#4c9aff]" : ""
                  }`}
                >
                  <img src={url} className="h-6 w-6 object-contain" alt="" />
                </button>
              ))}
            </div>
          </div>

          {/* Pips, grouped by direction; changing a pip's direction moves it */}
          <div>
            <label className="mb-1 block text-xs text-[#7a7d92]">Pips</label>
            {pips.length === 0 && (
              <div className="mb-2 rounded border border-dashed border-[#3a3d52] p-2 text-center text-xs text-[#565a72]">
                No pips — this node won't accept connections.
              </div>
            )}
            <div className="space-y-3">
              {SECTIONS.map((sec) => (
                <div key={sec.key} className="rounded border border-[#2e3040] bg-[#1e1f28] p-2">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8a8ea6]">
                      {sec.title}
                      <span className="ml-1.5 font-normal text-[#565a72]">{groups[sec.key].length}</span>
                    </span>
                    <button
                      onClick={() => addPip(sec.direction)}
                      className="flex items-center gap-1 rounded border border-[#3a3d52] bg-[#262835] px-2 py-0.5 text-xs hover:border-[#4c9aff]"
                      title={sec.key === "other" ? "Add a bidirectional pip" : `Add an ${sec.direction} pip`}
                    >
                      <Plus size={12} /> Add
                    </button>
                  </div>
                  <div className="space-y-2">
                    {groups[sec.key].length === 0 && <div className="text-xs text-[#565a72]">None</div>}
                    {groups[sec.key].map((p) => (
                      <PipFields
                        key={p.id}
                        pip={p}
                        layers={layers}
                        autoFocusLabel={p.id === justAdded}
                        onChange={(patch) => updatePip(p.id, patch)}
                        trailing={
                          <button
                            onClick={() => setPips((ps) => ps.filter((x) => x.id !== p.id))}
                            className="ml-auto text-[#7a7d92] hover:text-[#f87171]"
                            title="Delete pip"
                          >
                            <Trash2 size={14} />
                          </button>
                        }
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-[#2e3040] px-4 py-3">
          <button
            onClick={onClose}
            className="rounded border border-[#3a3d52] px-3 py-1.5 text-sm text-[#c9cbd8] hover:border-[#7a7d92]"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={!valid}
            className="rounded bg-[#2b6cb0] px-4 py-1.5 text-sm text-white hover:bg-[#3182ce] disabled:opacity-40"
          >
            {editing ? "Save Changes" : replaceNodeId ? "Permute and replace" : "Add to Library"}
          </button>
        </div>
      </div>
    </div>
  );
}
