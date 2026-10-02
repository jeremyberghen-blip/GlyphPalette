// The palette's Legend: an icon at its foot that shows, while the mouse is
// over it, what the colors and marks on pips, wires, and nodes mean. Purely
// for reference — nothing in it is clickable.

import { useState } from "react";
import { Info } from "lucide-react";
import { useApp } from "../store";
import { isAnyStyle } from "../lib/connections";
import { BROKEN_COLOR } from "../lib/broken";
import { NODE_COLORS } from "./NodeShape";

const POPUP_WIDTH = 320;

/** A connection legend: transports (drawn as the line / pip ring) or styles (the core). */
function ChipList({
  title,
  items,
  core = false,
}: {
  title: string;
  items: { id: string; name: string; color: string }[];
  core?: boolean;
}) {
  return (
    <div>
      <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#7a7d92]">{title}</div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((t) => (
          <span
            key={t.id}
            className="flex items-center gap-1.5 rounded-full border border-[#2e3040] bg-[#191a21] px-2 py-0.5 text-[11px] text-[#c9cbd8]"
          >
            {core ? (
              <span className="flex h-2.5 w-2.5 items-center justify-center rounded-full bg-[#3a3d52]">
                <span className="h-1.5 w-1.5 rounded-full ring-1 ring-black" style={{ background: t.color }} />
              </span>
            ) : (
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: t.color }} />
            )}
            {t.name}
          </span>
        ))}
      </div>
    </div>
  );
}

/** A pip on a node's right edge, with its direction mark (as PipShape draws it). */
function PipMark({ mark }: { mark: "out" | "in" | "both" | "none" }) {
  return (
    <svg width="30" height="20" viewBox="0 0 30 20" className="shrink-0">
      <rect x="0" y="2" width="9" height="16" rx="2" fill="#22242e" stroke="#4a4e63" />
      <circle cx="11" cy="10" r="6.5" fill="#8a8ea6" stroke="#191a21" strokeWidth="1.2" />
      {mark === "out" && <polygon points="13.5,10 9.5,7.4 9.5,12.6" fill="#191a21" />}
      {mark === "in" && <polygon points="8.5,10 12.5,7.4 12.5,12.6" fill="#191a21" />}
      {mark === "both" && <polygon points="11,7.5 13.5,10 11,12.5 8.5,10" fill="#191a21" />}
    </svg>
  );
}

/** A short wire sample. */
function WireMark({ color, core, dashed }: { color: string; core?: string; dashed?: boolean }) {
  return (
    <svg width="30" height="20" viewBox="0 0 30 20" className="shrink-0">
      <line x1="1" y1="10" x2="29" y2="10" stroke={color} strokeWidth="6" strokeDasharray={dashed ? "7 4" : undefined} />
      {core && (
        <>
          <line x1="1" y1="10" x2="29" y2="10" stroke="#000" strokeWidth="3.2" />
          <line x1="1" y1="10" x2="29" y2="10" stroke={core} strokeWidth="2" />
        </>
      )}
    </svg>
  );
}

function NodeMark({ fill, stroke }: { fill: string; stroke: string }) {
  return (
    <svg width="30" height="20" viewBox="0 0 30 20" className="shrink-0">
      <rect x="3" y="2" width="24" height="16" rx="3" fill={fill} stroke={stroke} strokeWidth="1.5" />
    </svg>
  );
}

function MarkRow({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-[11px] text-[#c9cbd8]">
      {icon}
      <span>{children}</span>
    </div>
  );
}

function LegendPopup({ left, bottom }: { left: number; bottom: number }) {
  const transports = useApp((s) => s.transports);
  const styles = useApp((s) => s.styles);
  const http = transports["tr-http"]?.color ?? "#4c9aff";
  const rest = styles["s-rest"]?.color;
  return (
    <div
      className="pointer-events-none fixed z-[60] space-y-3 rounded-lg border border-[#3a3d52] bg-[#22242e] p-3 shadow-2xl"
      style={{ left, bottom, width: POPUP_WIDTH }}
    >
      <ChipList title="Transports — the line, and a pip's ring" items={Object.values(transports)} />
      <ChipList
        title="Styles — the core (none: passes anything)"
        items={Object.values(styles).filter((st) => !isAnyStyle(st.id))}
        core
      />
      <div className="space-y-1">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-[#7a7d92]">Pip marks</div>
        <MarkRow icon={<PipMark mark="out" />}>Outbound — points out: this node starts the conversation</MarkRow>
        <MarkRow icon={<PipMark mark="in" />}>Inbound — points in: this node is called</MarkRow>
        <MarkRow icon={<PipMark mark="both" />}>Bidirectional — either side can start</MarkRow>
        <MarkRow icon={<PipMark mark="none" />}>Non-directional — no mark</MarkRow>
      </div>
      <div className="space-y-1">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-[#7a7d92]">Wires</div>
        <MarkRow icon={<WireMark color={http} core={rest} />}>A wire: its transport's line, its style's core</MarkRow>
        <MarkRow icon={<WireMark color={BROKEN_COLOR} />}>Broken — a pip at one end was deleted or changed</MarkRow>
        <MarkRow icon={<WireMark color="#8a8ea6" dashed />}>Dashed — drawn by a collapsed group, locked</MarkRow>
      </div>
      <div className="space-y-1">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-[#7a7d92]">Nodes</div>
        <MarkRow icon={<NodeMark fill={NODE_COLORS.internal.fill} stroke={NODE_COLORS.internal.stroke} />}>
          Slate — built by you (or the AI)
        </MarkRow>
        <MarkRow icon={<NodeMark fill={NODE_COLORS.external.fill} stroke={NODE_COLORS.external.stroke} />}>
          Stone — External, never built
        </MarkRow>
      </div>
    </div>
  );
}

/** The foot of the palette: hover the Legend icon to see the legend beside the palette. */
export default function LegendButton() {
  const [at, setAt] = useState<{ left: number; bottom: number } | null>(null);
  return (
    <div className="border-t border-[#2e3040] px-2.5 py-1.5">
      <span
        className="inline-flex cursor-default items-center gap-1.5 rounded px-1.5 py-1 text-xs text-[#8a8ea6] hover:bg-[#262835] hover:text-[#e2e4ee]"
        onMouseEnter={(e) => {
          const trigger = e.currentTarget.getBoundingClientRect();
          const palette = e.currentTarget.closest("aside")?.getBoundingClientRect() ?? trigger;
          setAt({ left: palette.right + 8, bottom: Math.max(8, window.innerHeight - trigger.bottom) });
        }}
        onMouseLeave={() => setAt(null)}
      >
        <Info size={14} /> Legend
      </span>
      {at && <LegendPopup {...at} />}
    </div>
  );
}
