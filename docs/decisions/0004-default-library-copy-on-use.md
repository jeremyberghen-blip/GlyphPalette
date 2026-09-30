# 0004: Default library, split from the project file, copy-on-use

Date: 2026-08-30
Status: Superseded by [0008](0008-project-owned-library.md)

## Context

Before this decision, every node definition and pip type — built-in seed
data and anything the user created — lived inside the single project's
`.glyph` file (`ProjectFile.definitions` / `.pipTypes`). That meant:

- No definition survived past the project it was created in. A "Postgres"
  definition tuned once had to be rebuilt by hand in every new project.
- There was no seed content organized by [layer](0003-c4-layer-system.md) —
  the palette had nothing useful to show without the user building it first.

The user wanted reusable defaults *without* projects silently sharing state:
editing a definition in one project should never change what another project
already has, and a project file opened on a different machine shouldn't
break because it's missing library content.

## Decision

- **`SEED_LIBRARY`** (`src/lib/defaultLibrary.ts`) is the built-in fallback:
  ~25 definitions spread across all four layers, plus 10 pip types.
- **The live default library** (`src/lib/library.ts`) is a per-machine,
  user-editable file: `%APPDATA%\glyph-palette\library.json` under Tauri,
  `localStorage` in the browser dev preview. Seeded from `SEED_LIBRARY` on
  first run, then persists whatever the user edits or promotes into it.
- **Binding is copy-on-use, not a live reference.** A library definition
  shown in the palette is tagged in `defaultLibraryIds`. The moment it's
  *placed* (`addNode`), *edited* (`saveDefinition`), or *drawn into*
  (`enterDefinition` creating its first inner canvas), it's adopted: the id
  drops out of `defaultLibraryIds` and a full copy becomes part of the
  project from then on.
- `serializeProject` writes only adopted (project-owned) definitions.
  `loadProjectData` merges the current default library underneath whatever
  the file itself defines. Pip types are still written and merged in full
  (small, and relationships resolve them by id — see Consequences).
- A bookmark action, **"Save to the default library,"** copies a project
  definition back up into the shared library and persists it immediately.

## Consequences

- Projects stay portable: opening a `.glyph` file on another machine works
  even if that machine's default library differs, because every definition
  the project actually uses travels with the file.
- Editing a definition in one project never affects another project that
  hasn't adopted it — the isolation the user asked for.
- A library definition that's never placed, edited, or drawn into doesn't
  appear in the saved file at all, by design — it's a template, not project
  content, until something actually happens with it.
- Pip types are *not* filtered the same way — every pip type currently in the
  store gets written into every save. This is a known asymmetry, accepted
  for now because pip types are small and a missing one would silently break
  relationship rendering; revisit if it turns out to matter (see
  `ROADMAP.md`).
- Deleting a definition is disabled in the UI while it's still library-owned
  ("place or edit it to bring it into this project" is the only way to make
  it project-local and thus deletable).
