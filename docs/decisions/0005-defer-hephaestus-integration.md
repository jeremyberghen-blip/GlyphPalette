# 0005: Defer Project Hephaestus integration

Date: 2026-08-30
Status: Accepted

## Context

Glyph Palette was always meant to feed Project Hephaestus, an AI
code-generation pipeline: GP draws the architecture, Hephaestus's design pass
fills in implementation detail inside the shape GP drew (full rationale in
`HEPHAESTUS-INTEGRATION.md`, written from a Hephaestus session on 2026-08-29).
That document specifies a concrete near-term plan — Tier 1/2 changes to GP,
then drawing and exporting one thin vertical slice as `architecture.json`.

Reviewing that plan surfaced a separate, GP-native idea: mapping the
decomposition onto C4 layers would make the library dramatically easier to
navigate on its own merits, independent of Hephaestus. That idea only got
bigger once explored — layers, a real default library, the Context-level
seed ([0003](0003-c4-layer-system.md), [0004](0004-default-library-copy-on-use.md)).

## Decision

Do the GP-native maturation work first. Treat it as a deliberate "sidequest"
before returning to `HEPHAESTUS-INTEGRATION.md`'s Tier 1/2 plan and the first
slice. Reasoning: Hephaestus's harness-side work (`harness/graph/`, build
order, node-brief generation, drift detection) is meant to be built against a
*real* `architecture.json`, not a hypothesis — and the shape of that export
is more likely to be right, and to need fewer revisions, if GP's own model is
settled first. Building Hephaestus's graph tooling against a GP that's about
to change its data model out from under it would waste effort on both sides.

## Consequences

- Hephaestus's v0.6 harness work is blocked on this GP work being "enough" —
  not literally finished, but past the point where the export shape would
  need to change again for reasons internal to GP.
- The concrete next step, once this track resumes, is `HEPHAESTUS-INTEGRATION.md`
  Tier 1 (slug, `external` flag, `language`, path override) and Tier 2 (pip
  `kind`, interface names, the `architecture.json` export itself), then
  drawing and exporting the specified 4-node slice. See `ROADMAP.md` for
  where that's slated.
- This is a scope decision, not a technical one — nothing here changes what
  the eventual export needs to look like; it only changes the order of work.
