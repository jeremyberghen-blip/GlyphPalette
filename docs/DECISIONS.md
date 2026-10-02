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

### Hephaestus Tier 2 (v1.5) — planning

Planning started 2026-10-02, adapting `HEPHAESTUS-INTEGRATION.md` Tier 2
to GP as it now is (two-part connections, v1.3 build facts). Planned as
four features — connection kinds, interface names, description and
constraints, the `architecture.json` export; interface names were dropped
(below), leaving three.

**Connection kinds** (settled 2026-10-02): every wire has a kind for the
export — `transport` (separately running things talking), `import` (one
file uses names defined in another), or `call` (direct use of code inside
one program) — worked out from what's drawn, not set per wire:
- the Import style → `import`; the Call style → `call`;
- any other wire on the In-process transport → `call`;
- everything else → `transport`.
- Import and call stay **distinct** in the export, exactly as drawn — the
  translation stays mechanical (the spec's `call` was meant for the
  retired function level; merging would be GP deciding for the user).
- Custom styles get a **Kind** choice in the "+ New style" form (Runtime
  connection / Import / Call; default Runtime connection), stored on the
  style. Older files need nothing.
- Shown in the legend: Call and Import marked as code dependencies.

**Interface names** — dropped 2026-10-02. Planned as a names list on
receiving pips (`save, find_by_slug`, endpoints for network pips). The
user decided Hephaestus should name interfaces: control too tightly and
the benefit of using an LLM is lost. The goal was restated to match — a
balance of deciding shape and architecture yourself while leveraging the
AI's intelligence, with responsibility for the finished work resting on
whoever presents it (`HEPHAESTUS-INTEGRATION.md` § Why this exists).

### How releases should work on GitHub (to discuss)

Raised 2026-10-01 by the user, who wants to talk it through before anything
is published: what a GitHub Release for GP should contain and look like
(installer attached, notes from the changelog, how versions are named,
what a visitor sees), and who uploads it. Until then Claude builds the
installer locally and hands it over; nothing is uploaded. Not slotted —
recorded so it isn't forgotten.

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

### Pockets — remaining piece (v1.5)

Flattening pockets in the `architecture.json` export, so their contents
belong to the pocket's parent. (The v1.1 slice is ADR 0007; pocket ports
shipped in v1.2, ADR 0010.)

### Built in v1.3.0 (2026-10-01)

Hephaestus groundwork — slug, External, Kind, Language, build paths, the
project name, per-node path overrides — left this file when v1.3.0 shipped;
its reasoning now lives in [ADR 0011](decisions/0011-build-facts-and-paths.md).
The hover cards and right-click menus are in [`CHANGELOG.md`](CHANGELOG.md)
§ 1.3.0. Calls made during the build (recorded in the ADR): the project
folder is the kebab-case slug of the project name; typing the automatic
path back in is no override; an override inside a shared interior applies
to every placement (the dialog warns); collapsed groups get no path
override or Edit (their pips come from the wires they fold); v1.0 forks of
standard nodes take the standard node's facts on load.

### Built in v1.4.0 (2026-10-01)

The stable/dev split (installed app from `master`, GP Dev Mode for the
work copy, the release flow, unsigned installer) left this file when
v1.4.0 shipped; its reasoning now lives in [ADR 0012](decisions/0012-installed-app-and-dev-copy.md),
which also records the reload-to-blank cause (Tailwind scanning `docs/`)
and both fixes. It superseded the "Installable release build — deferred
until after v2.0" entry (2026-09-29). The user's pip UI notes from updating
Snip — legend on demand, pips grouped by direction (Both ways / other as a
third section), Add pip… and Permute… on the node menu, one Builds-as
choice with External greying out Language — are in
[`CHANGELOG.md`](CHANGELOG.md) § 1.4.0; the Builds-as merge is also noted
in [ADR 0011](decisions/0011-build-facts-and-paths.md).

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
