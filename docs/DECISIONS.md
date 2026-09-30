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

All cleared to build on 2026-09-29, when the user approved the post-test
build order. Versions refer to [`ROADMAP.md`](ROADMAP.md).

### Retire the Code layer — Hephaestus owns it (v1.1)

The user decided on 2026-09-29 that the Code layer will not be drawn in GP;
Hephaestus owns function-level structure entirely. Becomes an ADR amending
[ADR 0003](decisions/0003-c4-layer-system.md) once built.

Background: after drawing Snip's Code layer (three functions and a type
inside Link Service), drawing at function level felt as costly as writing
the code. Claude's reasoning, agreed:
- GP earns its keep where decisions are architectural and expensive to
  reverse — what exists, what talks to what, over which interface. At
  function level, code is already the best notation; a box per function
  says less than its signature, and goes stale the day the code changes.
- That split plays to both sides: people are better at keeping a system's
  shape coherent; LLMs are good at filling in a well-specified box.
- The LLM's freedom is *bounded*: free inside a component, constrained by
  its interface — the port nodes (v1.2) and the interface names on
  `call`/`import` edges (v1.4).
- To compensate for the boxes no longer drawn, Component-layer definitions
  get richer (v1.4): a free-text responsibility/notes field, key exported
  symbols as text.

Build details settled 2026-09-29:
- `code` stays in the `Layer` type so old files load; it's no longer
  offered anywhere (wizard layer picker, new canvases). No further Code
  layer support going forward.
- Component is the deepest drawable layer, and **Component nodes can
  contain Component-layer canvases** (e.g. a Module holding Files), so
  nesting stays useful at the bottom and lines up with v1.3's `dir`/`file`
  kinds. (`nextLayer` clamps at `component`.)
- Existing Code canvases stay **fully editable** — kept, not supported.
- Code seeds (Function, Class, Type / Interface) leave `SEED_LIBRARY`, and
  are pruned from the persisted per-machine library if still unmodified.
- Bundled fix: collapsing a boundary currently gives its inner canvas
  `nextLayer(...)` — one layer too deep (Snip's Analytics interior is
  marked Component while holding containers). A collapsed boundary's
  interior keeps its parent's layer; affected files are repaired on load.
  See "Pockets" under Open for the broader idea this raised.

### Pockets: collapsed boundaries as same-layer folds (v1.1, v1.2, v1.4)

Raised and decided 2026-09-29 (user) while planning the collapse-layer fix. Two
different things currently share one mechanism (a definition with a
`canvasId`): **decomposition** — a node's interior, one layer down — and
**grouping** — a collapsed boundary, which is only a fold at the *same*
layer. Proposal: every layer has a "pocket" that collapsed nodes go into,
while real nodes lead down to the next layer.

Claude's feedback: agree with the distinction, but model it as a *kind of
canvas*, not a new `Layer` value — layers are an ordered zoom scale, and a
pocket isn't a step on it. Likely derived from the existing `expandable`
flag on collapsed-boundary definitions rather than a new stored field.
What the distinction buys:
- Palette/layer display: a pocket shows its parent layer's palette and is
  labeled as a collapsed group, not a deeper level.
- Ports (v1.2): real interiors get ports *top-down* from the parent
  definition (edit the parent to change them); a pocket's pips are derived
  *bottom-up* from wires crossing the boundary (`pipMap`). The port rules
  need a pocket variant.
- Hephaestus export (v1.4): pockets are transparent — flattened away so
  their contents belong to the pocket's parent. Real interiors are real
  hierarchy (`dir`).
- Palette: collapsed groups currently appear as placeable definitions
  (Analytics showed up in Snip's Container palette); placing a second one
  would share the canvas and silently alias its contents.

Decided 2026-09-29: modeled as a canvas kind at the parent's layer (not a
new `Layer`). **v1.1 slice:** pockets keep their parent's layer (bug fix +
on-load repair), are labeled as collapsed groups in the palette header and
navigation, and collapsed groups are **hidden from the palette**. Pocket
port rules land with port nodes (v1.2); pocket flattening lands with the
`architecture.json` export (v1.4).

### Duplicate and Permute (v1.1)

Raised 2026-09-28, expanded 2026-09-29. Two distinct operations:

1. **Duplicate (with an incremented name).** One click makes a new,
   independent definition identical to the source except for its name,
   which is incremented automatically.
2. **Permute** — the user's name for "new node based on…" (it makes a
   permutation of the base node). The wizard opens pre-filled with the
   base definition's name, icon, layers, and pips; the user edits before
   saving, producing a new independent definition.

Motivation: a node's display name comes from its definition, so every
distinct thing on a canvas needs its own definition, and today each is
built from scratch in **New Node** or by renaming a seed — which also
removes the generic seed from that project's palette (see the friction log).
Not the same as **Ctrl+C / Ctrl+V**, which copies *instances* that still
share one definition (one name, one inner canvas).

Build details settled 2026-09-29:
- **Naming:** a space then a number. `Link Service` → `Link Service 2`; a
  name already ending in ` N` has that number incremented (`Worker 2` →
  `Worker 3`). Shared with collapse's existing "Name 2" scheme.
- **Duplicate:** hover button on each palette card; each click makes the
  next copy immediately. Same icon, layers, pips; new id.
- **Permute:** hover button on each palette card; opens the wizard with
  every field identical to the subject **except the name, which is blank**
  and focused, ready to type.
- **Ctrl+D on selected nodes:** each selected node gets a duplicated
  definition, and the new instances are placed **at the cursor**, keeping
  their relative layout; wires between selected nodes come along, as with
  Ctrl+V.
- **Copies start with an empty interior** (Duplicate, Permute, and Ctrl+D).
  Duplicating contents is a future feature (Backlog).
- No link back to the base; pockets can't be duplicated; undoable.
- **No right-click menu yet** — deliberately held until real use shows
  where one is wanted.

### Library married to the project (v1.1)

Decided 2026-09-29 (user). Each project owns its library; there's no
separate per-machine or "current" library.
- **Standard library:** ships with GP, read-only, always present; its
  nodes show no pencil — only Duplicate and Permute (into the project).
- **Project library:** the `.glyph`'s own definitions; every new or edited
  node goes there.
- **Import from another project:** pick any `.glyph`, choose definitions
  (grouped by layer), bring them in. Pip types they use come along;
  existing pip types keep their colors. Interiors come across **empty**
  (import-with-contents joins "duplicate with contents" on the Backlog).
  Pockets are never imported.
- **Conflicts:** an imported definition whose id *or* name collides gets a
  new id and a suffix on its name marking it as the import, so both
  coexist.
- **No `.glyphlib` format.** A library is just a project you import from;
  a `.glyph` holding definitions and an empty canvas is a curated library.
  The standard library may ship as such a file.
- The per-machine `library.json`, copy-on-use adoption, and the "save to
  default library" button are retired (checked: the user's library held
  only the 25 seeds). Supersedes
  [ADR 0004](decisions/0004-default-library-copy-on-use.md) once built.
- Existing files that renamed seeds in place (Snip's `def-database` →
  Links DB) get re-id'd on load so the standard node reappears alongside.

Superseded the same day, never built: a **two-tier "standard + current
library" model** (one swappable read-write `.glyphlib` loaded per machine,
with project backup copies for orphaned nodes, an orphan palette section,
and per-node "add to library" buttons). Dropped in favor of the simpler
married model, which makes orphans impossible.

### Edge waypoints (v1.1)

Raised 2026-09-29. Double-click a relationship to add a waypoint (bend
point), so a wire can be routed around nodes. Optional
`waypoints: {x, y}[]` on `Relationship`; older files load unchanged.

Settled 2026-09-29:
- **Style:** straight segments with rounded corners (subway-map look).
- **Add:** double-click a wire; the point is inserted in path order.
- **Move:** select the wire to show handles; drag a handle.
- **Remove:** select a handle and press Delete.
- **Node moves:** waypoints stay put, unless both ends of the wire move
  together (selection drag, boundary drag, paste/Ctrl+D) — then they
  translate with them.
- **Collapse/expand:** crossing wires keep waypoints outside the box and
  drop those inside; wires wholly inside keep theirs in the pocket.
- **Rotation/length handle (under discussion):** selecting a waypoint shows
  a second handle that can be dragged in a circle around it, rotating a
  straight section through the waypoint; distance from the waypoint sets
  the section's length. Geometry details being clarified.

### Soft pip-type layer affinity (v1.1)

Decided 2026-09-29 (option b of three weighed: drop affinity / soft /
hard-with-translating-ports). The definition wizard defaults to and lists
first the pip types usual for the definition's layer (transport types for
Containers, Call/Import for Components), but any type can still be picked.
Hard affinity would have broken port nodes: ports carry the parent's
transport types onto Component canvases, and `canConnect` requires an
exact type match, so edge components (a repository speaking SQL, an API
client speaking REST) must be allowed transport-typed pips.

### Inbound / Outbound port nodes (v1.2)

Raised 2026-09-29 by the user during the Snip test run. Every inner canvas
gets an **Inbound** node and an **Outbound** node that stand for "the edge
of the thing we're inside". Their pips mirror the parent definition's pips
with direction flipped: each inbound pip on the parent (e.g. Snip API's
`API`, REST/JSON in) appears as an *outbound* pip on the Inbound node,
ready to wire to whichever inner component handles it; each outbound parent
pip appears as an *inbound* pip on the Outbound node. Where those
connections lead beyond the parent is deliberately not shown.

Why it fits GP:
- **It's the only coherent answer given shared canvases.** A definition's
  inner canvas is shared by every instance of it, so "where does this edge
  go outside?" has no single answer. The ports only describe the
  definition's own interface, which *is* shared.
- **It mirrors collapse.** Boundary collapse already derives outer pips
  from inner wires and records the mapping in `pipMap`; ports are the same
  mapping seen from the inside, and could plausibly back both.
- **It enables lint.** An unwired port pip means "this interface isn't
  implemented inside" — exactly the interface information Hephaestus needs.
- It removes most reasons to allow container-layer nodes on component
  canvases just for context.

Rules set by the user (2026-09-29):
- **Ports belong to the parent node's definition.** Inside any node with an
  interior (Container, Component, or a Context-layer System like Snip), the
  Inbound and Outbound nodes are generated automatically from that
  definition's pips. Read-only from the inside: to change a port, go up a
  level and edit the parent definition; the ports inherit the change. The
  top-level canvas has nothing above it, so has no ports itself — but every
  node on it gets ports inside.
- **Exactly two port nodes per inner canvas**, one Inbound and one
  Outbound, each the sum of all connections in that direction.
- **Never merge directions.** Inbound and outbound pips stay separate, even
  if redundant; redundant pips are fine.
- **Bidirectional (and `none`) parent pips appear on both port nodes.**
- **Deleting a parent pip never silently destroys inner work.** The pip
  stays on the port node, marked broken (red or similar), and any wire
  attached to it stays in place, marked problematic, so it can be found and
  fixed by hand.
- **Retyping a parent pip is treated the same way** (confirmed 2026-09-29):
  if the inner wire no longer matches the new type, the port pip remains,
  marked broken, and its wire stays in place, marked problematic.
- Older `.glyph` files get ports generated on load.

### HTTP ↔ REST/JSON compatibility (v1.2)

Raised 2026-09-28 during the Snip test run; slotted 2026-09-29. REST/JSON
*is* HTTP, so today's hard incompatibility between them reads as "wrong
granularity", not "wrong protocol". Direction: pip-type compatibility or
hierarchy, so a subtype (REST/JSON) can connect to its parent protocol
(HTTP). To settle during the build: a general parent-type field on
`PipType` vs. an explicit compatibility list; whether the wire takes the
more specific or the more general type; how it interacts with port nodes.

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
  labeled "HTTP", typed REST/JSON) → relabel on the v1.1 list; pip type on
  hover folded into the tooltip item.
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
