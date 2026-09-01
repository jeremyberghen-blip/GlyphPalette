# Glyph Palette → Hephaestus integration

> Handoff note from a Project Hephaestus session (2026-08-29). Read this before
> changing GP's data model or adding an export. The goal of the changes below is
> to let GP drive an AI code-generation pipeline (Hephaestus) **without GP
> becoming a slow IDE.**

## Why this exists

The point of the pipeline is *"I made this **with** AI"*, not *"I had AI make
this for me."* The difference is direct human decision-making in the process —
that is what grounds the claim to the output.

Metaphor: **GP's output is piping. The AI writing code is water flowing through
it.** GP is where you architect the system and record it in a form an AI can
build from. You own the pipe layout and the direction of flow. The AI owns what
flows through — the implementation detail.

Consequence for the data model: **the fidelity of the GP → contract translation
is the agency mechanism.** If GP exports something lossy, the AI's design pass
fills the gap with *its own* architecture reasoning and the structure stops
being yours. If GP exports something faithful, the AI only fills interface
detail *inside the shape you drew*. So the translation should be as mechanical
as possible.

The line to hold: a pipe has a **labelled flange** ("the auth seam is here,
it's called `verify_token`"), not a **specified flow rate** (parameter lists,
error types, test cases). Naming the seam is architecture. Specifying the
signature is the AI's job — put it in GP and GP becomes a slow IDE.

Ownership split (from the Hephaestus design doc §4.1):

| You own | The AI's design pass owns |
|---|---|
| decomposition (which files exist) | exact signatures |
| dependency direction | error types |
| the seams and what crosses them (interface *names*) | test cases |
| purpose and constraints, in prose | implementation |

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
{
  "version": 1,
  "nodes": [
    {
      "id": "n_auth",
      "path": "src/gateway/auth.py",   // computed from the trail of slugs; user-overridable
      "kind": "file",                  // "file" | "dir" | "external"
      "language": "python",            // file nodes only
      "parent": "n_gateway",           // containing node id — rebuilds the tree
      "description": "Validates inbound JWTs; rejects expired or malformed.",
      "constraints": ["no DB access", "pure function of the token + a public key"]
    },
    {
      "id": "n_tokens", "path": "src/gateway/tokens.py",
      "kind": "file", "language": "python", "parent": "n_gateway"
    },
    {
      "id": "n_db", "kind": "external",
      "description": "Postgres, owned by the platform team"
      // no path, no language — not built
    }
  ],
  "edges": [
    {
      "from": "n_auth", "to": "n_tokens",
      "kind": "import",                 // "transport" | "import" | "call"
      "interface": ["decode", "PublicKey"]   // symbol names crossing the seam
    },
    {
      "from": "n_gateway", "to": "n_db",
      "kind": "transport",
      "protocol": "SQL"                 // for transport edges: the pip-type name
    }
  ]
}
```

Flat node list + flat edge list. `parent` pointers reconstruct the tree.

What Hephaestus derives from it (GP does **not** produce these — they are
generated from the file above):

| Hephaestus use | derived from |
|---|---|
| build order | topological sort of `kind:"file"` nodes over `import`/`call` edges, leaves first |
| neighbour context for a contract | edges touching a node |
| node brief for the AI design pass | node + its in/out edges + `interface`s + `description` + `constraints` |
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
6. **Edge kind + interface names.** Cleanest implementation: add
   `kind: "transport" | "import" | "call"` to `PipType` (default `"transport"`).
   A relationship inherits its kind from its `typeId`. For `import`/`call` edges
   the pip **label** carries the symbol name (`verify_token`); add one seed pip
   type `"symbol"` so `canConnect` still type-matches. You only draw the pips
   that cross a boundary — not every function. GP could validate that the
   from-pip label (exporting side) matches the to-pip label (importing side).

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
canvas → one export edge, `kind` from the relationship's pip type,
`interface` = the two pip labels (dedup), `protocol` = pip-type name for
transport. When a container was collapsed, its `pipMap` traces an inherited
(subsystem-level) pip back to the specific inner node — keep that so a
subsystem edge can later be resolved to the file it actually terminates at.

## The first slice (concrete target)

Draw exactly this, export it, hand `architecture.json` back to Hephaestus:

- `API Gateway` — a `dir` node (`slug: gateway`), expand it. Inside:
  - `auth` — `file`, python, `description` + `constraints`
  - `tokens` — `file`, python
  - `router` — `file`, python
  - `import` edges: `router → auth`, `auth → tokens` (interface labels on each)
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
