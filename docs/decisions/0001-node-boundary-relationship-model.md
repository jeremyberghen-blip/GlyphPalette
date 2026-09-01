# 0001: Node / Boundary / Relationship model

Date: 2026-08-09
Status: Accepted

## Context

Glyph Palette originally had a different design (`SAP_SPEC.md`, since removed)
built around a palette/9-slice metaphor. The user's philosophy for what the
tool is *for* changed: not a generic diagramming palette, but a place to
architect a system — decompose it, name its seams, and record that in a form
precise enough to hand off (eventually to an AI code-generation pipeline; see
[0005](0005-defer-hephaestus-integration.md)). The old spec didn't fit that
and was abandoned rather than patched.

## Decision

Rebuild around three primitives:

- **Node** — fixed size, centered icon, label below, border. Its pips (typed,
  directional, color-coded attachment points) come from its *definition*, not
  the instance — so every instance of "API Service" looks and connects the
  same way.
- **Boundary** (named "Container" until [0002](0002-container-to-boundary-rename.md))
  — a resizable box that groups whatever nodes it overlaps; collapses into a
  single library-backed node whose pips are inherited from the relationships
  that crossed the boundary, and re-expands losslessly.
- **Relationship** — a curved wire, typeless until first connected, then
  locked to that pip type. Type and direction (inbound/outbound/bidirectional/
  none) must match on both ends, which guards against wiring backwards.

Definitions live in a system-wide library (see [0004](0004-default-library-copy-on-use.md)
for how that library is now split from the project). A definition may
reference a canvas depicting its internals — canvases are shared by
reference, so re-using a definition means editing its internals once updates
every instance; a different instance gets a different canvas and a different
library entry.

Stack: Tauri v2 + React + TypeScript + Konva (canvas rendering) + Zustand
(state).

## Consequences

- Nodes are cheap to place and stay visually consistent because appearance
  and pips are definition-owned, not per-instance.
- Shared-canvas-by-reference means editing a nested canvas can silently
  change every place that definition is instantiated — a real edge case when
  an instance is meant to diverge (tracked, not yet solved: see the
  "instance reuse" note in `HEPHAESTUS-INTEGRATION.md`).
- Boundary collapse/expand became the mechanism later reused, unmodified, as
  the C4 zoom mechanism ([0003](0003-c4-layer-system.md)) — a payoff that
  wasn't designed in at the time but fell out of the shape of the model.
