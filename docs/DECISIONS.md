# Decisions log

Running notes on ideas and decisions, written as we go so a later session
can recover *why*, not just *what*. Three zones:

- **Open** — under discussion, not yet cleared to build.
- **Decided** — the user has said to build it (dated when that happened),
  slotted on [`ROADMAP.md`](ROADMAP.md), not yet built. Design questions
  still listed under an entry are settled during the build.
- **Record** — concluded discussions kept for reference.

Once a Decided item is built, it leaves this file: model- or
mechanism-level changes become a numbered [ADR](decisions/); smaller ones
are covered by [`CHANGELOG.md`](CHANGELOG.md). Anything dropped or
superseded gets a brief trace rather than silent deletion, unless it was
too slight to matter.

## Open

### In-app AI chat window

Raised 2026-09-02. A chat window inside Glyph Palette for discussing the
current project directly with an AI. Tentatively slotted as v2.1
(2026-09-29), explicitly liable to be pushed back — the user wants
everything functional before bells and whistles. Specifics (what it can
see/do, how it fits the canvas UI) haven't been worked out; to be designed
when its turn comes.

### Should the Context-layer seeds ship with pips?

Raised 2026-09-28 during the Snip test run. `System` and `Person` ship with
no pips, so nothing can be wired on a fresh project until definitions are
edited. Intended (forces deliberate interfaces) or should they ship with
generic ones? Not slotted; on the Backlog.

### Deleting definitions that are in use (stub)

Raised 2026-09-29. The user wants a way to delete nodes (definitions)
from the library even when they're in use. Stubbed — design later, because
links make it hairy: instances on any canvas, wires attached to their
pips, the definition's own interior (and definitions nested inside it),
port nodes (v1.2) derived from its pips, pockets containing it. Today the
palette's trash button only deletes definitions that are unused.

## Decided

Cleared to build, not yet built. Versions refer to [`ROADMAP.md`](ROADMAP.md).

### Built in v1.1.0 (2026-09-29)

These left this file when v1.1.0 shipped; their reasoning now lives in:
- Code layer retired, and pockets (collapsed boundaries as same-layer
  folds) → [ADR 0007](decisions/0007-retire-code-layer-and-pockets.md).
- Library married to the project, standard library, import → [ADR 0008](decisions/0008-project-owned-library.md).
- Duplicate / Permute / Ctrl+D, wire waypoints and their rotation handle,
  soft pip-type affinity, save feedback / autosave / settings / close
  warning, name tooltips, drag-to-place, layer display, and the seed pip
  relabel → [`CHANGELOG.md`](CHANGELOG.md) § 1.1.0.

### Built in v1.2.0 (2026-09-30)

Port nodes (including the pocket variant), broken-but-kept links, and
two-part connection types left this file when v1.2.0 shipped; their
reasoning now lives in [ADR 0009](decisions/0009-two-part-connection-types.md)
and [ADR 0010](decisions/0010-port-nodes-and-broken-links.md). The
superseded HTTP ↔ REST/JSON compatibility idea is recorded in ADR 0009's
Context.

### Pockets — remaining piece (v1.4)

Flattening pockets in the `architecture.json` export, so their contents
belong to the pocket's parent. (The v1.1 slice is ADR 0007; pocket ports
shipped in v1.2, ADR 0010.)

### Hephaestus groundwork (v1.3) — fully planned 2026-10-01

Planning started 2026-10-01, adapting `HEPHAESTUS-INTEGRATION.md`'s Tier 1 to
GP as it now is (Code layer retired, two-part connections, ports, pockets).
Five items: slug, external flag, kind, language, paths (derivation, per-node
override, and somewhere to see them).

**Slug** (settled 2026-10-01):
- Every definition has a slug: a filesystem-safe name, derived from the name
  by default (so renames follow) and stored only once the user types their
  own. Edited in the node dialog under Name.
- Format **snake_case**: lowercase, symbols dropped, spaces/separators →
  `_`, a leading digit gets a `_` prefix (`Safe Browsing API (Snip)` →
  `safe_browsing_api_snip`). Valid as a Python module name and fine in
  Rust/Go/Ruby/TypeScript.
- Languages that tie file names to contents (Java requires `LinkService.java`;
  C#/Kotlin/Swift/React-component conventions) are handled when the export
  builds the actual file name, by a per-language convention — the slug stays
  snake_case as the canonical form. To settle with language (item 4) and the
  export (v1.4).
- Standard nodes are read-only, so their slugs are always derived; the user
  expects to Permute standard nodes before building anything from them.

**External flag** (settled 2026-10-01):
- `external` on every definition, set by a checkbox in the node dialog;
  copied by Duplicate, Permute, and Import. Everything inside an external
  node is external too.
- **The rule (user's):** external means handled or managed by someone else,
  or outsourced — never built here. A database you design (schema,
  migrations) is yours, so **Database is buildable**; the database *engine*
  (Postgres itself) is just what it runs on.
- Standard defaults — external: Person, External System, Internet, Firewall,
  Cache, Message Queue, Object Store. Buildable: everything else, Database
  included. (Cache and Message Queue are external on the assumption they're
  hosted services; Permute them to buildable when you configure your own.)
- **Look:** external nodes keep a solid border but use a different muted,
  neutral color from internal nodes — a warm stone tone against the usual
  cool slate. Never red (reserved for broken links).

**Kind** (settled 2026-10-01): stopping early means handing the contents to
the AI, not "make it one file". Each definition has a **Kind** setting,
**Folder** (default) or **File** (the standard File node is File). What a
node is, for building:

| Shown as | When |
|---|---|
| External — never built | marked external, or inside something external |
| Folder — contents drawn by you | buildable, interior drawn |
| Folder — contents decided by the AI | buildable, interior not drawn (the default) |
| File | Kind set to File |

An interior holding only port nodes counts as not drawn. A File with a drawn
interior keeps it as a reference sketch that isn't built. Pockets are folds
(their contents belong to the canvas around them) and port nodes are never
built.

**Palette hover card** (settled 2026-10-01): kind and the other definition
facts are shown in a large hover card on palette cards, not on the canvas.
It floats to the right of the card, out over the canvas; appears after
~0.4s and hides on drag; shows name/icon, slug, layers, kind line,
external, language, pips with their transport/style colors (long lists
truncated), later the v1.4 description; replaces the native tooltip, with
the placement hint in its footer. Paths are per placed node, not per
definition, so item 5 needs an instance-level view (likely the same card on
hovering a placed node).

**Language** (settled 2026-10-01):
- A Language setting on every definition (folders too — an AI-decided
  folder needs one), defaulting to **Inherit**: a node uses the nearest
  ancestor's language. The effective language can differ per placement; the
  palette card shows "inherited" or the explicit value, the placed-node view
  shows the real one. Nothing set anywhere up the tree → unspecified, which
  the export flags rather than guesses.
- List: Python, TypeScript, JavaScript, Go, Rust, Ruby, Java, C#, Kotlin,
  Swift, SQL (for buildable databases). Additions and an "Other…" option wait
  for a later version.
- **Names follow each language's conventions** in the output — because
  that's what correct code in the language looks like (tooling, imports, the
  AI's own habits), not as a hint. GP keeps one canonical snake_case slug;
  the export converts it. A folder is named by its own language.

| Language | Files | Folders |
|---|---|---|
| Python | `link_service.py` | `link_service` |
| TypeScript, JavaScript | `link-service.ts` | `link-service` |
| Go | `link_service.go` | `linkservice` |
| Rust | `link_service.rs` | `link_service` |
| Ruby | `link_service.rb` | `link_service` |
| Java, Kotlin | `LinkService.java` | `linkservice` |
| C#, Swift | `LinkService.cs` | `LinkService` |
| SQL | `link_service.sql` | `link_service` |

  Limitation: React component files (`LinkService.tsx`) can't be told apart
  from other TypeScript; type a custom slug for those.

**Paths** (settled 2026-10-01):
- Walking down from the top canvas, each buildable folder adds its name (in
  its language's convention); a file ends the path with name + extension.
  Externals get no path; pockets and port nodes add nothing.
- **Project folder:** projects get a name. New asks for it (stored in the
  `.glyph`; nothing is saved until the user saves); the first save suggests
  `<name>.glyph` without assigning it. The top bar shows the project name
  (click to rename, hover for the file location). Older files take their
  name from the file name until renamed. Every path starts with the project
  folder.
- **One top-level system adds no folder** (option b): when the top canvas
  has exactly one buildable node, the project folder plays its role; with
  several, each gets a subfolder. (The earlier "source folder" setting is
  dropped — a path override on a top-level folder does the same.)
- **Override:** per placed node, a full path from the project folder; a
  folder's children build on its overridden path.
- **Seeing paths:** the palette hover card also appears on hovering a placed
  node, adding that node's actual path and effective language; it absorbs
  the old full-name tooltip. Path clashes and definitions placed twice (one
  interior under two paths) show as a warning line there; full lint stays on
  the Backlog.
- **Right-click menus** (first ones, prompted by real need): on a placed
  node — Override path… (dialog: computed path + override field), Reset to
  automatic path, Open inside, Expand (collapsed groups), Edit definition…,
  Duplicate, Delete. On a palette card — Edit, Duplicate, Permute, Delete;
  thin for now, to grow.

### Installable release build — deferred until after v2.0

Raised 2026-09-29; the user decided the same day not to pursue it before
v2.0 — knowing it's possible and cheap is enough for now. On the Backlog.

Notes for when it comes up: GP currently only runs in dev mode
(`launch.bat` → `npm run tauri dev`), where a Vite dev server on
`localhost:1420` serves the UI to a debug Rust binary, so closing the
console kills the app. `npm run tauri build` bundles the UI into the
executable and emits Windows installers (NSIS `setup.exe` and MSI) under
`src-tauri/target/release/bundle/`; `tauri.conf.json` is already
configured for it. Open at that point: code signing (unsigned installers
trigger a SmartScreen "unknown publisher" warning), Tauri's updater
plugin, and dev and installed copies sharing one per-machine library.

## Record

### Visible delete button on nodes — declined

Raised 2026-09-30 during 1.1.0 hand-testing (deleting a node wasn't
discoverable). Delete/Backspace already removes selected nodes from the
canvas; the fix was listing "Del delete" in the top-bar shortcut hint. The
user declined an on-canvas trash button, consistent with holding off on
right-click menus until use shows a need.

### Snip test run — friction log (concluded 2026-09-29)

A walkthrough recreating a URL shortener ("Snip": two people, a system, an
external Safe Browsing API; then containers, components, and code) to
stress GP end to end, 2026-09-28 → 2026-09-29. Every finding, and where it
went:

- **New pips silently default to HTTP** (`Object.keys(pipTypes)[0]` in
  `DefinitionWizard.tsx`). User's call: user error, not a design problem.
  No change.
- **HTTP vs REST/JSON fully incompatible** → Decided, v1.2.
- **Context-layer seeds have no pips** → Open.
- **Instance names come from definitions** (two people = two
  definitions) → Duplicate and Permute, v1.1.
- **Seed pip label contradicts its type** (API Service's inbound pip
  labeled "HTTP", typed REST/JSON) → relabel on the v1.1 list. (Pips turned
  out to already show "label · type (direction)" on hover.)
- **Boundaries worked cleanly** — draw → name → collapse → expand
  round-tripped without issues.
- **No save feedback** → v1.1.
- **Inner canvases can't show their surroundings** (no people or Links DB
  on the Component canvas, nothing tying Snip API's outer pips to its
  interior) → port nodes, v1.2.
- **Renaming a seed removes the generic from the project's palette** (the
  project copy shadows the library entry by id) → Duplicate and Permute
  remove the reason to rename seeds, v1.1.
- **Creating near-identical definitions one by one is tedious** → Duplicate
  and Permute, v1.1.
- **Truncated names** ("Safe Browsing …") → tooltip, v1.1.
- **Nesting below Code gives another Code canvas** → moot once the Code
  layer is retired, v1.1.
- Also raised during the run, not friction: drag-to-place from the palette
  (v1.1), edge waypoints (v1.1), library export/import (v1.1), installable
  build (deferred), Code layer handed to Hephaestus (v1.1).
