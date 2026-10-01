# Changelog

Format loosely follows [Keep a Changelog](https://keepachangelog.com/).
Versions before 1.0.0 predate git and are reconstructed from session memory
rather than diffs — see [ADR 0006](decisions/0006-versioning-and-git.md).

## [1.2.1] — 2026-09-30

Fixes from hand-testing 1.2.0.

### Fixed
- A deleted pip stayed (red) on a node after that node's wire was removed,
  when another copy of the node elsewhere still had a wire on it. A deleted
  pip is now drawn only on the copies that still have a wire on it; it
  leaves the definition once the last wire anywhere is gone.

### Changed
- Pips and wires are 50% wider, and the style color has a black outline so
  it reads clearly against the transport color.

## [1.2.0] — 2026-09-30

Ports and connections.

### Added
- **Two-part connection types** ([ADR 0009](decisions/0009-two-part-connection-types.md)):
  every pip and wire has a transport (HTTP, HTTP/2, WebSocket, TCP, message
  queue, filesystem, in-process) and an API style (REST/JSON, GraphQL,
  SOAP/XML, web pages, gRPC, SQL, key-value, event, call, import, or "any"
  for pass-through). Transports must match; styles match or either is "any".
- Pips draw as a transport ring with a style center; wires as a transport
  line with a style core half as thick. Two legends: transports and styles.
- The node dialog has Transport and Style pickers per pip, ordered by the
  node's layers and the chosen transport; "+ New transport" / "+ New style".
- **Port nodes** ([ADR 0010](decisions/0010-port-nodes-and-broken-links.md)):
  Inbound and Outbound in a new Ports section of the palette on any inner
  canvas, carrying the pips of the node you're inside. One of each per
  canvas. Inside a collapsed group, they show the collapse's connections
  automatically (dashed, locked).
- **Broken-but-kept links:** deleting or retyping a pip keeps its wires,
  drawn red with an explanation on hover, until you remove them.

### Changed
- The standard library's pips use specific styles where the node implies
  one (Cache → TCP / Key-value, Web App's input → HTTP / Web pages).
- Project files are format version 2. Older files upgrade automatically;
  files saved by 1.2 can't be read by 1.1.
- Wires are slightly thicker so their core shows.
- Wires redraw when either end's definition changes (editing a pip's side
  updates its wires).

### Removed
- Deleting a pip no longer deletes its wires silently.

## [1.1.1] — 2026-09-30

Fixes from hand-testing 1.1.0.

### Fixed
- Wire corners shot off across the canvas when a bend point's section was
  rotated so the wire doubled back on itself; tight turns now stay tight.
- The window's close button did nothing (no prompt, no close): a
  development-mode double registration left a stale close handler. Close
  failures are now reported instead of swallowed.
- Collapsing a boundary threw away the bend points of wires crossing it
  that sat inside the box. They're now folded away with the box and
  restored on expand, following the nodes if the collapsed node was moved,
  including boxes collapsed inside boxes.
- Dragging palette cards onto the canvas showed a "not allowed" cursor in
  the desktop app on Windows: Tauri's native file-drop handling was
  intercepting in-page drags. It's turned off (`dragDropEnabled: false`);
  GP doesn't take files dropped from Explorer.

### Changed
- The top-bar shortcut hint mentions Del (delete from canvas).

## [1.1.0] — 2026-09-29

Foundation, polish, and library — the fixes and ideas from the Snip test
run (a URL shortener drawn from Context down to Code).

### Added
- **Tests:** Vitest (`npm test`) with smoke tests, unit tests for all
  logic modules, and `src/test/fixtures/Snip.glyph` as a real-project
  regression fixture.
- **Standard library + project-owned library** ([ADR 0008](decisions/0008-project-owned-library.md)):
  a read-only standard library is always present; each project owns its
  other definitions. The palette lists "This project" then "Standard".
- **Import nodes from another project** (palette header): pick
  definitions by layer; clashes get the source project's name appended,
  e.g. `Links DB (Snip)`; interiors come across empty.
- **Duplicate** (a numbered copy, e.g. `Link Service 2`), **Permute** (the
  node dialog pre-filled from a node, name blank), and **Ctrl+D** (duplicate
  the selected nodes' definitions and place the copies at the cursor, wires
  included). Copies start with an empty interior.
- **Wire bend points:** double-click a wire to add one; drag to move; select
  one to show a rotation/length handle; Delete removes it. Wires with bend
  points draw as straight runs with rounded corners.
- **Save feedback:** a center pop-up on save / open / export / import;
  errors in red that stay until dismissed.
- **Project name and unsaved marker** in the top bar and window title.
- **Unsaved-changes prompt** (Save / Don't save / Cancel) on New, Open, and
  closing the window — only when there are unsaved changes.
- **Autosave** into the project's file on a configurable interval (Never,
  1, 2, 5, 10, 15 min; default 5), with a quiet corner note.
- **Settings dialog** (gear, top right), stored per machine.
- **Full-name tooltip** on nodes whose name is truncated (after 0.4s).
- **Drag palette cards onto the canvas** to place them.
- **Layer colors** in the palette header, breadcrumb tags, and navigator
  dots.
- **Soft pip-type affinity:** the pip-type list shows the types usual for a
  definition's layers first; new pips default to the most layer-specific
  one (HTTP on Containers, Call on Components); custom types get layer
  toggles.

### Changed
- **The Code layer is retired** ([ADR 0007](decisions/0007-retire-code-layer-and-pockets.md)):
  no longer offered for new work; Component is the deepest layer and
  Component nodes nest Component canvases. Old Code canvases still load and
  stay editable. Code seeds left the library.
- **Collapsed boundaries are pockets:** same-layer folds, hidden from the
  palette and labeled as collapsed groups.
- A new project's System node is the project's own "My System", so it can
  be renamed and given pips.
- The standard API Service's REST/JSON inbound pip is labeled "API" (was
  the misleading "HTTP").
- Call is listed before Import among pip types.
- Older files upgrade on open: unedited copies of seeds fold back into the
  standard nodes; edited ones get new ids so the standard node is available
  alongside.

### Removed
- The per-machine default library, copy-on-use adoption, and "save to
  default library" (superseded by ADR 0008). An existing `library.json` is
  left on disk, unused.

### Fixed
- **New didn't forget the previous file**, so the next Ctrl+S silently
  overwrote the previously opened project.
- **Save failures were silent**; they now show an error.
- Collapsing a boundary gave its inside the next layer down (Snip's
  Analytics group read as Component); files saved that way are repaired on
  open.

## [1.0.0] — 2026-09-01

First versioned, git-tracked release. Represents everything built across the
initial design-and-build arc (2026-08-09 through 2026-08-30) plus the
versioning work itself.

### Added
- Core model: nodes with library-backed definitions; typed, directional pips
  with connect validation; relationships; resizable boundary boxes with
  collapse-to-node/expand.
- Nested canvases shared by reference, with Explorer-style nav tree and
  breadcrumb trail navigation.
- Definition library + wizard (name, icon incl. custom uploads, pips).
- Persistence: `.glyph` project save/load, undo (50-deep), copy/paste,
  PNG export.
- C4 layer system: `Layer` on every canvas, `layers` on every definition,
  palette filtered to the active layer, layer picker in the wizard.
- Context-layer project seed — a fresh project opens as a System Context
  diagram with one `System` node to decompose.
- Per-machine default library (`%APPDATA%\glyph-palette\library.json` /
  `localStorage`), seeded with ~25 definitions across all four layers and
  10 pip types; copy-on-use adoption into projects; "save to default
  library" promotion.
- `launch.bat` dev launcher + desktop shortcut.
- This documentation: `ARCHITECTURE.md`, `ROADMAP.md`, `decisions/`.

### Changed
- Renamed `Container`/`ContainerData` → `Boundary` throughout, freeing
  "Container" for its C4 meaning (see
  [ADR 0002](decisions/0002-container-to-boundary-rename.md)).
- Version set to `1.0.0` across `package.json`, `Cargo.toml`, and
  `tauri.conf.json` (previously the Tauri template default `0.1.0`).

### Fixed
- `launch.bat` parse error (unescaped parentheses inside `if (...)` blocks)
  that caused the launcher window to flash and close instantly; rewritten
  with `goto`-based error handling.
