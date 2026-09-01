# Changelog

Format loosely follows [Keep a Changelog](https://keepachangelog.com/).
Versions before 1.0.0 predate git and are reconstructed from session memory
rather than diffs — see [ADR 0006](decisions/0006-versioning-and-git.md).

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
