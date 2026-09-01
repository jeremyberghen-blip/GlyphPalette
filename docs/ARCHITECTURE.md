# Architecture

What Glyph Palette is made of, as of v1.0.0. For *why* things are shaped this
way, see [`decisions/`](decisions/); for what's next, see [`ROADMAP.md`](ROADMAP.md).

## Stack

Tauri v2 (Rust shell, native window, filesystem/dialog access) + React 19 +
TypeScript + Konva/react-konva (canvas rendering) + Zustand (state) + Vite.

## Core concepts

- **Node** ([`NodeInstance`](../src/types.ts)) — a placed instance on a
  canvas (`id`, `definitionId`, `x`, `y`). Everything about how it looks and
  what it can connect to comes from its **definition**
  ([`NodeDefinition`](../src/types.ts)): name, icon, `layers` (see below),
  and `pips`.
- **Pip** ([`PipDef`](../src/types.ts)) — a labeled, color-coded, typed,
  directional attachment point on a definition. Direction is
  `inbound | outbound | bidirectional | none`. Two pips can connect only if
  their `PipType` matches and their directions pair up
  (`outbound`↔`inbound`, `bidirectional`↔`bidirectional`, `none`↔`none`) —
  see `canConnect` in [`src/lib/graph.ts`](../src/lib/graph.ts).
- **Relationship** ([`Relationship`](../src/types.ts)) — a wire between two
  pips, `from`/`to` normalized so `from` is the outbound side when
  directional. Typeless until first connected; takes its `typeId` from
  whichever pip it was dragged from.
- **Boundary** ([`Boundary`](../src/types.ts)) — a resizable box that groups
  every node it overlaps. Collapsing one (`collapseBoundary` in
  [`src/store.ts`](../src/store.ts)) turns it into a single library-backed
  node: one inherited pip per distinct relationship that crossed the
  boundary, tracked in `pipMap` so expansion (`expandNode`) can rewire back
  to the specific inner node/pip it came from.
- **Canvas** ([`CanvasData`](../src/types.ts)) — a flat `nodes` +
  `relationships` + `boundaries` list. A definition may reference a canvas
  depicting its internals (`canvasId`); canvases are shared by reference, so
  two instances of the same definition show — and edit — the same interior.
  `enterDefinition` creates that inner canvas lazily, on first double-click.
- **Layer** (`Layer` in [`src/types.ts`](../src/types.ts)) — every canvas sits
  at one of `context < container < component < code` (C4's zoom levels).
  Every definition declares which layer(s) it may be placed on
  (`NodeDefinition.layers`). See [ADR 0003](decisions/0003-c4-layer-system.md).

## Module map

| Path | Role |
|---|---|
| `src/types.ts` | The data model. Every shape above, plus `Layer`/`nextLayer`. |
| `src/store.ts` | Zustand store: all state + every mutation (place, wire, collapse/expand, undo, library adoption). The single source of truth. |
| `src/lib/graph.ts` | Pure geometry/validation: pip placement, wire bezier curves, `canConnect`. |
| `src/lib/defaultLibrary.ts` | `SEED_LIBRARY` — the built-in fallback definitions + pip types, organized by layer. |
| `src/lib/library.ts` | Loads/saves the *persisted* default library (per-machine file or `localStorage`). See [ADR 0004](decisions/0004-default-library-copy-on-use.md). |
| `src/lib/persist.ts` | `.glyph` project save/load, PNG export, and the migrations that keep old files loading (renamed fields, backfilled `layer`/`layers`). |
| `src/lib/icons.ts` | Lucide icon lookup + custom-uploaded-icon resolution. |
| `src/components/CanvasStage.tsx` | The Konva stage: pan/zoom, marquee select, wire-drag, boundary-drawing, placement ghost. |
| `src/components/NodeShape.tsx`, `BoundaryShape.tsx`, `PipShape.tsx`, `RelationshipShape.tsx` | Konva render + drag/click handlers for each primitive. |
| `src/components/LibraryPanel.tsx` | Left sidebar: the palette (filtered to the active canvas's layer), search, pip-type legend. |
| `src/components/DefinitionWizard.tsx` | Create/edit a definition: name, layers, icon, pips. |
| `src/components/BoundaryModal.tsx` | Name/icon dialog after drawing a new boundary box. |
| `src/components/NavTree.tsx`, `Breadcrumbs.tsx` | Canvas navigation — Explorer-style tree and the trail-of-crumbs + back button. |
| `src-tauri/` | The Rust shell: window config, filesystem/dialog plugin wiring. Thin — almost no app logic lives here. |

## Persistence

Two independent files, deliberately not merged:

1. **`.glyph`** (`ProjectFile` in `persist.ts`) — one project. UI-shaped:
   layout coordinates, viewports, the definitions and pip types this project
   actually uses (default-library entries not yet adopted are *not*
   written — see [ADR 0004](decisions/0004-default-library-copy-on-use.md)).
2. **The default library** (`library.ts`) — per-machine, shared across every
   project. Seeded from `SEED_LIBRARY` on first run; grows as the user
   promotes definitions into it.

Loading a `.glyph` file merges the current default library underneath the
file's own definitions, then backfills anything the file predates (the
`containers`→`boundaries` rename, missing `layer`/`layers`).

There is a third, not-yet-built export target — `architecture.json`, a
layout-free graph for Project Hephaestus to consume — specified in
`../HEPHAESTUS-INTEGRATION.md` and tracked in [ADR 0005](decisions/0005-defer-hephaestus-integration.md).

## Known rough edges

- The Konva canvas in the preview pane occasionally throws a harmless
  `drawImage ... width or height of 0` console error on first paint (a
  canvas-sizing timing artifact); it doesn't affect the real Tauri window.
- Pip types are written into every `.glyph` file in full, unlike node
  definitions — see the Consequences section of
  [ADR 0004](decisions/0004-default-library-copy-on-use.md).
- The Code layer (functions/classes/methods) is scaffolded in the default
  library but no project has exercised it yet.
