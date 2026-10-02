# 0012: An installed stable app beside a dev-mode work copy

Date: 2026-10-01
Status: Accepted

## Context

Until v1.4, GP only ran in dev mode (`launch.bat` → `npm run tauri dev`): a
Vite dev server hot-reloading the UI into a debug build. That's the copy
the user worked in, and it's also the copy Claude edited — so every edit
reached the user's live session. A store edit froze it (2026-09-30), and
even editing `docs/` reloaded it into a blank project, because Tailwind v4
scanned every file in the repo for class names and its Vite plugin reloads
the page when a scanned non-module file changes. The working rule became
"close GP before Claude builds", with a git worktree as a workaround.

An installer had been deferred until after v2.0 (2026-09-29). The user
proposed keeping a stable build and a dev build apart instead (2026-10-01).

Branches alone don't separate running copies — a branch is history, not a
running app — and installers don't belong in the repository (it's public or
private as a whole, and binaries bloat it).

## Decision

**Two copies, two jobs.**
- **Glyph Palette** — the installed app, built from `master` as a standard
  NSIS `setup.exe` (per-user, unsigned). The user's everyday tool. A
  release build has no dev server, so nothing Claude edits can touch it.
- **GP Dev Mode** — the work copy (a git worktree at
  `C:\Projects\GlyphPalette-work`), launched by `launch-dev.bat` with
  `src-tauri/tauri.devmode.conf.json`: port 1440 (so it runs alongside),
  its own app identity (`com.heroo.glyph-palette.dev`, so settings and
  window state never mix with the installed app's), "GP Dev Mode" in the
  window title, and a DEV badge in the top bar. Claude builds here; the
  user tests features here; it hot-reloads by design.

**Release flow.** Finish a version on a branch in the work copy → merge
into `master` → tag `vX.Y.Z` → build the installer from that state → publish
it. Installers are never committed. *How* releases are published on GitHub
is an open question the user wants to discuss (see `DECISIONS.md`); until
then the installer is built locally and handed over.

**Reload safety, for the dev copy.** Tailwind scans only `src/`
(`@import "tailwindcss" source(".")` in `App.css`), so doc edits no longer
reload anything; and GP reopens the project last opened or saved on
startup (a note if it moved), so a reload — or a restart — comes back to
the work instead of a blank project.

**Unsigned, for now.** A code-signing certificate costs money yearly;
without one Windows SmartScreen shows "unknown publisher" (More info → Run
anyway). The warning judges the file, not where it was found, so it
appears even for a download from the user's own GitHub page; reputation
builds as a signed publisher's downloads accumulate. Revisit if GP is
distributed to others.

## Consequences

- Claude can build while the user works; the "close GP first" rule now
  only applies to merging into `master` while the user runs `master` in
  dev mode (`launch.bat`), which the installed app replaces.
- Updates are manual: install each release's `setup.exe` over the last
  (no auto-updater yet — Tauri's updater plugin is the path if wanted).
- The release build path is now exercised; anything that only worked
  under the dev server shows up there.
- Two settings files (installed and dev). The dev copy's first launch
  compiles its own Rust build (several minutes).
