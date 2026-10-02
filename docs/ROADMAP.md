# Roadmap

What v1.4.0 is, and where things go from here. Nothing below is a commitment
to build it, let alone on the version it's slated to — it's a place to put
plans so they don't only live in conversation. Move items between versions,
into Backlog, or out entirely as things change; that's the point of writing
it down instead of remembering it.

Versions are themed releases, not one-feature-per-version: each bundles
related work, and the SemVer bump reflects the most significant change in
it (see [ADR 0006](decisions/0006-versioning-and-git.md)). Sequence
re-planned 2026-09-29 after the Snip test run; the reasoning and design
detail for each item is in [`DECISIONS.md`](DECISIONS.md) under **Decided**.

## v1.4 — current: 1.4.1 (2026-10-02)

A stable app to work in and a dev copy to build in ([ADR 0012](decisions/0012-installed-app-and-dev-copy.md)):
an installable build of `master`, GP Dev Mode for the work copy, reopening
the last project on startup, and Tailwind scoped to `src/`. Plus palette
polish from updating Snip: the legend on demand, pips grouped by
direction, Add pip… and Permute… on the node menu, and one Builds-as
choice. Full list in [`CHANGELOG.md`](CHANGELOG.md) § 1.4.0. 1.4.1 replaced
the canvas's dot grid (thousands of objects zoomed out, which bogged GP
down) with one repeating grid image, and keeps the legend beside the node
and Add pip dialogs.

## v1.3 — 1.3.0 (2026-10-01)

Hephaestus groundwork ([ADR 0011](decisions/0011-build-facts-and-paths.md)):
definition facts (slug, External, Folder/File, inherited Language with
per-language naming), derived build paths with a named project folder and
per-node overrides, hover cards on palette cards and placed nodes, and the
first right-click menus. Full list in [`CHANGELOG.md`](CHANGELOG.md) § 1.3.0.

## v1.2 — 1.2.1 (2026-09-30)

Ports and connections: two-part connection types (transport + API style,
drawn as line + core; ADR 0009), broken-but-kept links everywhere, and
Inbound / Outbound port nodes including the pocket variant (ADR 0010). Full
list in [`CHANGELOG.md`](CHANGELOG.md) § 1.2.0.

## v1.1 — 1.1.1 (2026-09-30)

Foundation, polish, and library, built from the Snip test run: a Vitest
suite with a real-project regression fixture; the Code layer retired
(Hephaestus owns it) and collapsed boundaries as same-layer pockets; the
library married to the project, with a read-only standard library and
import from another project; Duplicate / Permute / Ctrl+D; wire bend points
with a rotation handle; soft pip-type affinity; save feedback, unsaved
marker, autosave, settings, and a close warning; name tooltips;
drag-to-place; layer colors in breadcrumbs and navigator. Full list in
[`CHANGELOG.md`](CHANGELOG.md) § 1.1.0. 1.1.1 fixed what hand-testing
turned up: wire corners on doubled-back bend points, the close button,
bend points inside collapsed boxes, and drag-to-place in the desktop app.

v1.0.0 (2026-09-01) was the first versioned release: the node / boundary /
relationship model, C4 layers, the per-machine default library, persistence,
and the dev launcher.

## v1.5 — planned: Hephaestus Tier 2

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
- Chase down the harmless Konva `drawImage` console warning (see
  `ARCHITECTURE.md` § Known rough edges). Dropped from v1.1 on 2026-09-29 —
  cosmetic, not worth the time yet.
- **Connection attributes** — facts about a wire that its transport and
  style don't imply: TLS, auth, ports/hosts. Only if the v2.0 export shows
  Hephaestus needs them.
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
