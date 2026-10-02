// One pip's fields — label, transport, style, direction, side — shared by
// the node dialog (one row per pip) and the canvas's Add pip… window (a
// small form). Custom transports and styles can be created inline in both.

import { useState } from "react";
import { DRAWABLE_LAYERS, LAYER_LABELS, Layer, PipDef, PipDirection } from "../types";
import { useApp } from "../store";
import { groupStyles, groupTransports, isAnyStyle, styleAfterTransportChange } from "../lib/connections";

export const DIRECTIONS: { value: PipDirection; label: string }[] = [
  { value: "inbound", label: "Inbound" },
  { value: "outbound", label: "Outbound" },
  { value: "bidirectional", label: "Bidirectional" },
  { value: "none", label: "Non-directional" },
];

const SIDES: PipDef["side"][] = ["left", "right", "top", "bottom"];

export const inputCls =
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
export function ConnSwatch({ transport, style }: { transport?: string; style?: string }) {
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
  pip: PipDef;
  /** The definition's layers: transports usual on them are listed first. */
  layers: Layer[];
  onChange: (patch: Partial<PipDef>) => void;
  /** One line (the node dialog) or a labeled form (Add pip…). */
  layout?: "row" | "form";
  /** Row only: shown at the end of the line (the dialog's delete button). */
  trailing?: React.ReactNode;
  autoFocusLabel?: boolean;
  /** Enter pressed in the label field (Add pip…: confirms the window). */
  onLabelEnter?: () => void;
}

export default function PipFields({ pip, layers, onChange, layout = "row", trailing, autoFocusLabel, onLabelEnter }: Props) {
  const transports = useApp((s) => s.transports);
  const styles = useApp((s) => s.styles);
  const activeLayer = useApp((s) => s.canvases[s.activeCanvasId]?.layer ?? "container");
  const [creating, setCreating] = useState<"transport" | "style" | null>(null);
  const transportGroups = groupTransports(transports, layers);
  const styleGroups = groupStyles(styles, pip.transportId);
  const form = layout === "form";

  const label = (
    <input
      className={inputCls + (form ? " w-full" : " w-28")}
      placeholder="Label"
      value={pip.label}
      autoFocus={autoFocusLabel}
      onChange={(e) => onChange({ label: e.target.value })}
      onKeyDown={(e) => e.key === "Enter" && onLabelEnter?.()}
    />
  );
  const transport = (
    <select
      className={inputCls + (form ? " w-full" : " w-32")}
      title="Transport — how it travels"
      value={pip.transportId}
      onChange={(e) => {
        const transportId = e.target.value;
        if (transportId === "__new") return setCreating("transport");
        onChange({ transportId, styleId: styleAfterTransportChange(pip.styleId, transportId, transports, styles) });
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
  );
  const style = (
    <select
      className={inputCls + (form ? " w-full" : " w-32")}
      title="API style — what it means ('any' = passes anything through)"
      value={pip.styleId}
      onChange={(e) => {
        if (e.target.value === "__new") return setCreating("style");
        onChange({ styleId: e.target.value });
      }}
    >
      <optgroup label={`Usual with ${transports[pip.transportId]?.name ?? "this transport"}`}>
        {styleGroups.usual.map((st) => (
          <option key={st.id} value={st.id}>
            {st.name}
          </option>
        ))}
      </optgroup>
      {styleGroups.other.length > 0 && (
        <optgroup label="Other styles">
          {styleGroups.other.map((st) => (
            <option key={st.id} value={st.id}>
              {st.name}
            </option>
          ))}
        </optgroup>
      )}
      <option value="__new">+ New style…</option>
    </select>
  );
  const swatch = (
    <ConnSwatch
      transport={transports[pip.transportId]?.color}
      style={isAnyStyle(pip.styleId) ? undefined : styles[pip.styleId]?.color}
    />
  );
  const direction = (
    <select
      className={inputCls + (form ? " w-full" : "")}
      value={pip.direction}
      onChange={(e) => onChange({ direction: e.target.value as PipDirection })}
    >
      {DIRECTIONS.map((d) => (
        <option key={d.value} value={d.value}>
          {d.label}
        </option>
      ))}
    </select>
  );
  const side = (
    <select
      className={inputCls + (form ? " w-full" : "")}
      title="Which side of the node it sits on"
      value={pip.side}
      onChange={(e) => onChange({ side: e.target.value as PipDef["side"] })}
    >
      {SIDES.map((sd) => (
        <option key={sd} value={sd}>
          {sd}
        </option>
      ))}
    </select>
  );
  const creator =
    creating === "transport" ? (
      <NewConnPartForm
        kind="transport"
        hintOptions={DRAWABLE_LAYERS.map((l) => ({ id: l, label: LAYER_LABELS[l] }))}
        initialHints={DRAWABLE_LAYERS.includes(activeLayer) ? [activeLayer] : []}
        onCreate={(n, c, hints) => {
          const transportId = useApp.getState().addTransport(n, c, hints as Layer[]);
          onChange({ transportId, styleId: "s-any" });
          setCreating(null);
        }}
      />
    ) : creating === "style" ? (
      <NewConnPartForm
        kind="style"
        hintOptions={Object.values(transports).map((t) => ({ id: t.id, label: t.name }))}
        initialHints={[pip.transportId]}
        onCreate={(n, c, hints) => {
          const styleId = useApp.getState().addStyle(n, c, hints);
          onChange({ styleId });
          setCreating(null);
        }}
      />
    ) : null;

  if (form) {
    const row = (name: string, field: React.ReactNode) => (
      <div className="flex items-center gap-2">
        <span className="w-20 shrink-0 text-xs text-[#7a7d92]">{name}</span>
        <div className="flex min-w-0 flex-1 items-center gap-2">{field}</div>
      </div>
    );
    return (
      <div className="space-y-2">
        {row("Label", label)}
        {row("Transport", transport)}
        {row(
          "Style",
          <>
            {style}
            {swatch}
          </>
        )}
        {creator}
        {row("Direction", direction)}
        {row("Side", side)}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-1.5">
        {label}
        {transport}
        {style}
        {swatch}
        {direction}
        {side}
        {trailing}
      </div>
      {creator}
    </div>
  );
}
