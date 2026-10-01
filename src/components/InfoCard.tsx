// The large hover card: a definition's facts on a palette card, and on a
// placed node the same facts plus where that placement builds. Floats over
// the canvas after a short pause; never takes the pointer.

import { RefObject, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { create } from "zustand";
import { AlertTriangle, LogIn, LogOut, icons } from "lucide-react";
import { useApp } from "../store";
import { LAYER_LABELS, NODE_WIDTH, NodeDefinition, PipDef } from "../types";
import { PORT_IN, isPortDefId, resolveDef } from "../lib/ports";
import { LANGUAGES, slugOf } from "../lib/naming";
import {
  BuildStatus,
  Placement,
  STATUS_TEXT,
  buildPlan,
  clashesWith,
  definitionStatus,
  hasDrawnContents,
  placementForTrail,
  placementsOf,
  reusedInterior,
} from "../lib/paths";
import { connLabel, isAnyStyle } from "../lib/connections";
import { isStandardDef } from "../lib/standardLibrary";
import { LAYER_COLORS } from "../lib/layerStyle";

/** Pause before a card appears, so sweeping the mouse across doesn't flicker cards. */
export const HOVER_DELAY_MS = 400;
const CARD_WIDTH = 296;
const GAP = 10;
const MAX_PIPS = 8;
const MAX_LISTED = 3;

/** The node under the pointer on the canvas (set by NodeShape); `overPip` while on one of its pips. */
export const useNodeHover = create<{ nodeId: string | null; overPip: boolean }>(() => ({
  nodeId: null,
  overPip: false,
}));

/** The palette card under the pointer (set by LibraryPanel). Ports are virtual, so they come whole. */
export const usePaletteHover = create<{
  id: string | null;
  rect: DOMRect | null;
  port?: NodeDefinition;
  portPlaced?: boolean;
}>(() => ({ id: null, rect: null }));

export const hidePaletteCard = () => usePaletteHover.setState({ id: null, rect: null, port: undefined });

const STATUS_COLOR: Record<BuildStatus, string> = {
  external: "#b8a98f",
  drawn: "#4c9aff",
  ai: "#a78bfa",
  file: "#9ca3af",
  sketch: "#6b7280",
};

export default function InfoCardHost({ canvasHost }: { canvasHost: RefObject<HTMLDivElement | null> }) {
  const palette = usePaletteHover();
  const { nodeId, overPip } = useNodeHover();
  const busy = useApp((s) => !!s.placingDefId || !!s.wireDrag || s.boundaryDrawing);
  const key = palette.id ? `p:${palette.id}` : nodeId && !overPip ? `n:${nodeId}` : null;
  const [shown, setShown] = useState<string | null>(null);

  useEffect(() => {
    setShown(null);
    if (!key) return;
    const t = setTimeout(() => setShown(key), HOVER_DELAY_MS);
    return () => clearTimeout(t);
  }, [key]);

  if (!key || shown !== key || busy) return null;
  if (palette.id && palette.rect) {
    return (
      <Floating anchor={{ left: palette.rect.left, right: palette.rect.right, top: palette.rect.top }}>
        {palette.port ? (
          <PortFacts def={palette.port} footer={palette.portPlaced ? "Already on this canvas (one of each)" : PLACE_HINT} />
        ) : (
          <PaletteFacts defId={palette.id} />
        )}
      </Floating>
    );
  }
  if (nodeId) return <NodeCard nodeId={nodeId} canvasHost={canvasHost} />;
  return null;
}

const PLACE_HINT = "Click, then click the canvas — or drag onto it — to place";

/**
 * Positions a card beside an anchor: to its right, or to its left when
 * there's no room; slid up to stay on screen.
 */
function Floating({
  anchor,
  children,
}: {
  anchor: { left: number; right: number; top: number };
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [top, setTop] = useState(anchor.top);
  useLayoutEffect(() => {
    const h = ref.current?.offsetHeight ?? 0;
    setTop(Math.max(8, Math.min(anchor.top, window.innerHeight - h - 8)));
  }, [anchor.top, children]);
  const fitsRight = anchor.right + GAP + CARD_WIDTH <= window.innerWidth - 8;
  const left = fitsRight ? anchor.right + GAP : Math.max(8, anchor.left - GAP - CARD_WIDTH);
  return (
    <div
      ref={ref}
      className="pointer-events-none fixed z-[60] rounded-lg border border-[#3a3d52] bg-[#22242e] text-[#c9cbd8] shadow-2xl"
      style={{ left, top, width: CARD_WIDTH }}
    >
      {children}
    </div>
  );
}

// ---- Palette ----

function PaletteFacts({ defId }: { defId: string }) {
  const def = useApp((s) => s.definitions[defId]);
  const canvases = useApp((s) => s.canvases);
  if (!def) return null;
  const status = definitionStatus(def, canvases);
  const sketch = status === "file" && hasDrawnContents(def.canvasId ? canvases[def.canvasId] : undefined);
  return (
    <>
      <Header def={def} />
      <Section>
        <Kind status={status} note={sketch ? "its drawn interior is a reference sketch" : undefined} />
        {status !== "external" && (
          <Fact label="Language">
            {def.language ? LANGUAGES[def.language].name : <Muted>inherited from where it's placed</Muted>}
          </Fact>
        )}
        <Layers def={def} />
      </Section>
      <Pips def={def} />
      <Footer>{PLACE_HINT}</Footer>
    </>
  );
}

function PortFacts({ def, footer }: { def: NodeDefinition; footer: string }) {
  const Icon = def.id === PORT_IN ? LogIn : LogOut;
  return (
    <>
      <div className="flex items-center gap-2.5 border-b border-[#2e3040] px-3 py-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-[#191a21]">
          <Icon size={18} color="#c9cbd8" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-[#e2e4ee]">{def.name}</div>
          <div className="text-[11px] text-[#7a7d92]">Port of {def.portOf}</div>
        </div>
      </div>
      <Section>
        <div className="text-xs">
          {def.portOf}'s {def.id === PORT_IN ? "inbound" : "outbound"} connections, seen from inside.{" "}
          <Muted>Never built.</Muted>
        </div>
      </Section>
      <Pips def={def} />
      <Footer>{footer}</Footer>
    </>
  );
}

// ---- Placed node ----

function NodeCard({ nodeId, canvasHost }: { nodeId: string; canvasHost: RefObject<HTMLDivElement | null> }) {
  const canvasId = useApp((s) => s.activeCanvasId);
  const node = useApp((s) => s.canvases[s.activeCanvasId]?.nodes.find((n) => n.id === nodeId));
  const viewport = useApp((s) => s.viewport);
  const definitions = useApp((s) => s.definitions);
  const def = node ? resolveDef(definitions, canvasId, node.definitionId) : undefined;
  const host = canvasHost.current?.getBoundingClientRect();
  if (!node || !def || !host) return null;

  const left = host.left + viewport.x + node.x * viewport.scale;
  const anchor = {
    left,
    right: left + NODE_WIDTH * viewport.scale,
    top: host.top + viewport.y + node.y * viewport.scale,
  };
  // Never above the canvas, even when the node is half off its top edge
  anchor.top = Math.max(anchor.top, host.top + 8);

  return (
    <Floating anchor={anchor}>
      {isPortDefId(node.definitionId) ? (
        <PortFacts def={def} footer="Its pips mirror the connections at this edge" />
      ) : def.expandable ? (
        <PocketFacts def={def} />
      ) : (
        <PlacedFacts nodeId={nodeId} def={def} />
      )}
    </Floating>
  );
}

function PocketFacts({ def }: { def: NodeDefinition }) {
  return (
    <>
      <Header def={def} />
      <Section>
        <div className="text-xs">
          Collapsed group — its contents belong to this canvas, so it adds no folder.
        </div>
      </Section>
      <Pips def={def} />
      <Footer>Double-click to open inside · the corner button expands it</Footer>
    </>
  );
}

function PlacedFacts({ nodeId, def }: { nodeId: string; def: NodeDefinition }) {
  const projectName = useApp((s) => s.projectName);
  const canvases = useApp((s) => s.canvases);
  const definitions = useApp((s) => s.definitions);
  const trail = useApp((s) => s.trail);
  const plan = useMemo(() => buildPlan(projectName, canvases, definitions), [projectName, canvases, definitions]);
  const here = placementForTrail(plan, nodeId, trail);
  const others = placementsOf(plan, nodeId).filter((p) => p !== here);
  const nameOf = (p: Placement) => definitions[p.definitionId]?.name ?? "?";

  if (!here) {
    return (
      <>
        <Header def={def} />
        <Section>
          <Muted>Not reachable from the top canvas, so it has no path.</Muted>
        </Section>
        <Pips def={def} />
      </>
    );
  }

  const built = !!here.path;
  const clashes = clashesWith(plan, here);
  const reused = reusedInterior(plan, here);
  const sketch = here.status === "file" && hasDrawnContents(def.canvasId ? canvases[def.canvasId] : undefined);

  return (
    <>
      <Header def={def} />
      <Section>
        <Kind status={here.status} note={sketch ? "its drawn interior is a reference sketch" : undefined} />
        {built && (
          <Fact label="Path">
            <span className="break-all font-mono text-[11px] text-[#e2e4ee]">
              {here.path}
              {here.status !== "file" && "/"}
            </span>
            {here.overridden && <Badge>typed</Badge>}
            {here.projectRoot && <Muted> · the project folder</Muted>}
          </Fact>
        )}
        {built && (
          <Fact label="Language">
            {here.language ? (
              <>
                {LANGUAGES[here.language].name}
                {!def.language && <Muted> · inherited</Muted>}
              </>
            ) : (
              <Muted>not set — the export will flag it</Muted>
            )}
          </Fact>
        )}
        <Layers def={def} />
      </Section>
      {(clashes.length > 0 || reused.length > 0 || (built && others.length > 0)) && (
        <Section>
          {clashes.length > 0 && (
            <Warning>
              Same path as {clashes.slice(0, MAX_LISTED).map(nameOf).join(", ")}
              {clashes.length > MAX_LISTED && ` and ${clashes.length - MAX_LISTED} more`}
            </Warning>
          )}
          {reused.length > 0 && (
            <Warning>
              Placed {reused.length + 1} times — this one design is built under each:
              <PathList paths={reused.map((p) => p.path!)} />
            </Warning>
          )}
          {built && others.length > 0 && reused.length === 0 && (
            <Warning>
              Also built at (a node it's inside is placed more than once):
              <PathList paths={others.filter((p) => p.path).map((p) => p.path!)} />
            </Warning>
          )}
        </Section>
      )}
      <Pips def={def} />
      <Footer>Double-click to open inside</Footer>
    </>
  );
}

// ---- Pieces ----

function Header({ def }: { def: NodeDefinition }) {
  const customIcons = useApp((s) => s.customIcons);
  const Lucide = !def.icon.startsWith("custom:") ? icons[def.icon as keyof typeof icons] : null;
  return (
    <div className="flex items-center gap-2.5 border-b border-[#2e3040] px-3 py-2.5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-[#191a21]">
        {Lucide ? (
          <Lucide size={18} color="#c9cbd8" />
        ) : (
          <img src={customIcons[def.icon.slice(7)]} className="h-5 w-5 object-contain" alt="" />
        )}
      </div>
      <div className="min-w-0">
        <div className="break-words text-sm font-semibold text-[#e2e4ee]">{def.name}</div>
        <div className="truncate font-mono text-[11px] text-[#7a7d92]">
          {slugOf(def)}
          {isStandardDef(def.id) && <span className="font-sans"> · standard library</span>}
        </div>
      </div>
    </div>
  );
}

function Section({ children }: { children: React.ReactNode }) {
  return <div className="space-y-1.5 border-b border-[#2e3040] px-3 py-2 last:border-b-0">{children}</div>;
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2 text-xs">
      <span className="w-[4.5rem] shrink-0 text-[#7a7d92]">{label}</span>
      <span className="min-w-0">{children}</span>
    </div>
  );
}

function Kind({ status, note }: { status: BuildStatus; note?: string }) {
  return (
    <div className="flex items-start gap-2 text-xs text-[#e2e4ee]">
      <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: STATUS_COLOR[status] }} />
      <span>
        {STATUS_TEXT[status]}
        {note && <Muted> — {note}</Muted>}
      </span>
    </div>
  );
}

function Layers({ def }: { def: NodeDefinition }) {
  return (
    <Fact label="Layers">
      {def.layers.map((l, i) => (
        <span key={l}>
          {i > 0 && <Muted> · </Muted>}
          <span style={{ color: LAYER_COLORS[l] }}>{LAYER_LABELS[l]}</span>
        </span>
      ))}
    </Fact>
  );
}

const ARROW: Record<PipDef["direction"], string> = {
  inbound: "in",
  outbound: "out",
  bidirectional: "both",
  none: "",
};

function Pips({ def }: { def: NodeDefinition }) {
  const transports = useApp((s) => s.transports);
  const styles = useApp((s) => s.styles);
  const pips = def.pips.filter((p) => !p.removed);
  return (
    <Section>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-[#565a72]">
        {pips.length ? `Pips (${pips.length})` : "No pips"}
      </div>
      {pips.slice(0, MAX_PIPS).map((p) => {
        const ring = transports[p.transportId]?.color ?? "#888";
        const core = isAnyStyle(p.styleId) ? undefined : styles[p.styleId]?.color;
        return (
          <div key={p.id} className="flex items-center gap-2 text-xs">
            <span className="flex h-3 w-3 shrink-0 items-center justify-center rounded-full" style={{ background: ring }}>
              {core && <span className="h-1.5 w-1.5 rounded-full ring-1 ring-black" style={{ background: core }} />}
            </span>
            <span className="min-w-0 flex-1 truncate text-[#e2e4ee]">{p.label || <Muted>unnamed</Muted>}</span>
            <span className="shrink-0 text-[11px] text-[#7a7d92]">
              {connLabel(p, transports, styles)}
              {ARROW[p.direction] && ` · ${ARROW[p.direction]}`}
            </span>
          </div>
        );
      })}
      {pips.length > MAX_PIPS && <Muted>+{pips.length - MAX_PIPS} more</Muted>}
    </Section>
  );
}

function PathList({ paths }: { paths: string[] }) {
  return (
    <span className="mt-0.5 block">
      {paths.slice(0, MAX_LISTED).map((p) => (
        <span key={p} className="block break-all font-mono text-[11px]">
          {p}
        </span>
      ))}
      {paths.length > MAX_LISTED && <span className="block">and {paths.length - MAX_LISTED} more</span>}
    </span>
  );
}

function Warning({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-1.5 text-xs text-[#fbbf24]">
      <AlertTriangle size={13} className="mt-px shrink-0" />
      <span className="min-w-0">{children}</span>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="ml-1.5 rounded border border-[#3a3d52] px-1 py-px align-middle text-[10px] text-[#8a8ea6]">
      {children}
    </span>
  );
}

const Muted = ({ children }: { children: React.ReactNode }) => <span className="text-[#7a7d92]">{children}</span>;

function Footer({ children }: { children: React.ReactNode }) {
  return <div className="rounded-b-lg bg-[#1e1f28] px-3 py-1.5 text-[11px] text-[#7a7d92]">{children}</div>;
}
