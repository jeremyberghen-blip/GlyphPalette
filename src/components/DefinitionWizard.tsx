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
import { defaultConnType, groupStyles, groupTransports, isAnyStyle, styleUsualWith } from "../lib/connections";

const DIRECTIONS: { value: PipDirection; label: string }[] = [
  { value: "inbound", label: "Inbound" },
  { value: "outbound", label: "Outbound" },
  { value: "bidirectional", label: "Bidirectional" },
  { value: "none", label: "Non-directional" },
];

const SIDES: PipDef["side"][] = ["left", "right", "top", "bottom"];

const inputCls =
  "rounded border border-[#3a3d52] bg-[#191a21] px-2 py-1 text-sm text-[#e2e4ee] outline-none focus:border-[#4c9aff]";

/**
 * Inline creator for a custom transport or style: a name, a color, and which
 * layers (transport) or transports (style) it's usual with.
 */
function NewConnPartForm({
  kind,
  hintOptions,
  initialHints,
  onCreate,
}: {
  kind: "transport" | "style";
  hintOptions: { id: string; label: string }[];
  initialHints: string[];
  onCreate: (name: string, color: string, hints: string[]) => void;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(kind === "transport" ? "#4c9aff" : "#e2e4ee");
  const [hints, setHints] = useState<string[]>(initialHints);
  const toggle = (id: string) =>
    setHints((hs) => (hs.includes(id) ? hs.filter((x) => x !== id) : [...hs, id]));
  return (
    <div className="mt-1 flex flex-wrap items-center gap-2 rounded border border-[#3a3d52] bg-[#1e1f28] p-2">
      <input
        className={inputCls + " w-36"}
        placeholder={kind === "transport" ? "Transport name" : "Style name"}
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoFocus
      />
      <input
        type="color"
        value={color}
        onChange={(e) => setColor(e.target.value)}
        className="h-7 w-9 cursor-pointer rounded border border-[#3a3d52] bg-transparent"
      />
      <button
        className="rounded bg-[#2b3a55] px-2 py-1 text-xs text-white hover:bg-[#33486b] disabled:opacity-40"
        disabled={!name.trim()}
        onClick={() => onCreate(name.trim(), color, hints)}
      >
        Add {kind}
      </button>
      <div className="flex w-full flex-wrap items-center gap-1 text-[10px] text-[#7a7d92]">
        {kind === "transport" ? "Usual on" : "Usual with"}
        {hintOptions.map((o) => (
          <button
            key={o.id}
            onClick={() => toggle(o.id)}
            className={`rounded border px-1.5 py-0.5 ${
              hints.includes(o.id)
                ? "border-[#4c9aff] bg-[#2b3a55] text-white"
                : "border-[#3a3d52] text-[#8a8ea6]"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** A small two-part swatch: transport ring, style center ("any": no center). */
function ConnSwatch({ transport, style }: { transport?: string; style?: string }) {
  return (
    <span
      className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full"
      style={{ background: transport ?? "#555" }}
    >
      {style && <span className="h-1.5 w-1.5 rounded-full ring-1 ring-black" style={{ background: style }} />}
    </span>
  );
}

interface Props {
  /** Definition being edited, or null when creating a new one. */
  editing: NodeDefinition | null;
  /**
   * Permute: pre-fill a *new* definition from this one — every field except
   * the name, which starts blank.
   */
  base?: NodeDefinition | null;
  onClose: () => void;
}

export default function DefinitionWizard({ editing, base = null, onClose }: Props) {
  const transports = useApp((s) => s.transports);
  const styles = useApp((s) => s.styles);
  const definitions = useApp((s) => s.definitions);
  const activeLayer = useApp((s) => s.canvases[s.activeCanvasId]?.layer ?? "container");

  const source = editing ?? base;
  const [name, setName] = useState(editing?.name ?? "");
  const [icon, setIcon] = useState(source?.icon ?? "Box");
  const [layers, setLayers] = useState<Layer[]>(
    source?.layers?.length ? [...source.layers] : [activeLayer]
  );
  const [pips, setPips] = useState<PipDef[]>(
    () => source?.pips.filter((p) => !p.removed).map((p) => ({ ...p })) ?? []
  );

  const toggleLayer = (l: Layer) =>
    setLayers((ls) =>
      ls.includes(l) ? ls.filter((x) => x !== l) : [...LAYERS].filter((x) => ls.includes(x) || x === l)
    );
  const [iconSearch, setIconSearch] = useState("");
  const [creating, setCreating] = useState<{ pipId: string; kind: "transport" | "style" } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const customIcons = useApp((s) => s.customIcons);

  const trimmed = name.trim();
  const dupName = nameTaken(definitions, trimmed, editing?.id);
  const valid = trimmed.length > 0 && !dupName && layers.length > 0;

  const iconResults = useMemo(() => {
    const q = iconSearch.trim().toLowerCase();
    const names = Object.keys(icons);
    const hits = q
      ? names.filter((n) => n.toLowerCase().includes(q))
      : ["Server", "Database", "Globe", "Shield", "Box", "Cloud", "Cpu", "HardDrive", "Network", "Router", "Lock", "Key", "Mail", "MessageSquare", "Folder", "FileText", "Users", "Terminal", "Container", "Layers", "Workflow", "Zap", "Radio", "Wifi", "Smartphone", "Monitor", "Printer", "Camera", "Timer", "Cog"];
    return hits.slice(0, 60);
  }, [iconSearch]);

  const transportGroups = useMemo(() => groupTransports(transports, layers), [transports, layers]);

  const updatePip = (id: string, patch: Partial<PipDef>) =>
    setPips((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  const save = () => {
    const def: NodeDefinition = {
      id: editing?.id ?? `def-${uid()}`,
      name: trimmed,
      icon,
      layers,
      pips: pips.filter((p) => p.label.trim() && p.transportId && p.styleId),
      canvasId: editing?.canvasId ?? null,
      ...(editing?.expandable ? { expandable: editing.expandable, pipMap: editing.pipMap, sourceSize: editing.sourceSize } : {}),
    };
    useApp.getState().saveDefinition(def);
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
      <div className="flex max-h-[85vh] w-[680px] flex-col rounded-lg border border-[#3a3d52] bg-[#22242e] shadow-2xl">
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

          {/* Pips */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs text-[#7a7d92]">Pips</label>
              <button
                onClick={() =>
                  setPips((ps) => [
                    ...ps,
                    {
                      id: `pip-${uid()}`,
                      label: "",
                      ...defaultConnType(transports, styles, layers),
                      direction: "inbound",
                      side: "left",
                    },
                  ])
                }
                className="flex items-center gap-1 rounded border border-[#3a3d52] bg-[#262835] px-2 py-1 text-xs hover:border-[#4c9aff]"
              >
                <Plus size={12} /> Add pip
              </button>
            </div>
            <div className="space-y-2">
              {pips.length === 0 && (
                <div className="rounded border border-dashed border-[#3a3d52] p-3 text-center text-xs text-[#565a72]">
                  No pips — this node won't accept connections.
                </div>
              )}
              {pips.map((p) => (
                <div key={p.id}>
                  <div className="flex items-center gap-1.5">
                    <input
                      className={inputCls + " w-28"}
                      placeholder="Label"
                      value={p.label}
                      onChange={(e) => updatePip(p.id, { label: e.target.value })}
                    />
                    <select
                      className={inputCls + " w-32"}
                      title="Transport — how it travels"
                      value={p.transportId}
                      onChange={(e) => {
                        const transportId = e.target.value;
                        if (transportId === "__new") return setCreating({ pipId: p.id, kind: "transport" });
                        // Keep the style if it still fits; otherwise the new transport's default
                        const keep = styles[p.styleId] && styleUsualWith(styles[p.styleId], transportId);
                        const fallback = transports[transportId]?.defaultStyle;
                        updatePip(p.id, {
                          transportId,
                          styleId: keep ? p.styleId : fallback && styles[fallback] ? fallback : "s-any",
                        });
                      }}
                    >
                      <optgroup label={`Usual on ${layers.map((l) => LAYER_LABELS[l]).join(" / ")}`}>
                        {transportGroups.usual.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </optgroup>
                      {transportGroups.other.length > 0 && (
                        <optgroup label="Other transports">
                          {transportGroups.other.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      <option value="__new">+ New transport…</option>
                    </select>
                    <select
                      className={inputCls + " w-32"}
                      title="API style — what it means ('any' = passes anything through)"
                      value={p.styleId}
                      onChange={(e) => {
                        if (e.target.value === "__new") return setCreating({ pipId: p.id, kind: "style" });
                        updatePip(p.id, { styleId: e.target.value });
                      }}
                    >
                      {(() => {
                        const g = groupStyles(styles, p.transportId);
                        return (
                          <>
                            <optgroup label={`Usual with ${transports[p.transportId]?.name ?? "this transport"}`}>
                              {g.usual.map((st) => (
                                <option key={st.id} value={st.id}>
                                  {st.name}
                                </option>
                              ))}
                            </optgroup>
                            {g.other.length > 0 && (
                              <optgroup label="Other styles">
                                {g.other.map((st) => (
                                  <option key={st.id} value={st.id}>
                                    {st.name}
                                  </option>
                                ))}
                              </optgroup>
                            )}
                          </>
                        );
                      })()}
                      <option value="__new">+ New style…</option>
                    </select>
                    <ConnSwatch
                      transport={transports[p.transportId]?.color}
                      style={isAnyStyle(p.styleId) ? undefined : styles[p.styleId]?.color}
                    />
                    <select
                      className={inputCls}
                      value={p.direction}
                      onChange={(e) =>
                        updatePip(p.id, { direction: e.target.value as PipDirection })
                      }
                    >
                      {DIRECTIONS.map((d) => (
                        <option key={d.value} value={d.value}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                    <select
                      className={inputCls}
                      value={p.side}
                      onChange={(e) =>
                        updatePip(p.id, { side: e.target.value as PipDef["side"] })
                      }
                    >
                      {SIDES.map((sd) => (
                        <option key={sd} value={sd}>
                          {sd}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => setPips((ps) => ps.filter((x) => x.id !== p.id))}
                      className="ml-auto text-[#7a7d92] hover:text-[#f87171]"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  {creating?.pipId === p.id && creating.kind === "transport" && (
                    <NewConnPartForm
                      kind="transport"
                      hintOptions={DRAWABLE_LAYERS.map((l) => ({ id: l, label: LAYER_LABELS[l] }))}
                      initialHints={DRAWABLE_LAYERS.includes(activeLayer) ? [activeLayer] : []}
                      onCreate={(n, c, hints) => {
                        const transportId = useApp.getState().addTransport(n, c, hints as Layer[]);
                        updatePip(p.id, { transportId, styleId: "s-any" });
                        setCreating(null);
                      }}
                    />
                  )}
                  {creating?.pipId === p.id && creating.kind === "style" && (
                    <NewConnPartForm
                      kind="style"
                      hintOptions={Object.values(transports).map((t) => ({ id: t.id, label: t.name }))}
                      initialHints={[p.transportId]}
                      onCreate={(n, c, hints) => {
                        const styleId = useApp.getState().addStyle(n, c, hints);
                        updatePip(p.id, { styleId });
                        setCreating(null);
                      }}
                    />
                  )}
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
            {editing ? "Save Changes" : "Add to Library"}
          </button>
        </div>
      </div>
    </div>
  );
}
