# Glyph Palette

A desktop tool for drawing a system's architecture as a C4-style recursive
decomposition — Context → Container → Component — with typed,
directional connections between nodes, a reusable definition library, and a
project file you can version and share. Each node also records what it's
for, what it builds as (folder or file, language, or external) and where;
**Publish** hands the design to an AI code generator as `architecture.json`.

Built with Tauri v2 + React + TypeScript + Konva + Zustand.

## Running it

There are two ways to run GP ([ADR 0012](docs/decisions/0012-installed-app-and-dev-copy.md)):

- **Glyph Palette — the installed app**, for everyday use. Build the
  installer with `npm run tauri build` (from `master`); it lands at
  `src-tauri/target/release/bundle/nsis/Glyph Palette_<version>_x64-setup.exe`.
  It's unsigned, so Windows asks to "Run anyway" the first time.
- **GP Dev Mode — the work copy**, for building and testing new features:
  [`launch-dev.bat`](launch-dev.bat) (or the **GP Dev Mode** desktop
  shortcut) runs whichever copy it sits in, in dev mode with hot-reload, on
  port 1440 — alongside the installed app, with its own settings. It shows
  a DEV badge. [`launch.bat`](launch.bat) does the same for this copy on
  port 1420 without the separate identity.

Both launchers check for Node.js and the Rust toolchain and install npm
dependencies on first run. A copy's first launch compiles the Rust side
and can take a few minutes; later launches are fast.

Manually: `npm install`, then `npm run tauri dev` (or
`npm run tauri dev -- --config src-tauri/tauri.devmode.conf.json` for the
dev identity).

Tests: `npm test` (Vitest); `npm run build` type-checks and bundles.

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — the data model, module
  map, and persistence design.
- [`docs/GLYPH-FORMAT.md`](docs/GLYPH-FORMAT.md) — how to write a `.glyph`
  project file by hand or from a script (standard library ids, rules, a
  validator, a Python builder) without reading the app.
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — planned and unscheduled future work.
- [`docs/DECISIONS.md`](docs/DECISIONS.md) — ideas under discussion
  (Open), approved but not yet built (Decided), and concluded notes
  (Record).
- [`docs/decisions/`](docs/decisions/) — architecture decision records: why
  things are shaped the way they are, once decided.
- [`docs/CHANGELOG.md`](docs/CHANGELOG.md) — version history.
- [`HEPHAESTUS-INTEGRATION.md`](HEPHAESTUS-INTEGRATION.md) — the design for
  exporting a Glyph Palette project to Project Hephaestus, an AI
  code-generation pipeline, and the goal behind it: you decide the shape and
  architecture, the AI brings its judgement to the rest. Publish shipped in
  v1.5 ([ADR 0013](docs/decisions/0013-publish-architecture-json.md)).

## Recommended IDE setup

[VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
