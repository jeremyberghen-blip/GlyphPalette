# Glyph Palette

A desktop tool for drawing a system's architecture as a C4-style recursive
decomposition — Context → Container → Component → Code — with typed,
directional connections between nodes, a reusable definition library, and a
project file you can version and share.

Built with Tauri v2 + React + TypeScript + Konva + Zustand.

## Running it

Double-click the **Glyph Palette** desktop shortcut, or run
[`launch.bat`](launch.bat) directly. It checks for Node.js and the Rust
toolchain, installs npm dependencies on first run, and starts the app in dev
mode (hot-reload). The first launch recompiles the Rust side and can take a
few minutes; later launches are fast.

Manually: `npm install`, then `npm run tauri dev`.

Tests: `npm test` (Vitest); `npm run build` type-checks and bundles.

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — the data model, module
  map, and persistence design.
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — planned and unscheduled future work.
- [`docs/DECISIONS.md`](docs/DECISIONS.md) — ideas under discussion
  (Open), approved but not yet built (Decided), and concluded notes
  (Record).
- [`docs/decisions/`](docs/decisions/) — architecture decision records: why
  things are shaped the way they are, once decided.
- [`docs/CHANGELOG.md`](docs/CHANGELOG.md) — version history.
- [`HEPHAESTUS-INTEGRATION.md`](HEPHAESTUS-INTEGRATION.md) — the design for
  exporting a Glyph Palette project to Project Hephaestus, an AI
  code-generation pipeline. Currently deferred; see
  [ADR 0005](docs/decisions/0005-defer-hephaestus-integration.md).

## Recommended IDE setup

[VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
