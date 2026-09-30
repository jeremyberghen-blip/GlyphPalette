// Soft pip-type layer affinity: which types to suggest first for a definition.

import { Layer, PipType } from "../types";

/** True if `t` is usual on any of `layers` (a type with no hint is usual everywhere). */
export const isUsualOn = (t: PipType, layers: Layer[]): boolean =>
  !t.layers?.length || t.layers.some((l) => layers.includes(l));

/** Splits types into those usual for a definition's layers and the rest, keeping order. */
export function groupPipTypes(
  types: Record<string, PipType>,
  layers: Layer[]
): { usual: PipType[]; other: PipType[] } {
  const all = Object.values(types);
  return {
    usual: all.filter((t) => isUsualOn(t, layers)),
    other: all.filter((t) => !isUsualOn(t, layers)),
  };
}

/**
 * The type a new pip starts with: the usual type most specific to these
 * layers (fewest layers in its hint; unhinted types last), then list order.
 * HTTP on a Container, Call on a Component.
 */
export function defaultPipType(types: Record<string, PipType>, layers: Layer[]): string {
  const { usual, other } = groupPipTypes(types, layers);
  const breadth = (t: PipType) => t.layers?.length || Infinity;
  const best = usual.reduce<PipType | undefined>(
    (acc, t) => (!acc || breadth(t) < breadth(acc) ? t : acc),
    undefined
  );
  return (best ?? other[0])?.id ?? "";
}
