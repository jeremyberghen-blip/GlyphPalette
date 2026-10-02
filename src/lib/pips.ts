// Pure helpers for pips as the node dialogs present them: which section a
// pip is listed in, and where a new one starts.

import { PipDef, PipDirection } from "../types";

/** Where a new pip sits by default: inbound on the left, everything else on the right. */
export const defaultSide = (direction: PipDirection): PipDef["side"] =>
  direction === "inbound" ? "left" : "right";

/**
 * Pips in the node dialog's three sections, each in the definition's own
 * order: Inbound, Outbound, and Both ways / other (bidirectional and
 * non-directional).
 */
export function groupPipsByDirection<P extends Pick<PipDef, "direction">>(
  pips: P[]
): { inbound: P[]; outbound: P[]; other: P[] } {
  return {
    inbound: pips.filter((p) => p.direction === "inbound"),
    outbound: pips.filter((p) => p.direction === "outbound"),
    other: pips.filter((p) => p.direction === "bidirectional" || p.direction === "none"),
  };
}
