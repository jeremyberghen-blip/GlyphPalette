# Glyph Palette → Hephaestus integration

> Handoff note from a Project Hephaestus session (2026-08-29). Read this before
> changing GP's data model or adding an export. The goal of the changes below is
> to let GP drive an AI code-generation pipeline (Hephaestus) **without GP
> becoming a slow IDE.**

## Why this exists

**The goal is a balance:** decide the shape and architecture of the system
yourself, and use the AI's intelligence for the rest. Control too tightly
and there's no point using an LLM at all; control too loosely and the
system isn't yours. GP is where you make the decisions you want to own —
which parts exist, how they depend on each other, what each is for and
what it must not do — and record them in a form an AI can build from.
Hephaestus works inside that shape and brings its own judgement to
everything finer: what crosses each seam, signatures, errors, tests,
implementation.

**Authorship aside, responsibility is yours.** Whoever presents the
finished work answers for it, for better or ill — a client can't hold the
model's maker to account for what you hand over. So the aim isn't to
minimise the AI's part; it's to stay in charge of the decisions you'll
answer for, and to review what comes back.

Metaphor: **GP's output is piping. The AI writing code is water flowing
through it.** You own the pipe layout and the direction of flow. The AI owns
what flows through — and the fittings where pipes meet.

Consequence for the data model: the GP → contract translation should be
**faithful for what you decide** — decomposition, dependency direction,
connection kinds, purpose and constraints — and as mechanical as possible
there. If it's lossy on those, the AI's design pass fills the gap with its
own architecture and the structure stops being yours. Below that line,
leave room: the AI is there to think, not to transcribe.

The line to hold: you mark **where the seams are and which way they run**;
naming and specifying them (interface names, parameter lists, error types,
test cases) is the AI's job. *(Revised 2026-10-02: earlier drafts had you
naming each seam's "flange" — the symbols crossing it. The user moved that
to the AI: control too tight loses the benefit of using an LLM.)*

Ownership split (adapted from the Hephaestus design doc §4.1):

| You own | The AI's design pass owns |
|---|---|
| decomposition (which folders and files exist) | interface names — what crosses each seam |
| dependency direction, and each connection's kind | exact signatures |
| where the seams are | error types |
| purpose and constraints, in prose | test cases, implementation |

## The mental model

GP is a **C4-style recursive decomposition**. Same diagram kind at every zoom:

| Zoom | C4 name | GP node | Edge meaning |
|---|---|---|---|
| subsystems | Container | "API Gateway", "Database" | transport (HTTP, SQL) — what GP models today |
| files | Component | `auth.py`, `tokens.py` | `import` — the thing crossing is a symbol name |
| functions | Code (optional) | `verify_token`, `_decode` | `call` — the edge *is* the call, no label |

The container/collapse feature is already the zoom mechanism. You expand a
subsystem node and draw its files inside it; expand a file and draw its
functions.

**Decomposition depth = agency depth, chosen per node.** Stop at the file box →
the AI design pass writes that file's stub, you own "which files, how they
depend." Draw the functions inside a file → you own that file's skeleton too,
the AI only fills signatures and tests. You do *not* have to go to function
level everywhere; do it where you care.

**Thin vertical slice first.** Do not decompose the whole 40-node diagram to
files before anything is built. Pick one path — one subsystem, its handful of
files, one external dependency — take it all the way through the pipeline, learn
what the diagram couldn't express, then widen. The unbuilt part of the graph is
free to change; the built part is not.

## What GP must produce

**One derived artifact: `architecture.json`.** `.glyph` stays as GP's native
save (UI-shaped: coordinates, viewports, undo). `architecture.json` is a clean
graph with no layout — Hephaestus doesn't care where boxes sit (the picture is
for you).

```jsonc
// Format version 1, as GP v1.5 writes it (ADR 0013). Revised from the
// original proposal: GP's own kind words, folders' contents, wire ends as
// {node, pip, label}, port crossings marked, a warnings list, no interfaces.
{
  "format": "glyph-palette/architecture",
  "version": 1,
  "project": { "name": "Gateway Demo", "folder": "gateway-demo" },
  "nodes": [
    {
      "id": "n1/n2",                   // the placement's chain of node ids
      "name": "auth",
      "parent": "n1",                  // containing node — rebuilds the tree
      "kind": "file",                  // "folder" | "file" | "external"
      "path": "gateway-demo/auth.py",  // from the slugs; user-overridable
      "language": "python",            // effective; null if unset (warned)
      "layer": "component",
      "definition": "def-…",           // shared by every copy of the same part
      "description": "Validates inbound JWTs; rejects expired or malformed.",
      "constraints": ["no DB access", "pure function of the token + a public key"]
    },
    { "id": "n1", "name": "API Gateway", "parent": null, "kind": "folder",
      "contents": "drawn",             // or "ai": the AI decides what goes inside
      "path": "gateway-demo", "language": "python", "layer": "container", "definition": "def-…" },
    { "id": "n9", "name": "Database", "parent": null, "kind": "external",
      "layer": "container", "definition": "def-…",
      "description": "Postgres, owned by the platform team" }   // no path, no language
  ],
  "edges": [
    { "from": { "node": "n1/n3", "pip": "pip-…", "label": "Verify" },
      "to":   { "node": "n1/n2", "pip": "pip-…", "label": "Tokens" },
      "kind": "import", "transport": "In-process", "style": "Import" },
    { "from": { "node": "n1", "pip": "pip-db", "label": "DB" },
      "to":   { "node": "n9", "pip": "pip-…", "label": "SQL" },
      "kind": "transport", "transport": "TCP", "style": "SQL" },
    // a wire drawn inside API Gateway to its Outbound port: an edge to the
    // parent, port-marked, on the same pip id as the outer wire above
    { "from": { "node": "n1/n4", "pip": "pip-…", "label": "Queries" },
      "to":   { "node": "n1", "pip": "pip-db", "label": "DB", "port": true },
      "kind": "transport", "transport": "TCP", "style": "SQL" }
  ],
  "warnings": []
}
```

Flat node list + flat edge list. `parent` pointers reconstruct the tree.
One node per *placement*: a part placed twice is built twice.

What Hephaestus derives from it (GP does **not** produce these — they are
generated from the file above):

| Hephaestus use | derived from |
|---|---|
| build order | topological sort of `kind:"file"` nodes over `import`/`call` edges, leaves first |
| neighbour context for a contract | edges touching a node |
| node brief for the AI design pass | node + its in/out edges (and their kinds) + `description` + `constraints` |
| drift detection | `import` edges (drawn) vs the real `ast` import graph, matched by `path` |

## Changes to GP

### Tier 1 — required for Hephaestus to consume anything

1. **Separate display name from path slug.** Add `slug` to `NodeDefinition`
   (filesystem-safe, default = slugify(`name`), editable in DefinitionWizard).
   "API Gateway" → `gateway`. You think in prose; the filesystem needs slugs;
   don't make the name pay for that.
2. **`external: boolean` on `NodeDefinition`** (default `false`). Internet,
   Firewall, Database, a third-party API — drawn for context, never built.
3. **Node `kind`, mostly derived:**
   - `external` if `external === true`
   - else `dir` if the definition has a non-empty inner canvas
   - else `file`
   Add `language` to `NodeDefinition` for `file` nodes (`"python"`,
   `"typescript"`, …). Allow overriding the computed `path` per node when the
   node ↔ file mapping isn't 1:1.
4. **"Export for Hephaestus" action** → `architecture.json` as specified above.

### Tier 2 — required for the output to actually be yours

5. **`description` and `constraints` on `NodeDefinition`.** One sentence of
   purpose + a short "do not" list. Prose, written by you. Feeds the node brief.
   This is architecture, not a slow IDE — the moment it's parameter lists,
   you've crossed the line.
6. **Edge kind.** `kind: "transport" | "import" | "call"`, worked out from
   each wire's style (v1.5; see `docs/DECISIONS.md`). *Interface names were
   dropped from GP on 2026-10-02 — the AI's design pass names what crosses
   each seam.*

### Tier 3 — defer until a file-level slice runs end to end

- Function level (C4 "Code"). Prove file level first.
- Persistent user library / promoting recurring definitions to defaults.
- In-GP lint: "buildable node with no path", "import cycle", "buildable subtree
  reachable by two instance paths" (see edge cases).

## Path & kind derivation

Walk from `canvas-root`. For each `NodeInstance`, resolve its `NodeDefinition`:

- `external` → emit node, no `path`, no `language`.
- `dir` (has inner canvas) → path segment = `slug`; recurse into
  `definition.canvasId`, prefixing child paths with this segment.
- `file` (no inner canvas) → `path = <accumulated segments>/<slug>.<ext>` where
  `<ext>` comes from `language` (`python`→`.py`, `typescript`→`.ts`).

Edges: a `Relationship` inside a canvas connects two `NodeInstance`s in that
canvas → one export edge, `kind` from the wire's style, and the transport /
style names for transport edges. When a container was collapsed, its `pipMap` traces an inherited
(subsystem-level) pip back to the specific inner node — keep that so a
subsystem edge can later be resolved to the file it actually terminates at.

## The first slice (concrete target)

Draw exactly this, export it, hand `architecture.json` back to Hephaestus:

- `API Gateway` — a `dir` node (`slug: gateway`), expand it. Inside:
  - `auth` — `file`, python, `description` + `constraints`
  - `tokens` — `file`, python
  - `router` — `file`, python
  - `import` edges: `router → auth`, `auth → tokens`
- `Database` — `external` node at the subsystem level
- one `transport` edge `API Gateway → Database`, protocol `SQL`

No function level. No full library. ~4 buildable nodes.

## Sequence — what happens after GP is done

1. **This session's job (GP):** Tier 1 + Tier 2, then draw + export the slice
   above.
2. **Hephaestus v0.6:** built *against that real `architecture.json`*, not a
   hypothesis — `harness/graph/` (load + validate, topo-sort → build order,
   node-brief generator, drift), `harness build-order` / `harness drift`
   commands, order wired into `implement_many`.
3. Run the slice through `harness design` → `harness implement` in order. See
   what the diagram couldn't express. Revise this format. Widen.

**The format above is a proposal.** Drawing the slice is likely to reveal it's
wrong somewhere — that is the reason for doing one slice before building the
harness side. Change it here and note why.

## Known edge cases / open questions

- **Instance reuse.** GP allows the same definition to be instantiated twice.
  For code nodes that produces two paths for one subtree. For the first slice
  everything is a singleton; longer term GP should warn when a buildable subtree
  is reachable by more than one instance path.
- **`dir` nodes in the export** currently carry a `path` segment only implicitly
  (via children). Decide whether Hephaestus needs an explicit directory entry
  (probably only if drift wants to report directory-level structure).
- **Cross-language seams.** A Python service ↔ TS frontend edge: the design doc
  says the contract there is the *wire format* (one JSON Schema, generate both
  sides), not two hand-drawn contracts. GP may eventually need a `kind: "wire"`
  edge. Out of scope for the first slice.
- **`call` edges within a file** — do they become the stub's internal structure
  verbatim, or hints? Resolve when you first draw a function-level node.
