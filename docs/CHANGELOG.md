# Changelog

Format loosely follows [Keep a Changelog](https://keepachangelog.com/).
Versions before 1.0.0 predate git and are reconstructed from session memory
rather than diffs — see [ADR 0006](decisions/0006-versioning-and-git.md).

## [Unreleased]

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
