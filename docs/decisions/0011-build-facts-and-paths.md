# 0011: Build facts on definitions, and derived build paths

Date: 2026-10-01
Status: Accepted

## Context

Project Hephaestus will turn a GP diagram into code (the `architecture.json`
export is v1.5; see [ADR 0005](0005-defer-hephaestus-integration.md)). For
that, every node needs to say what it builds as and where: a folder or a
file, in which language, under which name — and some nodes (Person, a
third-party API, a hosted queue) aren't built at all. None of this was in
the model, and with the Code layer retired ([ADR 0007](0007-retire-code-layer-and-pockets.md))
GP stops at the component level: an undrawn interior is the AI's to fill,
not "make it one file".

Paths can't be stored per definition: a definition's interior is shared by
reference, so one definition placed twice builds twice, under two paths.

## Decision

**Four facts on every definition**, set in the node dialog and carried by
Duplicate, Permute, and Import:

- **Slug** — the canonical file-safe name, always snake_case (accents and
  symbols dropped, camelCase split, a leading digit gets `_`). Derived from
  the name, so renames follow, and stored only once typed. A copy never
  inherits a typed slug (two copies would claim one file).
- **External** — managed by someone else or outsourced, never built; drawn
  in a muted stone color instead of slate (never red, which means broken).
  Everything inside an external node is external. In the standard library:
  Person, External System, Internet, Firewall, Cache, Message Queue, Object
  Store. A database you design is buildable; its engine is just what it
  runs on.
- **Kind** — Folder (default) or File. A folder whose interior isn't drawn
  (or holds only ports) has its contents decided by the AI. A File's drawn
  interior is a reference sketch and isn't built.
- **Language** — inherited from the nearest ancestor by default; none set
  anywhere means unspecified (the export flags it rather than guessing).
  Python, TypeScript, JavaScript, Go, Rust, Ruby, Java, C#, Kotlin, Swift,
  SQL. Names follow each language's conventions, converted from the slug
  when paths are built:

  | Language | Files | Folders |
  |---|---|---|
  | Python, Rust, Ruby, SQL | `link_service.py` | `link_service` |
  | TypeScript, JavaScript | `link-service.ts` | `link-service` |
  | Go | `link_service.go` | `linkservice` |
  | Java, Kotlin | `LinkService.java` | `linkservice` |
  | C#, Swift | `LinkService.cs` | `LinkService` |

**Paths are derived, never stored** (`buildPlan` in `src/lib/paths.ts`, pure).
Walking down from the top canvas, each buildable folder adds its name in its
language's convention and a file ends the path with name + extension.
Externals and sketches get no path; pockets and port nodes add nothing (a
pocket's contents belong to the canvas around it). The result is one
*placement* per route through the tree, so a node inside a shared interior
has several.

- **Project folder:** projects have a name, saved in the `.glyph` (older
  files take it from the file name). Every path starts with its kebab-case
  slug (`Snip App` → `snip-app/`) — the convention most repositories use,
  whatever their language.
- **One top-level system adds no folder:** when the top canvas (pockets
  unfolded) has exactly one buildable folder, the project folder plays its
  role; with several, each gets a subfolder.
- **Overrides** are per placed node (`NodeInstance.pathOverride`): a full
  path from the project folder, cleaned up (separators unified, `.`/`..`
  and characters filesystems reject dropped, casing kept). A folder's
  children build on its overridden path. Typing the automatic path back in
  is no override, so it keeps following renames. Paste drops an override
  (the copy would clash at once); collapsing and expanding a group keep it.

Where each placement is shown: the hover card on a placed node shows the
placement reached through the current breadcrumbs, plus warnings for path
clashes (case-insensitive), one drawn design built under several paths, and
other placements of the same node.

## Consequences

- The export (v1.5) gets slugs, kinds, languages, and paths from one tested
  function rather than re-deriving them.
- An override on a node inside a shared interior applies to every placement
  of it — they all land on one path and clash. The override dialog warns
  when that's the case; per-placement overrides would need placement
  identity the model doesn't have.
- React component files (`LinkService.tsx`) can't be told apart from other
  TypeScript; a typed slug covers them.
- v1.0 files that forked a standard node (e.g. renamed Cache) give the fork
  the standard node's facts on load, since those files predate them.
- Full lint (unwired ports, unspecified languages across the project) is
  still on the Backlog; v1.3 only surfaces problems per node.
