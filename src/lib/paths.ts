// Where each placed node would be built: walking down from the top canvas,
// every buildable folder adds its name (in its language's convention) and a
// file ends the path with name + extension. Externals get no path; pockets
// and port nodes add nothing. Pure — the hover card and the export (v1.4)
// both read this. See DECISIONS.md, "Hephaestus groundwork (v1.3)".

import { CanvasData, NodeDefinition } from "../types";
import { isPortDefId } from "./ports";
import { LanguageId, convert, fileName, folderName, slugOf, slugify } from "./naming";

/**
 * What a placed node is, for building:
 * - external: marked external, or inside something external — never built
 * - drawn: a folder whose contents you drew
 * - ai: a folder whose contents the AI decides (interior not drawn)
 * - file: a single file
 * - sketch: inside a File — a reference sketch, not built
 */
export type BuildStatus = "external" | "drawn" | "ai" | "file" | "sketch";

/**
 * One placement of a node. A node inside a shared interior has one per
 * placement of its ancestors (the same definition placed twice builds twice).
 */
export interface Placement {
  nodeId: string;
  /** The canvas holding the node. */
  canvasId: string;
  definitionId: string;
  /** Node ids from the top canvas down, ending with this node (pockets included). */
  chain: string[];
  status: BuildStatus;
  /** Effective language: its own, else the nearest ancestor's; undefined when none is set. */
  language?: LanguageId;
  /** "snip/links/link_service.py" — starts with the project folder; null when not built. */
  path: string | null;
  /** The path was typed by the user (on this node) rather than derived. */
  overridden: boolean;
  /** The lone top-level system: the project folder plays its role. */
  projectRoot: boolean;
}

export interface BuildPlan {
  projectFolder: string;
  placements: Placement[];
}

/** The project's folder name: its name, as a kebab-case slug ("Snip App" → "snip-app"). */
export const projectFolderName = (projectName: string): string => convert(slugify(projectName), "kebab");

const BAD_CHARS = /[<>:"|?*\u0000-\u001f]/g;

/**
 * A typed path override, cleaned up: separators unified to `/`, empty, `.`,
 * and `..` segments dropped, characters no filesystem allows removed. Casing
 * is kept — an override is exactly what the user wants. "" means none.
 */
export function normalizeOverride(input: string): string {
  return input
    .split(/[\\/]+/)
    .map((seg) => seg.replace(BAD_CHARS, "").trim().replace(/[. ]+$/, ""))
    .filter((seg) => seg && seg !== "." && seg !== "..")
    .join("/");
}

const isBuildable = (s: BuildStatus) => s === "drawn" || s === "ai" || s === "file";

/** True when a canvas has anything drawn on it besides port nodes. */
export const hasDrawnContents = (canvas: CanvasData | undefined): boolean =>
  !!canvas?.nodes.some((n) => !isPortDefId(n.definitionId));

/** The nodes that sit on a canvas once its pockets are unfolded (ports left out). */
function unfolded(
  canvases: Record<string, CanvasData>,
  defs: Record<string, NodeDefinition>,
  canvasId: string,
  seen = new Set<string>()
): { node: CanvasData["nodes"][number]; def: NodeDefinition }[] {
  const canvas = canvases[canvasId];
  if (!canvas || seen.has(canvasId)) return [];
  seen.add(canvasId);
  return canvas.nodes.flatMap((node) => {
    const def = defs[node.definitionId];
    if (!def || isPortDefId(node.definitionId)) return [];
    if (def.expandable) return def.canvasId ? unfolded(canvases, defs, def.canvasId, seen) : [];
    return [{ node, def }];
  });
}

interface WalkCtx {
  parentPath: string[];
  language?: LanguageId;
  external: boolean;
  sketch: boolean;
  chain: string[];
  /** On the top canvas (or in a pocket folded there). */
  top: boolean;
  /** Canvases already entered on this branch (guards against cycles). */
  seen: Set<string>;
}

export function buildPlan(
  projectName: string,
  canvases: Record<string, CanvasData>,
  defs: Record<string, NodeDefinition>,
  rootId = "canvas-root"
): BuildPlan {
  const projectFolder = projectFolderName(projectName);
  const placements: Placement[] = [];

  // One top-level buildable folder adds no level: the project folder plays its role
  const top = unfolded(canvases, defs, rootId).filter(({ def }) => !def.external);
  const lone = top.length === 1 && top[0].def.kind !== "file" && !top[0].node.pathOverride ? top[0].node.id : null;

  const walk = (canvasId: string, ctx: WalkCtx) => {
    const canvas = canvases[canvasId];
    if (!canvas || ctx.seen.has(canvasId)) return;
    const seen = new Set(ctx.seen).add(canvasId);

    for (const node of canvas.nodes) {
      if (isPortDefId(node.definitionId)) continue;
      const def = defs[node.definitionId];
      if (!def) continue;
      const chain = [...ctx.chain, node.id];

      // A pocket is a fold: its contents belong to this canvas
      if (def.expandable) {
        if (def.canvasId) walk(def.canvasId, { ...ctx, chain, seen });
        continue;
      }

      const language = def.language ?? ctx.language;
      const external = ctx.external || !!def.external;
      const interior = def.canvasId ? canvases[def.canvasId] : undefined;
      const status: BuildStatus = external
        ? "external"
        : ctx.sketch
          ? "sketch"
          : def.kind === "file"
            ? "file"
            : hasDrawnContents(interior)
              ? "drawn"
              : "ai";

      let segs: string[] | null = null;
      let overridden = false;
      const projectRoot = ctx.top && node.id === lone;
      if (isBuildable(status)) {
        const override = node.pathOverride ? normalizeOverride(node.pathOverride) : "";
        if (override) {
          segs = [projectFolder, ...override.split("/")];
          overridden = true;
        } else if (projectRoot) {
          segs = [projectFolder];
        } else {
          const slug = slugOf(def);
          const name = status === "file" ? (language ? fileName(slug, language) : slug) : folderName(slug, language);
          segs = [...ctx.parentPath, name];
        }
      }

      placements.push({
        nodeId: node.id,
        canvasId,
        definitionId: def.id,
        chain,
        status,
        language,
        path: segs ? segs.join("/") : null,
        overridden,
        projectRoot: projectRoot && !!segs,
      });

      if (def.canvasId) {
        walk(def.canvasId, {
          parentPath: segs ?? ctx.parentPath,
          language,
          external,
          sketch: ctx.sketch || status === "file",
          chain,
          top: false,
          seen,
        });
      }
    }
  };

  walk(rootId, { parentPath: [projectFolder], external: false, sketch: false, chain: [], top: true, seen: new Set() });
  return { projectFolder, placements };
}

/** Every placement of one node (more than one when an ancestor is placed more than once). */
export const placementsOf = (plan: BuildPlan, nodeId: string): Placement[] =>
  plan.placements.filter((p) => p.nodeId === nodeId);

/**
 * Paths claimed by more than one placement, compared case-insensitively
 * (Windows and macOS folders are). Keyed by the lowercased path.
 */
export function pathClashes(plan: BuildPlan): Map<string, Placement[]> {
  const byPath = new Map<string, Placement[]>();
  for (const p of plan.placements) {
    if (!p.path) continue;
    const key = p.path.toLowerCase();
    byPath.set(key, [...(byPath.get(key) ?? []), p]);
  }
  return new Map([...byPath].filter(([, ps]) => ps.length > 1));
}

/** The other placements a placement's path clashes with. */
export const clashesWith = (plan: BuildPlan, p: Placement): Placement[] =>
  p.path
    ? plan.placements.filter((q) => q !== p && q.path && q.path.toLowerCase() === p.path!.toLowerCase())
    : [];

/**
 * Where else a definition with a drawn interior is built: one design under
 * several paths (each placement builds the whole interior).
 */
export const reusedInterior = (plan: BuildPlan, p: Placement): Placement[] =>
  p.status === "drawn"
    ? plan.placements.filter((q) => q !== p && q.definitionId === p.definitionId && q.status === "drawn")
    : [];
