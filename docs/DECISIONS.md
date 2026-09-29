# Open decisions

This file holds ideas and decisions currently under discussion — not yet
committed to a roadmap version, not yet built. Something moves out of here
and into a numbered [ADR](decisions/) once it's actually decided and built;
this file is only the holding pen before that point. If something is
discussed and then dropped or superseded rather than built, it gets a brief
trace here rather than being deleted silently, unless it was too slight to
matter in the first place.

## Open

### In-app AI chat window

Raised 2026-09-02. A chat window inside Glyph Palette for discussing the
current project directly with an AI — not yet scoped to a specific roadmap
version. Specifics (what it can see/do, how it fits the canvas UI) haven't
been worked out yet; deferred until the user is ready to design it in detail.

### "New node based on…" (definition templating)

Raised 2026-09-28, during the Snip test run. An option to create a new
definition *based on* an existing one: the wizard opens pre-filled with the
base definition's name, icon, layers, and pips, and saving produces a new,
independent definition rather than editing the original. Motivation: because
a node's display name comes from its definition, every distinct thing on a
canvas (two people, two services) needs its own definition, and today each
one is built from scratch in **New Node** even when it's 90% a copy of a seed
entry. Open questions: entry point (palette card button, right-click on a
placed node, or a "Based on" dropdown in the wizard); whether the copy keeps
any link back to its base (probably not — copy-on-use elsewhere is a clean
break, see [ADR 0004](decisions/0004-default-library-copy-on-use.md)); and
whether the base's inner canvas is copied, shared, or left empty (probably
empty — sharing would silently alias the two).

### Definition library as a saveable, exportable file

Raised 2026-09-28. The library should be a file the user can save, export,
and presumably import/share. **Current state:** the default library already
*is* a separate file — `%APPDATA%\glyph-palette\library.json`
(`localStorage` in the browser preview), see `src/lib/library.ts` and
[ADR 0004](decisions/0004-default-library-copy-on-use.md) — but it's
per-machine and implicit: there's no UI to export it, import one, save it
elsewhere, or switch between libraries. So the gap is the user-facing file
workflow, not the storage split. Open questions: one active library or
several stacked (e.g. a personal library + a team one); how import handles
id/name collisions with the existing library; and whether pip types travel
with it (they should — definitions reference them by id).

### Snip test run — friction log

Started 2026-09-28. A walkthrough recreating a URL shortener ("Snip": two
people, a system, an external Safe Browsing API; then containers, components,
and code) to stress GP end to end. Findings so far, not yet triaged into
decisions or roadmap items:

- **New pips silently default to HTTP.** The wizard's "add pip" picks the
  first pip type (`DefinitionWizard.tsx`, `Object.keys(pipTypes)[0]`), which
  is HTTP. Easy to leave unchanged by accident — hit on Snip's `URL check`
  pip, which then couldn't wire to Safe Browsing API's REST/JSON `In`.
  **User's call: user error, not a design problem** — the walkthrough said
  REST/JSON and it was missed. Kept only as a trace; no change wanted.
- **HTTP vs REST/JSON are fully incompatible types.** REST/JSON *is* HTTP, so
  an HTTP↔REST mismatch reads more like "wrong granularity" than "wrong
  protocol". Possible fix: pip-type compatibility/hierarchy (REST/JSON as a
  subtype of HTTP, connectable to it). Related to the v1.1 pip-type layer
  affinity item in [`ROADMAP.md`](ROADMAP.md).
- **Context-layer seeds have no pips.** `System` and `Person` ship with
  none, so nothing can be wired on a fresh project until definitions are
  edited. Worth deciding whether that's intended (force deliberate
  interfaces) or whether they should ship with generic ones.
- **Instance names come from definitions.** Two people on one canvas means
  two definitions. Motivates the "New node based on…" item above.
- **Seed pip label contradicts its type.** API Service's inbound pip is
  labeled "HTTP" but typed REST/JSON (`p-srv-http` in
  `defaultLibrary.ts`). The walkthrough's own instructions echoed the label,
  and once a real HTTP pip ("Redirect") sat beside it on the same side, the
  two were easy to confuse. Fix candidates: relabel the seed pip ("API"),
  and/or show the pip type in the pip's hover/label, not just its color.
- **Boundaries: worked cleanly.** Draw → name → collapse → expand on the
  Snip Container canvas round-tripped without issues.
- **No save feedback.** Moved to the v1.1 list in [`ROADMAP.md`](ROADMAP.md).
- **Inner canvases can't show their surroundings.** Inside Snip API
  (Component layer), neither the people nor Links DB are in the palette —
  layer filtering hides them — so Link Repository has nothing to wire its
  database access to, and nothing shows who calls the controller. Nothing
  ties Snip API's outer pips to its interior either. Proposed answer:
  "Inbound / Outbound port nodes" below.

### Inbound / Outbound port nodes

Raised 2026-09-29 by the user during the Snip test run; strongly favored.
Every inner canvas gets an **Inbound** node and an **Outbound** node that
stand for "the edge of the thing we're inside". Their pips mirror the
parent definition's pips with direction flipped: each inbound pip on the
parent (e.g. Snip API's `API`, REST/JSON in) appears as an *outbound* pip on
the Inbound node, ready to wire to whichever inner component handles it;
each outbound parent pip appears as an *inbound* pip on the Outbound node.
Where those connections lead beyond the parent is deliberately not shown.

Why it fits GP well:
- **It's the only coherent answer given shared canvases.** A definition's
  inner canvas is shared by every instance of it, so "where does this edge
  go outside?" has no single answer — two instances can be wired
  differently. The ports only describe the definition's own interface,
  which *is* shared.
- **It mirrors collapse.** Boundary collapse already derives outer pips
  from inner wires and records the mapping in `pipMap`; ports are the same
  mapping seen from the inside, and could plausibly back both.
- **It enables lint.** An unwired port pip means "this interface isn't
  implemented inside" — a natural check for the Backlog's in-GP lint item,
  and exactly the interface information Hephaestus needs.
- It removes most reasons to allow container-layer nodes (Database,
  External System) on component canvases just for context.

Settled by the user (2026-09-29; still Open — not yet cleared to build):
- **Ports belong to the macro node's definition.** Inside any node with an
  interior (a Container, a Component, or a Context-layer System like
  Snip), the Inbound and Outbound nodes are generated automatically from
  that definition's pips and conform to them. They're read-only from the
  inside: to change a port, go up a level and edit the parent definition;
  the ports inherit the change.
- **Exactly two port nodes per inner canvas** — one Inbound, one Outbound —
  each the sum of all connections in that direction, agnostic of where
  they lead.
- **Never merge directions.** An inbound and an outbound pip stay separate
  pips on their respective port nodes, even if that looks redundant;
  redundant pips are fine.

Still open:
- **Pips that are already bidirectional (or `none`) on the parent** — e.g.
  the seed Database's `Events` pip. Candidate, consistent with "redundant
  is fine": show such a pip on *both* port nodes. Awaiting confirmation.
- **Inner wires when a parent pip changes.** If the parent's pip is
  deleted or retyped, what happens to the inner wire on its port — deleted,
  kept but flagged broken, or the edit is blocked?
- **Conflict with v1.1's "pip-type layer affinity"** — explained to the
  user, decision pending. Ports carry the parent's transport types (REST,
  SQL, Queue) onto Component canvases, and `canConnect` requires an exact
  type match, so whatever component wires to the Outbound node's SQL `DB`
  pip must itself have a SQL pip. Hard affinity (transport types hidden
  from Component-layer definitions) would make such ports unwireable.
  Options: (a) drop affinity; (b) make it soft — affects the wizard's
  default/ordering, never forbids; (c) keep it hard but let port pips
  accept a mismatched type, i.e. the port "translates" Call → SQL.
- Older `.glyph` files would get ports generated on load. The top-level
  canvas has nothing above it, so it has no ports itself — but every node
  on it (e.g. Snip) gets ports inside.

### Edge waypoints (bend points on relationships)

Raised 2026-09-29. Double-click a relationship to add a waypoint along it,
so a wire can be routed around nodes instead of always taking the default
bezier between its two pips. Open questions: how a waypoint is moved
(drag) and removed (double-click again? Delete while selected?); whether
the wire stays a smooth curve through the points or becomes straight
segments; what happens to waypoints when an endpoint node moves (keep
absolute positions vs. shift proportionally); and how they behave through
collapse/expand, where the relationship is rewired to an inherited pip.
Implies a new optional field on `Relationship` (e.g. `waypoints: {x, y}[]`)
and a `.glyph` format addition, but older files would load unchanged.

### Installable release build

Raised 2026-09-29. GP currently only runs in dev mode (`launch.bat` →
`npm run tauri dev`): a Vite dev server on `localhost:1420` serves the UI
to a debug Rust binary, so closing the console kills the app. A release
build (`npm run tauri build`) bundles the UI into the executable and emits
Windows installers (NSIS `setup.exe` and MSI) under
`src-tauri/target/release/bundle/` — `tauri.conf.json` is already configured
for it (`identifier`, `bundle.targets: "all"`, icons). Open questions: code
signing (unsigned installers trigger a SmartScreen "unknown publisher"
warning — fine for personal use, a real cost for distribution); whether to
add Tauri's updater plugin; and keeping dev mode for development alongside
an installed copy (both read the same per-machine library, since it lives in
the app-identifier data dir).
