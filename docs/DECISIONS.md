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

### Pockets — remaining pieces (v1.2, v1.4)

The v1.1 slice is built ([ADR 0007](decisions/0007-retire-code-layer-and-pockets.md)).
Still to do: a **pocket variant of the port-node rules** (v1.2) — a pocket's
ports derive bottom-up from the wires that crossed the boundary, not
top-down from a parent definition — and **flattening pockets** in the
`architecture.json` export (v1.4), so their contents belong to the pocket's
parent.

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

Rules set by the user (2026-09-29; placement revised 2026-09-30):
- **Ports belong to the parent node's definition.** Inside any node with an
  interior (Container, Component, or a Context-layer System like Snip), the
  Inbound and Outbound nodes take their pips from that definition.
  Read-only from the inside: to change a port, go up a level and edit the
  parent definition; the ports inherit the change.
- **Placed from the palette, not generated** (2026-09-30, replacing
  "generated automatically"). Not every interior needs ports, so they're
  optional: the palette always offers Inbound and Outbound on an inner
  canvas, just in case, and the user places them when wanted. They delete
  like any node.
- **Contextual, not shared.** The palette's port entries always point at
  the node the user is currently inside: inside Snip API they carry Snip
  API's pips; inside Links DB, Links DB's. They are not one shared "Port"
  definition per layer.
- **One Inbound and one Outbound**, each the sum of all connections in that
  direction (see open questions below on enforcing "at most one").
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
- ~~Older `.glyph` files get ports generated on load.~~ Dropped 2026-09-30:
  with ports optional, nothing is generated.

Settled 2026-09-30 after the palette change:
- **At most one Inbound and one Outbound per canvas**; the palette card is
  disabled once that port is placed.
- **Hidden on the top-level canvas**, which has nothing above it.
- **Deleting a port node removes its wires**, like any node (undoable). The
  broken-but-kept rule is for parent changes, not deliberate deletion.

### Two-part connection types: transport + API style (v1.2)

Raised and decided 2026-09-30 (user), while discussing HTTP ↔ REST/JSON.
Every pip and wire carries **both a transport and an API style**, drawn as
a line in the transport's color with a core in the style's color (e.g. a
green HTTP line with a blue REST/JSON core). Ships in v1.2 with port nodes,
so the wire model changes once ("ports and connections").

Why: HTTP is a transport; REST/JSON is an API style + payload riding on it
(as are GraphQL, SOAP/XML, web pages, gRPC). The old flat list mixed the two
layers, so "can HTTP connect to REST/JSON?" had no clean answer. This models
real protocol layering, and carries what Hephaestus needs: transport →
which client/server plumbing, style → what to generate. It may subsume
v1.4's planned edge `kind` (network vs. in-process transport).

Settled:
- **Connection rule:** transports must match exactly; styles must match,
  **or either side is "any"** (pass-through infrastructure: firewall, load
  balancer, proxy). The wire shows the specific style's core; "any"–"any"
  shows no core.
- **Two layers only.** Lower layers (TCP under HTTP, HTTP/2 under gRPC)
  are implied, and generated code works at the library level, so recording
  them would tell Hephaestus nothing. Facts that *aren't* implied — TLS,
  auth, ports/hosts — are connection attributes, not layers; on the Backlog
  until the v2.0 export shows they're needed.
- **Starting mapping** of today's ten types (upgrade path for files and the
  standard library): HTTP → HTTP/any; REST/JSON → HTTP/REST-JSON;
  gRPC → HTTP/2/gRPC; TCP/IP → TCP/any; SQL → TCP/SQL; Queue → Message
  queue/any; Event → Message queue/Event; File I/O → Filesystem/any;
  Call → In-process/Call; Import → In-process/Import.

To settle during v1.2 planning: the starting transport and style lists and
colors; how the wizard's two pickers and the soft layer affinity work
together; pip and wire rendering (thicker wires so the core shows).

Superseded the same day, never built: **HTTP ↔ REST/JSON compatibility** —
one-way subtype matching (REST/JSON is-a HTTP), or leaving matching strict.
Both were patches on a flat type list the two-part model removes.

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
