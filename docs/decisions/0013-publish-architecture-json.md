# 0013: Publish — `architecture.json`, connection kinds, and purpose

Date: 2026-10-02
Status: Accepted

## Context

Project Hephaestus builds code from a GP design. v1.3 gave every node the
facts it needs to be built (slug, Folder/File/External, language, paths —
[ADR 0011](0011-build-facts-and-paths.md)); v1.5 is the hand-off itself.
`HEPHAESTUS-INTEGRATION.md` proposed a format and three more facts: edge
kinds, interface names, and per-node description and constraints.

While planning (2026-10-02) the user restated the goal: a **balance** —
decide the shape and architecture yourself and leverage the AI's
intelligence for the rest; control too tightly and there's no point using
an LLM. They answer for finished work regardless of who wrote it. That
moved **interface names** (the symbols crossing each seam) from GP to
Hephaestus's design pass, and the spec was rewritten to match.

## Decision

**Connection kinds, derived — not set per wire.** A wire's kind comes from
its style: Import → `import`, Call → `call` (standard styles carry `kind`);
anything else on the In-process transport → `call`; everything else →
`transport`. Import and call stay distinct, exactly as drawn. Custom styles
can be marked Import or Call in the "+ New style" form (`ApiStyle.kind`).

**Description and constraints on definitions** — prose for what a part is
for, and short rules it must keep (one per line). Per definition, copied by
Duplicate / Permute / Import; standard nodes have none. Shown in the hover
cards.

**Publish writes `architecture.json`, format version 1** (`lib/architecture.ts`,
pure). Never read back by GP; regenerated on every Publish.
- `nodes`: one per *placement* (a definition placed twice appears twice),
  id = the placement's chain of node ids. `kind` is GP's own vocabulary —
  `folder` / `file` / `external` — with `contents: "drawn" | "ai"` on
  folders; plus `parent`, `path`, effective `language` (null when unset),
  `layer`, `definition`, `description`, `constraints`.
- `edges`: every wire **as drawn**, once per placement of its canvas, with
  `kind`, `transport` and `style` names, and each end as `{node, pip,
  label}` — the pip labels are the user's own words for the connection,
  kept as context. A wire to a port becomes an edge to the parent node with
  `port: true` on that end; the pip id is the parent's, so a chain can be
  followed across levels. GP doesn't resolve chains.
- Collapsed groups dissolve: their contents become children of the group's
  parent, and wires into a group follow its pip map to the inner node.
- Left out: port nodes, anything inside an External node, and the
  reference sketch inside a File.
- `warnings`: missing languages (files and AI-decided folders), path
  clashes, a drawn design placed more than once, skipped broken wires.
  Problems never block Publish; they're listed in the file and in a
  summary shown afterwards.

## Consequences

- Hephaestus can derive build order (topological sort over import/call
  edges), node briefs (node + edges + description + constraints), and
  later drift checks, from one file.
- No interface names: Hephaestus's design pass names what crosses each
  seam, guided by kinds, pip labels, and descriptions. If that proves too
  loose in the first slice, names can come back as an optional field.
- The format is a first version, written before Hephaestus reads it; v2.0
  (the first real slice) is where it gets revised against real use.
- Edge counts grow with placements: a shared interior's wires repeat once
  per placement, which is what gets built.
