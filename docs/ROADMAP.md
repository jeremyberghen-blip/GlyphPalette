# Roadmap

What v1.0.0 is, and where things go from here. Nothing below is a commitment
to build it, let alone on the version it's slated to — it's a place to put
plans so they don't only live in conversation. Move items between versions,
into Backlog, or out entirely as things change; that's the point of writing
it down instead of remembering it.

Versions are themed releases, not one-feature-per-version: each bundles
related work, and the SemVer bump reflects the most significant change in
it (see [ADR 0006](decisions/0006-versioning-and-git.md)). Sequence
re-planned 2026-09-29 after the Snip test run; the reasoning and design
detail for each item is in [`DECISIONS.md`](DECISIONS.md) under **Decided**.

## v1.0.0 — current

The full node/boundary/relationship model, a C4 layer system (Context →
Container → Component → Code) with per-layer palette filtering, a
per-machine default library with copy-on-use adoption into projects,
persistence (`.glyph` save/load, undo, copy/paste, PNG export), and a dev
launcher. See [`ARCHITECTURE.md`](ARCHITECTURE.md) for the full shape and
[`decisions/`](decisions/) for how it got here.

## v1.1 — planned: foundation, polish, library

Do first:
- **Test harness.** GP has no tests yet. Add Vitest, a smoke test (the app's
  store initializes, a project serializes and reloads), and unit tests for
  the existing pure logic (`canConnect`, `persist.ts` migrations). Every
  later item's logic gets its tests in the same pass.

Then, in any order:
- **Retire the Code layer from the UI.** Hephaestus owns function-level
  structure. Component becomes the deepest drawable layer; Code seeds leave
  the default library; files with Code canvases still load.
- **Pockets:** a collapsed boundary's interior is a same-layer fold, not a
  deeper level — fixes collapse assigning it the next layer down (with
  on-load repair), labels pockets as collapsed groups, and hides collapsed
  groups from the palette.
- **Duplicate and Permute** for definitions (duplicate with an incremented
  name; new definition pre-filled from an existing one).
- **Library married to the project:** each project owns its library; a
  read-only standard library is always present; import definitions from
  another `.glyph`. Retires the per-machine default library.
- **Edge waypoints:** double-click a wire to add a bend point.
- **Soft pip-type layer affinity:** the definition wizard defaults to and
  lists first the pip types usual for the definition's layer, but never
  hides the others.
- **Save feedback and autosave:** center popup on save, persistent error
  popups, project name + unsaved marker, dirty-only warnings on New / Open
  / window close, autosave on a configurable interval, and a Settings
  dialog. Fixes New not clearing the remembered save path.
- **Full-name tooltip on nodes** (long names are truncated); a natural place
  to also show pip label + type.
- **Drag-to-place from the palette**, alongside click-then-click placement.
- **Relabel the seed API Service pip** labeled "HTTP" but typed REST/JSON.
- Show the active layer in the breadcrumb trail and nav tree.
- Chase down the harmless Konva `drawImage` console warning (see
  `ARCHITECTURE.md` § Known rough edges).

## v1.2 — planned: port nodes and connection rules

- **Inbound / Outbound port nodes** on every inner canvas, generated from
  the parent definition's pips; broken-pip and broken-wire marking when the
  parent changes. Old files get ports on load.
- Pocket variant of the port rules: a pocket's ports derive bottom-up
  from the wires that crossed the boundary, not from a parent definition.
- **HTTP ↔ REST/JSON compatibility:** pip-type compatibility so a subtype
  (REST/JSON) can connect to its parent protocol (HTTP).

## v1.3 — planned: Hephaestus Tier 1

From `HEPHAESTUS-INTEGRATION.md`'s tiered plan, the changes required before
GP can export anything Hephaestus can consume:

- `slug` on `NodeDefinition` (filesystem-safe name, editable, defaults from
  `name`).
- `external: boolean` on `NodeDefinition` (drawn for context, never built).
- Node `kind` (`external` / `dir` / `file`), mostly derived; `language` on
  file-kind definitions; per-node `path` override for non-1:1 node↔file
  mappings.

## v1.4 — planned: Hephaestus Tier 2

- Edge `kind` (`transport | import | call`) on `PipType`, inherited by a
  relationship from its pip type.
- Interface names (symbol labels) carried on `import`/`call` edges.
- **Richer Component-layer definitions** to replace the undrawn Code layer:
  a free-text responsibility/notes field and key exported symbols as text.
- The `architecture.json` export itself: flat node list + flat edge list,
  `parent` pointers reconstructing the tree, per `HEPHAESTUS-INTEGRATION.md`.
  Pockets are flattened away: their contents belong to the pocket's parent.

## v2.0 — future: first real slice

- Draw and export the concrete first slice specified in
  `HEPHAESTUS-INTEGRATION.md` (`API Gateway` → `auth`/`tokens`/`router` files,
  one `Database` external node, one `transport` edge).
- Hand `architecture.json` back to Hephaestus; revise the export format based
  on what the diagram couldn't express. Widen from there.
- Revisit [ADR 0004](decisions/0004-default-library-copy-on-use.md)'s pip-type
  write-everything behavior once a real cross-project workflow exists to
  stress it.

## v2.1 — tentative: in-app AI chat

A chat window for discussing the open project with an AI. Tentative and
liable to be pushed back: everything functional comes before bells and
whistles. Not yet designed — see [`DECISIONS.md`](DECISIONS.md) § Open.

## Backlog — unscheduled

Real ideas, not currently slated to a version:

- **Duplicate with contents:** Duplicate / Permute / Ctrl+D copying the
  base's inner canvas (deep copy, nested definitions included) instead of
  starting empty.
- **Delete in-use definitions** — stubbed; see [`DECISIONS.md`](DECISIONS.md).
- **Import with contents** (bring a definition's interior along).
- **Right-click menus** — deliberately deferred until use reveals where
  they're wanted.
- **Installable release build** (`npm run tauri build` → Windows installers).
  Already configured and cheap; deliberately not before v2.0.
- Whether the Context-layer seeds (`System`, `Person`) should ship with
  generic pips — see [`DECISIONS.md`](DECISIONS.md) § Open.
- Persistent user library promotion UI beyond the single "save to default
  library" button (browsing/editing the library outside a project context).
- In-GP lint: buildable node with no path, import cycle, a buildable subtree
  reachable by two instance paths (see `HEPHAESTUS-INTEGRATION.md`'s edge
  cases), and unwired port pips once v1.2 lands.
- Cross-language seams: a `kind: "wire"` edge for e.g. a Python service ↔ TS
  frontend boundary, where the contract is a wire format rather than a
  hand-drawn interface.
- Cosmetic: the npm package (`glyph-scaffold`) and Cargo crate
  (`glyph_scaffold_lib`) still carry the Tauri template's scaffold name
  rather than `glyph-palette`. Renaming the Cargo side touches the binary
  name and crate references in `src-tauri/src/`; low priority, do it in a
  quiet moment rather than alongside a feature change.

Dropped: *`call` edges within a file — verbatim stub structure or hints?*
Moot since 2026-09-29: GP no longer draws inside files; Hephaestus owns
that level.
