# 0006: Start versioning at v1.0.0; adopt git

Date: 2026-09-01
Status: Accepted

## Context

The project had accumulated a full feature set — the core model, the C4
layer system, the default library, a working launcher — entirely without
version control or a version number past the Tauri template's default
`0.1.0`. That's a real risk at this point: no way to diff, no way to revert a
bad change, no record of what shipped when, and no documented reasoning for
any of the decisions above beyond conversation history.

## Decision

- Initialize a git repository at the project root and commit the current
  state as the first commit, tagged `v1.0.0`.
- Set `version` to `1.0.0` in `package.json`, `package-lock.json`,
  `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`, and
  `src-tauri/tauri.conf.json` — the current build, not a future milestone,
  is v1.0. It represents a complete, working tool: the full node/boundary/
  relationship model, layered library, persistence, and launcher.
- Track future work as versions in `ROADMAP.md`, each either slated to a
  specific upcoming version or left in an unscheduled backlog. Record
  decisions that change the data model or a core mechanism as numbered ADRs
  in `docs/decisions/`, following this file as the first one written
  retroactively for the git/versioning decision itself and the four
  preceding it for the work already done.

## Consequences

- History before this commit (the 2026-08-09 through 2026-08-30 design and
  build work) has no git record — it's reconstructed here and in the ADRs
  above from session memory, not from diffs. Treat those ADRs' dates as
  accurate but their content as a summary, not a literal diff.
- From this point on, features and fixes should land as commits with
  messages that reference the relevant ADR or roadmap item where one exists.
- `src-tauri/target/` and `node_modules/` are gitignored (already covered by
  the existing root and `src-tauri/.gitignore`) — the repository tracks
  source and config, not build output.
