# 0002: Rename Container → Boundary

Date: 2026-08-30
Status: Accepted

## Context

The grouping box from [0001](0001-node-boundary-relationship-model.md) was
named "Container." Adopting a C4-style layer system ([0003](0003-c4-layer-system.md))
gives "Container" a specific, different meaning: the second C4 zoom level
(deployable/runnable units — services, databases, queues). Keeping both
meanings on one word guarantees confusion in code, UI copy, and conversation.

## Decision

Rename the grouping box to **Boundary** everywhere: the `ContainerData` type,
`ContainerShape`/`ContainerModal` components, every store action
(`addContainer` → `addBoundary`, etc.), UI labels, and the `.glyph` field
`containers` → `boundaries`. "Container" is now free to mean only the C4
layer. `loadProjectData` migrates old project files (`containers` →
`boundaries`) on load.

C4 itself calls this kind of grouping a "boundary" (dashed groupings on a
diagram), so the new name is more correct, not just a disambiguation hack.

## Consequences

- No functional change; this was a pure rename, verified in the browser
  before anything else was built on top of it.
- Any external notes, screenshots, or muscle memory referring to "Container"
  as the grouping box are now stale.
- Frees "Container" for [0003](0003-c4-layer-system.md) without a collision.
