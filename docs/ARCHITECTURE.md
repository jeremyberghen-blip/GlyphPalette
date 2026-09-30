# Architecture

What Glyph Palette is made of, as of v1.1.0. For *why* things are shaped this
way, see [`decisions/`](decisions/); for what's next, see [`ROADMAP.md`](ROADMAP.md).

## Stack

Tauri v2 (Rust shell, native window, filesystem/dialog access) + React 19 +
TypeScript + Konva/react-konva (canvas rendering) + Zustand (state) + Vite.
Tests: Vitest (`npm test`).

## Core concepts

- **Node** ([`NodeInstance`](../src/types.ts)) — a placed instance on a
  canvas (`id`, `definitionId`, `x`, `y`). Everything about how it looks and
  what it can connect to comes from its **definition**
  ([`NodeDefinition`](../src/types.ts)): name, icon, `layers` (see below),
  and `pips`. A node's display name is its definition's name, so two
  distinct things on a canvas need two definitions (Duplicate / Permute /
  Ctrl+D make that cheap).
- **Pip** ([`PipDef`](../src/types.ts)) — a labeled, color-coded, typed,
  directional attachment point on a definition. Direction is
  `inbound | outbound | bidirectional | none`. Two pips can connect only if
  their `PipType` matches and their directions pair up
  (`outbound`↔`inbound`, `bidirectional`↔`bidirectional`, `none`↔`none`) —
  see `canConnect` in [`src/lib/graph.ts`](../src/lib/graph.ts). A
  `PipType` may carry a `layers` hint: the layers it's usual on, used only
  to order the wizard's type list ([`src/lib/pipTypes.ts`](../src/lib/pipTypes.ts)).
- **Relationship** ([`Relationship`](../src/types.ts)) — a wire between two
  pips, `from`/`to` normalized so `from` is the outbound side when
  directional. Optional `waypoints`: bend points, each a short straight
  section pivoting on its center (`angle`, `half`-length). With waypoints a
  wire is drawn as straight runs with rounded corners
  ([`src/lib/waypoints.ts`](../src/lib/waypoints.ts)). Bend points inside a
  collapsed boundary the wire crosses are kept in `foldedWaypoints` (keyed by
  the collapsed node) and restored on expand.
- **Boundary** ([`Boundary`](../src/types.ts)) — a resizable box that groups
  every node it overlaps. Collapsing one (`collapseBoundary` in
  [`src/store.ts`](../src/store.ts)) turns it into a single node: one
  inherited pip per distinct relationship that crossed the boundary, tracked
  in `pipMap` so expansion (`expandNode`) can rewire back to the specific
  inner node/pip it came from.
- **Canvas** ([`CanvasData`](../src/types.ts)) — a flat `nodes` +
  `relationships` + `boundaries` list. A definition may reference a canvas
  depicting its internals (`canvasId`); canvases are shared by reference, so
  two instances of the same definition show — and edit — the same interior.
  `enterDefinition` creates that inner canvas lazily, on first double-click.
- **Layer** (`Layer` in [`src/types.ts`](../src/types.ts)) — every canvas sits
  at one of `context < container < component` (C4's zoom levels; the old
  `code` layer is retired but still loads — [ADR 0007](decisions/0007-retire-code-layer-and-pockets.md)).
  A node's interior is one layer down, clamping at Component (Component
  nodes nest Component canvases). Every definition declares which layer(s)
  it may be placed on. See [ADR 0003](decisions/0003-c4-layer-system.md).
- **Pocket** — the inside of a collapsed boundary: a same-layer fold, not a
  deeper level. Identified by its owning definition's `expandable` flag
  ([`src/lib/layers.ts`](../src/lib/layers.ts)); hidden from the palette.
- **Standard library vs. project definitions** — the store's `definitions`
  map holds both. Standard ones ([`src/lib/standard.glyph`](../src/lib/standard.glyph),
  loaded by [`src/lib/standardLibrary.ts`](../src/lib/standardLibrary.ts))
  are read-only; everything else belongs to the project. See
  [ADR 0008](decisions/0008-project-owned-library.md).

## Module map

| Path | Role |
|---|---|
| `src/types.ts` | The data model. Every shape above, plus `Layer`, `DRAWABLE_LAYERS`, `nextLayer`. |
| `src/store.ts` | Zustand store: all project state + every mutation (place, wire, collapse/expand, duplicate, import, waypoints, undo) and save state (`filePath`, `savedRefs`). The single source of truth. |
| `src/lib/graph.ts` | Pure geometry/validation: pip placement, wire bezier curves, `canConnect`, group centering. |
| `src/lib/waypoints.ts` | Pure waypoint geometry: routing, insertion order, the rotation/length handle. |
| `src/lib/layers.ts` | Canvas ↔ layer rules: owners, pockets, child layers, pocket-layer repair. |
| `src/lib/layerStyle.ts` | Layer colors and labels used across the UI. |
| `src/lib/definitions.ts` | Definition helpers: numbered names, copying, "same definition" comparison. |
| `src/lib/pipTypes.ts` | Soft pip-type affinity: grouping and default type for a definition's layers. |
| `src/lib/standard.glyph`, `standardLibrary.ts` | The read-only standard library. |
| `src/lib/projectFile.ts` | The `.glyph` format: build, parse, and upgrade older files (pure). |
| `src/lib/importDefs.ts` | Importing definitions from another project: candidates and conflict handling (pure). |
| `src/lib/persist.ts` | Filesystem side of projects: dialogs, reading/writing `.glyph`, PNG export. |
| `src/lib/fileActions.ts` | File operations as the UI runs them: pop-ups, Save / Don't save / Cancel. |
| `src/lib/session.ts` | Save-state logic: dirty check, autosave timing, titles (pure). |
| `src/lib/settings.ts` | Per-machine settings (autosave interval). |
| `src/lib/toast.ts` | Pop-up message store. |
| `src/lib/icons.ts` | Lucide icon lookup + custom-uploaded-icon resolution. |
| `src/components/CanvasStage.tsx` | The Konva stage: pan/zoom, marquee select, wire-drag, boundary drawing, placement ghost, drag-to-place drop target. |
| `src/components/NodeShape.tsx`, `BoundaryShape.tsx`, `PipShape.tsx`, `RelationshipShape.tsx`, `WaypointHandles.tsx`, `NodeNameTooltip.tsx` | Konva render + drag/click handlers for each primitive. |
| `src/components/LibraryPanel.tsx` | Left sidebar: the palette (this project's nodes, then standard ones, filtered to the active layer), Duplicate/Permute/import, pip-type legend. |
| `src/components/DefinitionWizard.tsx` | Create / edit / permute a definition: name, layers, icon, pips. |
| `src/components/ImportDialog.tsx` | Choose definitions to import from another project. |
| `src/components/NavTree.tsx`, `Breadcrumbs.tsx` | Canvas navigation — Explorer-style tree and the trail-of-crumbs + back button, both showing layers. |
| `src/components/Toasts.tsx`, `UnsavedPrompt.tsx`, `SettingsDialog.tsx`, `BoundaryModal.tsx` | Pop-ups and dialogs. |
| `src-tauri/` | The Rust shell: window config, filesystem/dialog plugin wiring, capabilities. Thin — almost no app logic lives here. |

## Persistence

1. **`.glyph`** (`ProjectFile` in `projectFile.ts`) — one project. UI-shaped:
   layout coordinates, the project's own definitions and pip types, custom
   icons, and `standardInteriors` (interiors drawn inside standard nodes).
   Standard-library content is never written; it's merged back in on load.
   Loading also upgrades older files: the `containers`→`boundaries` rename,
   missing `layer`/`layers`, pocket layers, and v1.0's copied seeds (folded
   back into the standard nodes, or re-id'd if edited).
2. **Settings** (`settings.ts`) — per machine:
   `%APPDATA%\com.heroo.glyph-palette\glyph-palette\settings.json` in Tauri,
   `localStorage` in the browser preview.

v1.0's per-machine default library (`glyph-palette\library.json` in the same
folder) is no longer read; an existing one is left on disk unused.

There is a third, not-yet-built export target — `architecture.json`, a
layout-free graph for Project Hephaestus to consume — specified in
`../HEPHAESTUS-INTEGRATION.md` and tracked in [ADR 0005](decisions/0005-defer-hephaestus-integration.md).

## Testing

`npm test` runs the Vitest suite; `npm run build` type-checks and bundles
(the smoke test's other half). Logic lives in `src/lib/*` and the store and
is unit-tested there; `src/test/fixtures/Snip.glyph` is a real v1.0 project
kept as a regression fixture for file upgrades. Canvas rendering and
interaction are tested by hand.

## Known rough edges

- The Konva canvas in the preview pane occasionally throws a harmless
  `drawImage ... width or height of 0` console error on first paint (a
  canvas-sizing timing artifact); it doesn't affect the real Tauri window.
  On the Backlog.
- Deleting or retyping a pip still drops the wires attached to it, silently.
  The v1.2 port-node design replaces this with broken-but-kept wires.
