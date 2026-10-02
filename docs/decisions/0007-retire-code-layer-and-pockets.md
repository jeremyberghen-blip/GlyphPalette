# 0007: Retire the Code layer; collapsed boundaries are same-layer pockets

Date: 2026-09-29
Status: Accepted (amends [0003](0003-c4-layer-system.md))

## Context

The Snip test run (2026-09-28/29) drew a URL shortener down all four C4
layers. At the Code layer — boxes for `createLink()`, `generateSlug()`, a
`Link` type — drawing cost about as much as writing the code, and said less:
a box per function carries less than its signature and goes stale the day the
code changes. Project Hephaestus, the code-generation pipeline GP will feed,
is better placed to own that level.

The same run exposed a bug in how collapsed boundaries got their layer:
collapsing gave the boundary's inner canvas `nextLayer(parent)`, as if it
were a node's interior. Snip's Analytics group, drawn on the Container
canvas, came out labeled Component while holding containers. Decomposition
(a node's interior, one layer down) and grouping (a fold at the same layer)
were sharing one mechanism.

## Decision

**Code layer.** GP no longer draws function-level structure; Hephaestus owns
it. `code` stays in the `Layer` type so older files load and their Code
canvases stay editable, but it is not offered anywhere new (the wizard's
layer picker shows `DRAWABLE_LAYERS`; `nextLayer` clamps at `component`) and
the Function / Class / Type seeds left the library. Component nodes can nest
Component canvases (a Module holding Files), so nesting stays useful at the
bottom and lines up with the planned `dir`/`file` kinds.

**Pockets.** A collapsed boundary's inner canvas is a *pocket*: a same-layer
fold, not a deeper level. It is identified from the existing `expandable`
flag on its owning definition rather than a new stored field, keeps its
parent's layer (`childLayer` in `src/lib/layers.ts`), and files saved with
the old behavior are repaired on load (`repairPocketLayers`). Collapsed
groups are hidden from the palette (placing a second one would silently
share its contents) and labeled as collapsed groups in the palette header,
breadcrumbs, and navigator.

## Consequences

- The C4 zoom now stops at Component. Anything finer is described to
  Hephaestus through Component-level detail (planned for v1.5: notes and key
  exported symbols) and the interfaces on edges.
- Old Code canvases are kept but unsupported: no new Code work, no fixes
  aimed at it.
- Pockets need their own port rules when port nodes land (v1.2): a pocket's
  ports derive bottom-up from wires that crossed the boundary, not top-down
  from a parent definition. The `architecture.json` export (v1.5) flattens
  pockets away.
- A pocket is detected by looking up its owning definition, so every
  "is this a pocket?" check is a scan of definitions — fine at current sizes.
