# 0010: Port nodes, and broken-but-kept links

Date: 2026-09-30
Status: Accepted

## Context

Inside a node (Snip API's components, say), nothing showed the node's own
interface: its outer pips didn't appear on the inner canvas, so there was
nothing to wire inner components to and no way to see that the inside covers
the outside. Separately, deleting or retyping a pip silently deleted every
wire attached to it.

Because a definition's inner canvas is shared by every instance of it, "where
does this edge go outside?" has no single answer — two instances can be wired
differently. Only the definition's own interface is shared.

## Decision

**Port nodes.** On any inner canvas the palette offers **Inbound** and
**Outbound** (never on the top level; at most one of each). They carry the
pips of the node whose interior the canvas is, flipped — an inbound parent pip
sends inward from Inbound; an outbound one receives on Outbound;
bidirectional and non-directional pips appear on both. Where those
connections lead outside is deliberately not shown.

- They are virtual: stored as nodes with reserved definition ids
  (`@port-in`, `@port-out`), their pips worked out from the parent each time
  (`src/lib/ports.ts`), using the parent's pip ids — so editing the parent's
  pips updates them, and wires survive.
- Optional and deletable like any node (wires go with them); never swept
  into a boundary collapse, copied, duplicated, or expanded out of a pocket.
- **Pockets:** a collapsed boundary's interior has ports too, carrying its
  inherited pips. The collapse recorded which inner node/pip each crossing
  wire attached to, so those connections are drawn automatically — dashed,
  locked, never stored. Pocket port pips can't be wired by hand.

**Broken-but-kept links, everywhere.** Deleting or retyping a pip never
deletes its wires.
- A deleted pip still in use (by an instance's wire, or by a port wire inside
  its definition) stays on the definition, marked `removed`, until its last
  wire is removed — then it's dropped.
- A wire whose end pip no longer matches the connection type it was drawn
  with (deleted, or retyped incompatibly) is broken: drawn red end to end,
  its red pip explaining why on hover. Once removed, a retyped pip shows its
  new type.

## Consequences

- An inner canvas can now show its parent's interface, and an unwired port pip
  means "this interface isn't implemented inside" — groundwork for in-GP lint
  and for the Hephaestus export's interface contracts.
- Every lookup of a node's definition goes through `resolveDef` /
  `useNodeDef`, since port nodes aren't in `definitions`.
- Wires store the connection type they were drawn with (ADR 0009), which is
  what makes "broken" detectable; it isn't recomputed from the ends.
- Deleting wired pips leaves visible red work to clean up instead of losing
  wires silently — the intended trade.
