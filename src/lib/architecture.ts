// Publish: the project as `architecture.json` — a layout-free description
// for Hephaestus (see HEPHAESTUS-INTEGRATION.md). Pure: built from project
// content; GP never reads it back. Format version 1; settled in
// DECISIONS.md, "Hephaestus Tier 2 (v1.5)".
//
// - Nodes: one per placement (a definition placed twice appears twice),
//   from the build plan (lib/paths.ts). Collapsed groups dissolve; ports,
//   nodes inside External nodes, and Files' reference sketches are left out.
// - Edges: every wire as drawn, once per placement of its canvas. A wire to
//   a port becomes an edge to the parent node, marked `port`, with the pip
//   on each end identified so a chain can be followed across levels. Wires
//   into a collapsed group follow its pip map to the inner node.
// - Warnings: problems never block Publish; they're listed instead.

import { ApiStyle, CanvasData, EdgeKind, Layer, NodeDefinition, RelEnd, Transport } from "../types";
import type { LanguageId } from "./naming";
import { Placement, buildPlan, pathClashes, placementKey, reusedInterior } from "./paths";
import { edgeKind } from "./connections";
import { isPortDefId } from "./ports";
import { wireBroken } from "./broken";

export interface ArchNode {
  /** The placement's chain of node ids, joined with `/` — stable across Publishes. */
  id: string;
  name: string;
  /** The containing node's id; null at the top. */
  parent: string | null;
  kind: "folder" | "file" | "external";
  /** Folders: contents you drew, or contents the AI decides. */
  contents?: "drawn" | "ai";
  /** Where it builds (from the project folder); absent for external nodes. */
  path?: string;
  /** Effective language; null when none is set anywhere above it (warned); absent for external nodes. */
  language?: LanguageId | null;
  layer: Layer;
  /** The definition it's a placement of: shared by every copy of the same part. */
  definition: string;
  description?: string;
  constraints?: string[];
}

export interface ArchEnd {
  node: string;
  /** The pip's id on that node's definition — the same id inside, on its port. */
  pip: string;
  /** The pip's label: the user's own words for the connection. */
  label: string;
  /** This end is the parent's edge, reached from inside through a port node. */
  port?: true;
}

export interface ArchEdge {
  from: ArchEnd;
  to: ArchEnd;
  kind: EdgeKind;
  transport: string;
  style: string;
}

export interface ArchitectureFile {
  format: "glyph-palette/architecture";
  version: 1;
  project: { name: string; folder: string };
  nodes: ArchNode[];
  edges: ArchEdge[];
  warnings: string[];
}

export interface ArchitectureSource {
  projectName: string;
  canvases: Record<string, CanvasData>;
  definitions: Record<string, NodeDefinition>;
  transports: Record<string, Transport>;
  styles: Record<string, ApiStyle>;
}

const UNBUILT_PARENT = new Set(["external", "file", "sketch"]);

export function buildArchitecture(src: ArchitectureSource): ArchitectureFile {
  const { canvases, definitions: defs } = src;
  const plan = buildPlan(src.projectName, canvases, defs);
  const warnings: string[] = [];

  // ---- Nodes
  const byKey = new Map<string, Placement>(plan.placements.map((p) => [placementKey(p.chain), p]));
  const parentOf = (p: Placement): Placement | null => {
    for (let k = p.chain.length - 1; k > 0; k--) {
      const found = byKey.get(placementKey(p.chain.slice(0, k)));
      if (found) return found;
    }
    return null;
  };
  const exported = new Map<string, Placement>();
  for (const p of plan.placements) {
    if (p.status === "sketch") continue;
    const parent = parentOf(p);
    // An External node is enough on its own: what's drawn inside it isn't built
    if (parent && UNBUILT_PARENT.has(parent.status)) continue;
    exported.set(placementKey(p.chain), p);
  }

  const nodes: ArchNode[] = [];
  for (const [key, p] of exported) {
    const def = defs[p.definitionId];
    const parent = parentOf(p);
    const external = p.status === "external";
    const node: ArchNode = {
      id: key,
      name: def.name,
      parent: parent ? placementKey(parent.chain) : null,
      kind: external ? "external" : p.status === "file" ? "file" : "folder",
      ...(p.status === "drawn" || p.status === "ai" ? { contents: p.status } : {}),
      ...(external ? {} : { path: p.path ?? undefined, language: p.language ?? null }),
      layer: canvases[p.canvasId]?.layer ?? "container",
      definition: def.id,
      ...(def.description ? { description: def.description } : {}),
      ...(def.constraints?.length ? { constraints: [...def.constraints] } : {}),
    };
    nodes.push(node);
    if (!external && !p.language && (p.status === "file" || p.status === "ai")) {
      warnings.push(`${p.path}: no language set — set one on ${def.name} or on a folder above it`);
    }
  }

  for (const group of pathClashes(plan).values()) {
    const names = group.map((p) => defs[p.definitionId]?.name ?? "?");
    warnings.push(`Path clash: ${names.join(", ")} all build at ${group[0].path}`);
  }
  const reuseWarned = new Set<string>();
  for (const p of exported.values()) {
    const others = reusedInterior(plan, p);
    if (!others.length || reuseWarned.has(p.definitionId)) continue;
    reuseWarned.add(p.definitionId);
    const paths = [p, ...others].map((q) => q.path).join(", ");
    warnings.push(
      `${defs[p.definitionId].name} is placed ${others.length + 1} times — its drawn contents are built under each: ${paths}`
    );
  }

  // ---- Edges
  const pipLabel = (def: NodeDefinition | undefined, pipId: string) =>
    def?.pips.find((x) => x.id === pipId)?.label ?? "";

  /** Where a wire's end really attaches, from a visit of the canvas it's drawn on. */
  const resolveEnd = (canvasId: string, chain: string[], pocket: boolean, end: RelEnd, depth = 0): ArchEnd | null => {
    const canvas = canvases[canvasId];
    const node = canvas?.nodes.find((n) => n.id === end.nodeId);
    if (!node || depth > 32) return null;
    if (isPortDefId(node.definitionId)) {
      // The parent's edge, seen from inside (a fold's own ports are drawn, never wired)
      if (pocket) return null;
      const ownerKey = placementKey(chain);
      const owner = exported.get(ownerKey);
      return owner ? { node: ownerKey, pip: end.pipId, label: pipLabel(defs[owner.definitionId], end.pipId), port: true } : null;
    }
    const def = defs[node.definitionId];
    if (!def) return null;
    if (def.expandable) {
      // A collapsed group dissolves: follow its pip map to the inner node it stands for
      const inner = def.pipMap?.[end.pipId];
      return inner && def.canvasId ? resolveEnd(def.canvasId, [...chain, node.id], true, inner, depth + 1) : null;
    }
    const key = placementKey([...chain, node.id]);
    return exported.has(key) ? { node: key, pip: end.pipId, label: pipLabel(def, end.pipId) } : null;
  };

  /** The pip a wire end is drawn on (a port's pips are its parent's). */
  const drawnPip = (canvasId: string, chain: string[], end: RelEnd) => {
    const node = canvases[canvasId]?.nodes.find((n) => n.id === end.nodeId);
    if (!node) return undefined;
    const def = isPortDefId(node.definitionId) ? defs[exported.get(placementKey(chain))?.definitionId ?? ""] : defs[node.definitionId];
    return def?.pips.find((x) => x.id === end.pipId);
  };

  const edges: ArchEdge[] = [];
  const brokenWarned = new Set<string>();
  for (const visit of plan.visits) {
    if (visit.unbuilt) continue;
    const canvas = canvases[visit.canvasId];
    for (const rel of canvas?.relationships ?? []) {
      const from = resolveEnd(visit.canvasId, visit.chain, visit.pocket, rel.from);
      const to = resolveEnd(visit.canvasId, visit.chain, visit.pocket, rel.to);
      if (!from || !to) continue;
      if (wireBroken(rel, drawnPip(visit.canvasId, visit.chain, rel.from), drawnPip(visit.canvasId, visit.chain, rel.to))) {
        if (!brokenWarned.has(rel.id)) {
          brokenWarned.add(rel.id);
          const name = (e: ArchEnd) => nodes.find((n) => n.id === e.node)?.name ?? "?";
          warnings.push(`Skipped a broken wire: ${name(from)} → ${name(to)} (a pip at one end was deleted or changed)`);
        }
        continue;
      }
      edges.push({
        from,
        to,
        kind: edgeKind(rel, src.styles),
        transport: src.transports[rel.transportId]?.name ?? rel.transportId,
        style: src.styles[rel.styleId]?.name ?? rel.styleId,
      });
    }
  }

  return {
    format: "glyph-palette/architecture",
    version: 1,
    project: { name: src.projectName, folder: plan.projectFolder },
    nodes,
    edges,
    warnings,
  };
}

/** A one-line count for the Publish summary: "12 nodes (3 folders, 7 files, 2 external) · 14 connections". */
export function architectureSummary(a: ArchitectureFile): string {
  const count = (k: ArchNode["kind"]) => a.nodes.filter((n) => n.kind === k).length;
  const plural = (n: number, one: string, many = one + "s") => `${n} ${n === 1 ? one : many}`;
  return (
    `${plural(a.nodes.length, "node")} (${plural(count("folder"), "folder")}, ${plural(count("file"), "file")}, ` +
    `${count("external")} external) · ${plural(a.edges.length, "connection")}`
  );
}
