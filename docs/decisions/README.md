# Decision records

This directory holds Architecture Decision Records (ADRs) for Glyph Palette —
short documents that capture a design decision, the context that produced it,
and what it costs. They exist so a decision doesn't have to be re-derived (or
accidentally re-litigated) months later.

## When to add one

Add an ADR when a decision changes the data model, reshapes a core mechanism,
or forecloses an alternative someone might reasonably propose again later.
Don't write one for routine bug fixes, refactors that don't change behavior,
or UI tweaks — those belong in [`CHANGELOG.md`](../CHANGELOG.md) instead.

## Format

```
# NNNN: Title

Date: YYYY-MM-DD
Status: Accepted | Superseded by NNNN | Deprecated

## Context
What situation forced a decision, and what the alternatives were.

## Decision
What was decided, stated plainly.

## Consequences
What this makes easier, what it makes harder, and what it forecloses.
```

Numbers are sequential and never reused, even for a superseded record — leave
it in place with an updated `Status` line so history stays readable.

## Index

| # | Title | Status |
|---|---|---|
| [0001](0001-node-boundary-relationship-model.md) | Node / Boundary / Relationship model | Accepted |
| [0002](0002-container-to-boundary-rename.md) | Rename Container → Boundary | Accepted |
| [0003](0003-c4-layer-system.md) | C4 layer system on canvases and definitions | Accepted |
| [0004](0004-default-library-copy-on-use.md) | Default library, split from the project file, copy-on-use | Accepted |
| [0005](0005-defer-hephaestus-integration.md) | Defer Project Hephaestus integration | Accepted |
| [0006](0006-versioning-and-git.md) | Start versioning at v1.0.0; adopt git | Accepted |
