# 0009: Two-part connection types (transport + API style)

Date: 2026-09-30
Status: Accepted

## Context

Through v1.1, pips and wires had one flat type from a list that mixed two
layers of the protocol stack: "HTTP" (a transport) sat beside "REST/JSON" (an
API style that rides on HTTP). The Snip test run asked whether HTTP should
connect to REST/JSON, which had no clean answer under a flat list. Considered
first: one-way subtype matching (REST/JSON is-a HTTP), or leaving matching
strict. Both patched the flat list instead of fixing it.

## Decision

Every pip and wire carries a **transport** (how it travels: HTTP, HTTP/2,
WebSocket, TCP, message queue, filesystem, in-process) and an **API style**
(what it means: REST/JSON, GraphQL, SOAP/XML, web pages, gRPC, SQL,
key-value, event, call, import), plus the special style **"any"** for
pass-through infrastructure.

- **Connecting:** transports must match exactly; styles must match, or either
  side is "any". A wire records the more specific style.
- **Two layers only.** Lower layers (TCP under HTTP) are implied, and
  generated code works at the library level, so recording them would tell
  Hephaestus nothing. Facts that aren't implied — TLS, auth, ports/hosts — are
  connection attributes, not layers (Backlog).
- **Drawing:** a pip is a transport-colored ring with a style-colored center;
  a wire is a transport-colored line with a style-colored core half as thick.
  "Any" has no center/core. Red is reserved for broken links.
- **Node dialog:** a Transport and a Style picker per pip; transports ordered
  by the definition's layers (soft affinity, as before), styles by the chosen
  transport; nothing hidden. New pips default to the layer's usual transport
  and its most common style.
- **File format v2** (`transports`, `styles` instead of `pipTypes`). Version 1
  files upgrade on load by a fixed mapping (`src/lib/legacyTypes.ts`); custom
  v1 types become transports. Unedited v1.0 seed copies still fold into the
  standard nodes, compared by transport only, since styles didn't exist.

## Consequences

- The export to Hephaestus gets both what to wire up and what to generate.
  v1.5's planned edge `kind` (network vs. in-process) can likely be derived
  from the transport instead of stored.
- Files saved by v1.2 are version 2; v1.1 can't read them correctly. Upgrading
  is one-way.
- Two legends and two pickers are more UI than one; presets (named pairs)
  were considered and not chosen, to keep the two parts visible.
- A pip type no longer has one color; anything that colored by type (wires,
  pips, the wire drag preview, waypoint handles) uses the transport color.
