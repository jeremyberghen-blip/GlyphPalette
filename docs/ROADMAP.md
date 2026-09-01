# Roadmap

What v1.0.0 is, and where things go from here. Nothing below is a commitment
to build it, let alone on the version it's slated to — it's a place to put
plans so they don't only live in conversation. Move items between versions,
into Backlog, or out entirely as things change; that's the point of writing
it down instead of remembering it.

## v1.0.0 — current

The full node/boundary/relationship model, a C4 layer system (Context →
Container → Component → Code) with per-layer palette filtering, a
per-machine default library with copy-on-use adoption into projects,
persistence (`.glyph` save/load, undo, copy/paste, PNG export), and a dev
launcher. See [`ARCHITECTURE.md`](ARCHITECTURE.md) for the full shape and
[`decisions/`](decisions/) for how it got here.

## v1.1 — planned: GP polish

- Show the active layer in the breadcrumb trail and nav tree (currently only
  the library panel header shows it).
- Chase down the harmless Konva `drawImage` console warning (see
  `ARCHITECTURE.md` § Known rough edges) so dev console output is clean.
- Prove out the Code layer: decompose at least one File definition into
  Function/Class nodes on a real project, and see what the layer model gets
  wrong at that depth before relying on it.
- pip-type layer affinity, so a transport-kind pip (HTTP, SQL) isn't offered
  as an option on a Component-layer definition and vice versa.

## v1.2 — planned: Hephaestus Tier 1

From `HEPHAESTUS-INTEGRATION.md`'s tiered plan, the changes required before
GP can export anything Hephaestus can consume:

- `slug` on `NodeDefinition` (filesystem-safe name, editable, defaults from
  `name`).
- `external: boolean` on `NodeDefinition` (drawn for context, never built).
- Node `kind` (`external` / `dir` / `file`), mostly derived; `language` on
  file-kind definitions; per-node `path` override for non-1:1 node↔file
  mappings.

## v1.3 — planned: Hephaestus Tier 2

- Edge `kind` (`transport | import | call`) on `PipType`, inherited by a
  relationship from its pip type.
- Interface names (symbol labels) carried on `import`/`call` edges.
- The `architecture.json` export itself: flat node list + flat edge list,
  `parent` pointers reconstructing the tree, per `HEPHAESTUS-INTEGRATION.md`.

## v2.0 — future: first real slice

- Draw and export the concrete first slice specified in
  `HEPHAESTUS-INTEGRATION.md` (`API Gateway` → `auth`/`tokens`/`router` files,
  one `Database` external node, one `transport` edge).
- Hand `architecture.json` back to Hephaestus; revise the export format based
  on what the diagram couldn't express. Widen from there.
- Revisit [ADR 0004](decisions/0004-default-library-copy-on-use.md)'s pip-type
  write-everything behavior once a real cross-project workflow exists to
  stress it.

## Backlog — unscheduled

Real ideas, not currently slated to a version:

- Persistent user library promotion UI beyond the single "save to default
  library" button (browsing/editing the library outside a project context).
- In-GP lint: buildable node with no path, import cycle, a buildable subtree
  reachable by two instance paths (see `HEPHAESTUS-INTEGRATION.md`'s edge
  cases).
- Cross-language seams: a `kind: "wire"` edge for e.g. a Python service ↔ TS
  frontend boundary, where the contract is a wire format rather than a
  hand-drawn interface.
- `call` edges within a file — decide whether they become a generated stub's
  internal structure verbatim, or just hints, once the Code layer is proven.
- Cosmetic: the npm package (`glyph-scaffold`) and Cargo crate
  (`glyph_scaffold_lib`) still carry the Tauri template's scaffold name
  rather than `glyph-palette`. Renaming the Cargo side touches the binary
  name and crate references in `src-tauri/src/`; low priority, do it in a
  quiet moment rather than alongside a feature change.
