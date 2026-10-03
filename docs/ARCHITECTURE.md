# Architecture

What Glyph Palette is made of, as of v1.2.0. For *why* things are shaped this
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
  Ctrl+D make that cheap). A node may carry a `pathOverride` (below).
- **Build facts** — every definition also has a `slug` (snake_case,
  derived from the name unless typed), `external`, `kind` (folder or file)
  and `language` (inherited when absent); naming rules in
  [`src/lib/naming.ts`](../src/lib/naming.ts). See
  [ADR 0011](decisions/0011-build-facts-and-paths.md).
- **Connection kind** — what a wire means for the export: `transport`,
  `import`, or `call`, from its style (`edgeKind` in
  [`src/lib/connections.ts`](../src/lib/connections.ts); styles may carry
  `kind`). Definitions also carry an optional `description` and
  `constraints` (ADR 0013).
- **Build plan** — where each placed node builds, derived on demand by
  `buildPlan` in [`src/lib/paths.ts`](../src/lib/paths.ts) and never stored:
  one *placement* per route from the top canvas (a node inside a shared
  interior has several), each with its status (external, folder drawn /
  decided by the AI, file, sketch), effective language, and path under the
  project folder. A node's `pathOverride` replaces its derived path, and its
  children build on it.
- **Pip** ([`PipDef`](../src/types.ts)) — a labeled, directional attachment
  point on a definition with a two-part connection type: a **transport**
  ([`Transport`](../src/types.ts): HTTP, TCP, message queue…) and an **API
  style** ([`ApiStyle`](../src/types.ts): REST/JSON, SQL, event…, or "any"
  for pass-through). Direction is `inbound | outbound | bidirectional |
  none`. Two pips connect when transports match, styles match or either is
  "any", and directions pair up (`outbound`↔`inbound`,
  `bidirectional`↔`bidirectional`, `none`↔`none`) — `canConnect` in
  [`src/lib/graph.ts`](../src/lib/graph.ts), rules in
  [`src/lib/connections.ts`](../src/lib/connections.ts). Transports carry a
  `layers` hint and styles a `transports` hint, used only to order the
  wizard's pickers. See [ADR 0009](decisions/0009-two-part-connection-types.md).
  A pip deleted while wired stays as `removed` until its last wire goes.
- **Relationship** ([`Relationship`](../src/types.ts)) — a wire between two
  pips, `from`/`to` normalized so `from` is the outbound side when
  directional. It records the connection type it was drawn with
  (`transportId`/`styleId`, the more specific style); if an end pip is
  deleted or retyped so it no longer matches, the wire is **broken** — drawn
  red, kept until removed ([`src/lib/broken.ts`](../src/lib/broken.ts),
  [ADR 0010](decisions/0010-port-nodes-and-broken-links.md)). Optional `waypoints`: bend points, each a short straight
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
- **Port node** — Inbound / Outbound, placed from the palette on an inner
  canvas (one of each, never the top level). Stored as a node with a reserved
  definition id (`@port-in` / `@port-out`); its pips are the parent's,
  flipped, worked out live ([`src/lib/ports.ts`](../src/lib/ports.ts)). Every
  lookup of a node's definition goes through `resolveDef` / `useNodeDef`. In a
  pocket, ports also show the collapse's recorded connections, dashed and
  locked. See [ADR 0010](decisions/0010-port-nodes-and-broken-links.md).
- **Standard library vs. project definitions** — the store's `definitions`
  map holds both. Standard ones ([`src/lib/standard.glyph`](../src/lib/standard.glyph),
  loaded by [`src/lib/standardLibrary.ts`](../src/lib/standardLibrary.ts))
  are read-only; everything else belongs to the project. See
  [ADR 0008](decisions/0008-project-owned-library.md).

## Module map

| Path | Role |
|---|---|
| `src/types.ts` | The data model. Every shape above, plus `Layer`, `DRAWABLE_LAYERS`, `nextLayer`, `ANY_STYLE`. |
| `src/store.ts` | Zustand store: all project state + every mutation (place, wire, collapse/expand, duplicate, import, waypoints, undo) and save state (`filePath`, `savedRefs`). The single source of truth. |
| `src/lib/graph.ts` | Pure geometry/validation: pip placement, wire bezier curves, `canConnect`, group centering. |
| `src/lib/waypoints.ts` | Pure waypoint geometry: routing, insertion order, the rotation/length handle. |
| `src/lib/layers.ts` | Canvas ↔ layer rules: owners, pockets, child layers, pocket-layer repair. |
| `src/lib/layerStyle.ts` | Layer colors and labels used across the UI. |
| `src/lib/naming.ts` | Slugs and per-language file/folder naming conventions (pure). |
| `src/lib/paths.ts` | The build plan: every placement's status, language, and path; overrides, clashes, reuse (pure). |
| `src/lib/definitions.ts` | Definition helpers: numbered names, copying, "same definition" comparison. |
| `src/lib/connections.ts` | Two-part connection rules: compatibility, a wire's type, labels, and the wizard's picker ordering/defaults. |
| `src/lib/legacyTypes.ts` | Upgrading v1 files' flat pip types to transport + style. |
| `src/lib/broken.ts` | Broken links: when pips/wires are broken and why; keeping and pruning deleted-but-wired pips. |
| `src/lib/ports.ts` | Port nodes: their pips, resolving node definitions on a canvas, placement rules, a pocket's locked wires. |
| `src/lib/standard.glyph`, `standardLibrary.ts` | The read-only standard library. |
| `src/lib/projectFile.ts` | The `.glyph` format: build, parse, and upgrade older files (pure). |
| `src/lib/importDefs.ts` | Importing definitions from another project: candidates and conflict handling (pure). |
| `src/lib/persist.ts` | Filesystem side of projects: dialogs, reading/writing `.glyph`, PNG export. |
| `src/lib/fileActions.ts` | File operations as the UI runs them: pop-ups, Save / Don't save / Cancel. |
| `src/lib/session.ts` | Save-state logic: dirty check (project name included), autosave timing, window title, suggested file name (pure). |
| `src/lib/settings.ts` | Per-machine settings (autosave interval, the project to reopen on startup). |
| `src/lib/env.ts` | Where GP is running: Tauri or the browser; a dev build (GP Dev Mode) or the installed app. |
| `src/lib/architecture.ts` | Publish: the project as `architecture.json` for Hephaestus — nodes per placement, wires as drawn, warnings (pure; ADR 0013). |
| `src/lib/grid.ts` | The canvas grid: one tileable SVG image as a CSS background, sized and offset to the viewport (pure). |
| `src/lib/pips.ts` | Pips as the dialogs show them: sections by direction, a new pip's default side (pure). |
| `src/lib/toast.ts` | Pop-up message store. |
| `src/lib/icons.ts` | Lucide icon lookup + custom-uploaded-icon resolution. |
| `src/components/CanvasStage.tsx` | The Konva stage (one layer, "content", over the CSS grid background): pan/zoom, marquee select, wire-drag, boundary drawing, placement ghost, drag-to-place drop target. |
| `src/components/NodeShape.tsx`, `BoundaryShape.tsx`, `PipShape.tsx`, `RelationshipShape.tsx`, `WaypointHandles.tsx` | Konva render + drag/click handlers for each primitive. |
| `src/components/InfoCard.tsx` | The hover cards on palette cards and placed nodes (HTML over the canvas). |
| `src/components/ContextMenu.tsx`, `nodeMenu.ts` | The right-click menu, and what a placed node's menu offers. |
| `src/components/PathOverrideDialog.tsx` | Override path…: the automatic path, the typed one, and a preview. |
| `src/components/ProjectTitle.tsx`, `ProjectNamePrompt.tsx` | The project name in the top bar (click to rename) and New's name prompt. |
| `src/components/LibraryPanel.tsx` | Left sidebar: the palette (this project's nodes, then standard ones, filtered to the active layer), Ports section, Duplicate/Permute/import, right-click menus, the Legend icon. |
| `src/components/PipFields.tsx` | One pip's fields (label, transport, style, direction, side), as a dialog row or a small form; inline custom transports/styles. |
| `src/components/PublishSummary.tsx` | After Publish: where the file went, counts, and warnings. |
| `src/components/AddPipDialog.tsx` | Add pip… from a node's right-click menu. |
| `src/components/LegendButton.tsx` | The legend (`LegendPanel`), shown on hovering the palette's foot and beside the node and Add pip dialogs. |
| `src/components/DefinitionWizard.tsx` | Create / edit / permute a definition: name, slug, Builds as + language, layers, icon, pips grouped by direction. Its open state is a small store so palette cards and canvas menus can open it (including Permute-in-place for a node). |
| `src/components/ImportDialog.tsx` | Choose definitions to import from another project. |
| `src/components/NavTree.tsx`, `Breadcrumbs.tsx` | Canvas navigation — Explorer-style tree and the trail-of-crumbs + back button, both showing layers. |
| `src/components/Toasts.tsx`, `UnsavedPrompt.tsx`, `SettingsDialog.tsx`, `BoundaryModal.tsx` | Pop-ups and dialogs. |
| `src-tauri/` | The Rust shell: window config, filesystem/dialog plugin wiring, capabilities. Thin — almost no app logic lives here. |

## Persistence

1. **`.glyph`** (`ProjectFile` in `projectFile.ts`) — one project. UI-shaped:
   format version 2: the project's `name`, layout coordinates, the project's
   own definitions, transports, and styles, custom icons, and
   `standardInteriors` (interiors drawn inside standard nodes).
   Standard-library content is never written; it's merged back in on load.
   To write one by hand or from a script, see [`GLYPH-FORMAT.md`](GLYPH-FORMAT.md).
   Loading also upgrades older files: the `containers`→`boundaries` rename,
   missing `layer`/`layers`, pocket layers, v1.0's copied seeds (folded
   back into the standard nodes, or re-id'd if edited), and version 1's flat
   pip types (→ transport + style, ADR 0009). Upgrading is one-way: v1.1
   can't read version 2 files. Files from before v1.3 have no `name`; they
   take it from the file name.
2. **Settings** (`settings.ts`) — per machine:
   `%APPDATA%\com.heroo.glyph-palette\glyph-palette\settings.json` in Tauri
   (GP Dev Mode: `com.heroo.glyph-palette.dev`), `localStorage` in the
   browser preview. Holds the autosave interval and the path of the project
   to reopen on startup.

v1.0's per-machine default library (`glyph-palette\library.json` in the same
folder) is no longer read; an existing one is left on disk unused.

A third file is written but never read: **`architecture.json`**, from the
top bar's Publish — a layout-free graph for Project Hephaestus
(`lib/architecture.ts`; format and reasoning in [ADR 0013](decisions/0013-publish-architecture-json.md),
the goal in `../HEPHAESTUS-INTEGRATION.md`).

## Builds and copies

The installed app is a release build of `master` (`npm run tauri build` →
NSIS `setup.exe`; `bundle.targets` is `["nsis"]`). The work copy runs in
dev mode as GP Dev Mode: `launch-dev.bat` passes
`src-tauri/tauri.devmode.conf.json`, which changes the port (1440), the app
identifier (`com.heroo.glyph-palette.dev`), and the window title. `env.ts`'s
`IS_DEV_BUILD` (Vite's dev flag) drives the DEV badge and title. Tailwind
scans only `src/` (`App.css`), so editing anything else never reloads a
running dev copy. See [ADR 0012](decisions/0012-installed-app-and-dev-copy.md).

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
