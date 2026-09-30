# 0008: The library belongs to the project; a read-only standard library

Date: 2026-09-29
Status: Accepted (supersedes [0004](0004-default-library-copy-on-use.md))

## Context

[ADR 0004](0004-default-library-copy-on-use.md) split definitions into a
per-machine default library (`library.json` in the app data dir) and the
project file, with copy-on-use adoption: placing or editing a library node
copied it into the project. In use (the Snip test run) this had costs:

- Renaming a seed in place (Database → Links DB) shadowed the library entry by
  id, so the generic Database vanished from that project's palette.
- Sharing nodes between projects meant promoting them one by one into the
  per-machine library, which is invisible, machine-bound state.
- A two-tier "standard + one swappable current library" design was worked
  out and then dropped: it needed backup copies of every used definition in
  each project, an orphan section in the palette, and per-node "add to
  library" buttons, all to handle a library that doesn't contain what's on
  the canvas.

The user's per-machine library turned out to hold only the 25 seeds, so
nothing of theirs depended on it.

## Decision

- **Standard library:** ships with GP as `src/lib/standard.glyph` (an
  ordinary project file with an empty canvas), is read-only, and is always
  present. Its nodes show no edit or delete — only Duplicate and Permute,
  which make project copies.
- **Project library:** each `.glyph` owns its other definitions and pip
  types. The file writes only those; the standard library is merged back
  underneath on load. An interior drawn inside a standard node is kept per
  project in `standardInteriors`.
- **Import from another project:** pick any `.glyph` and choose definitions
  to bring in. Interiors come across empty; needed pip types and custom icons
  come along; a clash on id or name gets the source project's name appended
  ("Links DB (Snip)"), then a number if still taken. There is no separate
  library file format — a curated library is just a `.glyph` of definitions.
- A fresh project's System node is the project's own copy ("My System"), so
  it can be renamed and given pips.
- **Migration:** in older files, an unedited copy of a seed (compared by
  name, icon, layers, and pip structure, ignoring pip labels) folds back into
  the standard node; an edited one gets a new id — its instances follow — so
  the standard node is available alongside it.
- The per-machine `library.json`, copy-on-use adoption, and "save to default
  library" are retired. (An existing `library.json` is left on disk, unused.)

## Consequences

- Missing definitions are impossible: a canvas can only use the standard
  library or the project's own definitions.
- A project file is self-contained apart from the standard library, which
  every copy of GP has.
- Reuse across projects is deliberate (import) rather than ambient; a fix
  made in one project doesn't reach others. That isolation was also the
  point of copy-on-use.
- Changing a standard node later (as v1.1 did, relabeling API Service's
  "HTTP" pip to "API") affects every project that uses it. Structural
  changes to standard nodes should be rare and backward-compatible.
- ADR 0004's note that pip types were written into every file in full no
  longer applies: only the project's own pip types are written.
