// Importing definitions from another project into this one.

import { ApiStyle, DRAWABLE_LAYERS, NodeDefinition, Transport } from "../types";
import { uniqueName } from "./definitions";
import { uid } from "./ids";
import { ProjectContent } from "./projectFile";

/** What a source project can offer: its own, reusable definitions. */
export function importCandidates(
  source: ProjectContent,
  isStandard: (id: string) => boolean
): NodeDefinition[] {
  return Object.values(source.definitions)
    .filter((d) => !isStandard(d.id))
    .filter((d) => !d.expandable) // pockets are folds, not parts
    .filter((d) => d.layers.some((l) => DRAWABLE_LAYERS.includes(l)))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export interface ImportPlan {
  definitions: NodeDefinition[];
  transports: Transport[];
  styles: ApiStyle[];
  customIcons: Record<string, string>;
}

/**
 * Plans bringing `ids` from `source` into `target`. Imported definitions come
 * across with an empty interior. One that collides with an existing id or
 * name gets a new id and its source project's name appended —
 * `Links DB (Snip)` — so both coexist. Transports and styles come along
 * only where the target lacks them (existing ones keep their colors); custom icons come along
 * as needed.
 */
export function planImport(
  source: ProjectContent,
  target: Pick<ProjectContent, "definitions" | "transports" | "styles" | "customIcons">,
  ids: string[],
  sourceName: string,
  newId: () => string = () => `def-${uid()}`,
  newIconId: () => string = uid
): ImportPlan {
  const names = new Set(Object.values(target.definitions).map((d) => d.name.toLowerCase()));
  const takenIds = new Set(Object.keys(target.definitions));
  const taken = (n: string) => names.has(n.toLowerCase());
  const plan: ImportPlan = { definitions: [], transports: [], styles: [], customIcons: {} };
  const added = new Set<string>();
  /** Brings a transport or style across only where the target lacks it (keeping existing colors). */
  const bring = <T extends { id: string }>(id: string, from: Record<string, T>, to: Record<string, T>, into: T[]) => {
    if (!to[id] && !added.has(id) && from[id]) {
      added.add(id);
      into.push(from[id]);
    }
  };

  for (const id of ids) {
    const src = source.definitions[id];
    if (!src || src.expandable) continue;
    const def: NodeDefinition = {
      id: src.id,
      name: src.name,
      icon: src.icon,
      layers: [...src.layers],
      pips: src.pips.filter((p) => !p.removed).map((p) => ({ ...p })),
      canvasId: null,
      ...(src.slug ? { slug: src.slug } : {}),
      ...(src.external ? { external: true } : {}),
      ...(src.kind ? { kind: src.kind } : {}),
      ...(src.language ? { language: src.language } : {}),
    };
    if (takenIds.has(def.id) || taken(def.name)) {
      def.id = newId();
      def.name = uniqueName(`${src.name} (${sourceName})`, taken);
    }
    takenIds.add(def.id);
    names.add(def.name.toLowerCase());

    if (def.icon.startsWith("custom:")) {
      const iconId = def.icon.slice(7);
      const data = source.customIcons[iconId];
      if (data && target.customIcons[iconId] !== data) {
        const useId = target.customIcons[iconId] ? newIconId() : iconId;
        plan.customIcons[useId] = data;
        def.icon = `custom:${useId}`;
      }
    }

    for (const p of def.pips) {
      bring(p.transportId, source.transports, target.transports, plan.transports);
      bring(p.styleId, source.styles, target.styles, plan.styles);
    }
    plan.definitions.push(def);
  }
  return plan;
}
