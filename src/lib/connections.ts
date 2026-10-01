// Two-part connection types: every pip and wire has a transport (how the
// bytes travel — HTTP, TCP, a message queue…) and an API style (what they
// mean — REST/JSON, SQL, events…). See DECISIONS.md, "Two-part connection
// types". The style "any" stands for pass-through: a firewall or proxy that
// carries a transport without caring what's inside.

import { ANY_STYLE, ApiStyle, Layer, Transport } from "../types";

/** A pip's or wire's connection type. */
export interface ConnType {
  transportId: string;
  styleId: string;
}

export const isAnyStyle = (styleId: string): boolean => styleId === ANY_STYLE;

/** Transports match exactly; styles match, or either side is "any". */
export function compatible(a: ConnType, b: ConnType): boolean {
  return (
    a.transportId === b.transportId &&
    (a.styleId === b.styleId || isAnyStyle(a.styleId) || isAnyStyle(b.styleId))
  );
}

/** The type a wire between two compatible pips carries: the more specific style. */
export function wireType(a: ConnType, b: ConnType): ConnType {
  return { transportId: a.transportId, styleId: isAnyStyle(a.styleId) ? b.styleId : a.styleId };
}

/** Human label: "HTTP / REST/JSON", or just "HTTP" for "any". */
export function connLabel(
  t: ConnType,
  transports: Record<string, Transport>,
  styles: Record<string, ApiStyle>
): string {
  const tr = transports[t.transportId]?.name ?? "?";
  return isAnyStyle(t.styleId) ? tr : `${tr} / ${styles[t.styleId]?.name ?? "?"}`;
}

// ---- Soft affinity: what to suggest first in the node dialog ----

/** True if `t` is usual on any of `layers` (no hint = usual everywhere). */
export const transportUsualOn = (t: Transport, layers: Layer[]): boolean =>
  !t.layers?.length || t.layers.some((l) => layers.includes(l));

/** Transports usual for a definition's layers first, the rest after; order kept. */
export function groupTransports(
  transports: Record<string, Transport>,
  layers: Layer[]
): { usual: Transport[]; other: Transport[] } {
  const all = Object.values(transports);
  return {
    usual: all.filter((t) => transportUsualOn(t, layers)),
    other: all.filter((t) => !transportUsualOn(t, layers)),
  };
}

/** True if `s` usually goes with `transportId` ("any" goes with everything). */
export const styleUsualWith = (s: ApiStyle, transportId: string): boolean =>
  isAnyStyle(s.id) || !s.transports?.length || s.transports.includes(transportId);

/** Styles usual with a transport first ("any" leading), the rest after. */
export function groupStyles(
  styles: Record<string, ApiStyle>,
  transportId: string
): { usual: ApiStyle[]; other: ApiStyle[] } {
  const all = Object.values(styles).sort((a, b) => Number(isAnyStyle(b.id)) - Number(isAnyStyle(a.id)));
  return {
    usual: all.filter((s) => styleUsualWith(s, transportId)),
    other: all.filter((s) => !styleUsualWith(s, transportId)),
  };
}

/**
 * The connection type a new pip starts with: the usual transport most
 * specific to these layers (fewest layers in its hint; unhinted last), then
 * that transport's default style. HTTP + REST/JSON on a Container,
 * In-process + Call on a Component.
 */
export function defaultConnType(
  transports: Record<string, Transport>,
  styles: Record<string, ApiStyle>,
  layers: Layer[]
): ConnType {
  const { usual, other } = groupTransports(transports, layers);
  const breadth = (t: Transport) => t.layers?.length || Infinity;
  const best = usual.reduce<Transport | undefined>(
    (acc, t) => (!acc || breadth(t) < breadth(acc) ? t : acc),
    undefined
  ) ?? other[0];
  const styleId = best?.defaultStyle && styles[best.defaultStyle] ? best.defaultStyle : ANY_STYLE;
  return { transportId: best?.id ?? "", styleId };
}
