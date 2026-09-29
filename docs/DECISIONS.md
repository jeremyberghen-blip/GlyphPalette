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

### Pockets: collapsed boundaries as same-layer folds

Raised 2026-09-29 by the user while planning the collapse-layer fix. Two
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

Open: whether collapsed groups should be hidden from the palette; whether
the v1.1 slice is just the layer fix + labeling, with ports/export parts
riding along in v1.2/v1.4.

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

To settle during the build:
- **Increment scheme.** Trailing number (`Service 2`)? For names ending in
  punctuation, `generateSlug()` → `generateSlug2()` or `generateSlug() 2`?
  Must respect unique names.
- **Entry points.** Palette card button, right-click on a placed node,
  a "Based on" dropdown in the wizard.
- **Link back to the base.** Probably none — a clean break, like
  copy-on-use (see [ADR 0004](decisions/0004-default-library-copy-on-use.md)).
- **The base's inner canvas.** Copy, share, or start empty? Sharing would
  silently alias the two; empty is safest; a deep copy is the most useful
  but the most complex.

### Library as a file: export, import, standard library (v1.1)

Raised 2026-09-28; scope set 2026-09-29. The default library already *is*
a separate per-machine file — `%APPDATA%\glyph-palette\library.json`
(`localStorage` in the browser preview), see `src/lib/library.ts` and
[ADR 0004](decisions/0004-default-library-copy-on-use.md) — but it's
implicit: no UI to export it, import one, or save it elsewhere. Scope:
- Export and import the library as a file.
- A **standard library file** containing all the seeds (minus the retired
  Code-layer ones), in the same format as an export — so the seeds can be
  restored or shared like any other library.

To settle during the build: one active library or several stacked (e.g.
personal + team); how import handles id/name collisions; pip types travel
with the library (they must — definitions reference them by id); whether
`SEED_LIBRARY` moves from TypeScript into that standard file.

### Edge waypoints (v1.1)

Raised 2026-09-29. Double-click a relationship to add a waypoint (bend
point), so a wire can be routed around nodes instead of always taking the
default bezier between its two pips. Implies an optional field on
`Relationship` (e.g. `waypoints: {x, y}[]`); older files load unchanged.

To settle during the build: moving (drag) and removing (double-click
again? Delete while selected?) a waypoint; smooth curve through the points
vs. straight segments; what happens when an endpoint node moves (absolute
positions vs. shift proportionally); behavior through collapse/expand,
where the relationship is rewired to an inherited pip.

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
