# 0003: C4 layer system on canvases and definitions

Date: 2026-08-30
Status: Accepted

## Context

Glyph Palette's nested-canvas zoom (draw a subsystem, double-click in, draw
its internals) already matches C4's recursive decomposition: Context →
Container → Component → Code, the same kind of diagram redrawn at each zoom
level with a different vocabulary of nodes. Without an explicit notion of
"what level am I looking at," the definition library was one flat list —
every node (Database, File, Function, Person, ...) offered everywhere,
including places they don't belong (a File at the Container level, a
Database at the Component level). That's slower to search and doesn't guard
against modeling mistakes.

## Decision

- `Layer = "context" | "container" | "component" | "code"`, an ordered enum
  (`nextLayer` steps one deeper, clamped at `"code"`).
- `CanvasData.layer`: every canvas sits at one layer. The root canvas is
  `"context"`. Entering a node's inner canvas for the first time sets the
  child's layer to `nextLayer(parent.layer)`; collapsing a Boundary does the
  same for the canvas it creates.
- `NodeDefinition.layers: Layer[]`: which layer(s) a definition may be placed
  on. Most definitions are single-layer; a few (External System, Person)
  legitimately span several, because C4 redraws them for context at more
  than one zoom level.
- The library panel filters its palette to the active canvas's layer. The
  definition wizard exposes layer selection as a set of toggle chips, seeded
  from the current canvas's layer.
- A fresh project's root canvas is seeded as a System Context diagram: one
  **System** node (representing the project) to decompose, with Person and
  External System as the only other placeable defs there.

Layer is stored on the canvas, not derived purely from nesting depth — C4
itself skips the Code level routinely, and forcing depth-equals-layer would
make that impossible.

## Consequences

- Placing is faster and safer: the palette only ever shows what's valid at
  the current zoom level, which is also a guard against modeling errors
  (Database can't end up inside a Component canvas).
- Old `.glyph` files predate `layer`/`layers`; `loadProjectData` backfills
  both — canvases by walking the tree from `canvas-root` and applying
  `nextLayer` at each hop, definitions by defaulting missing `layers` to
  `["container"]`.
- The Code layer (functions/classes/methods) is scaffolded but unproven —
  no project has actually decomposed a file into functions yet. Treat it as
  provisional until that happens (see `HEPHAESTUS-INTEGRATION.md`, Tier 3).
- pip types don't yet carry a layer affinity (a transport-kind pip showing up
  as an option on a Component-layer definition is still possible). Not
  addressed here; tracked as backlog in `ROADMAP.md`.
