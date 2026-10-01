// Save-state logic: is the project dirty, is an autosave due, what to call it.
// Pure, so the timer and title bar are thin glue around tested functions.

/** The content slices a save captures. Compared by reference: the store never mutates them. */
export interface ContentRefs {
  canvases: unknown;
  definitions: unknown;
  transports: unknown;
  styles: unknown;
  customIcons: unknown;
}

export const contentRefs = (s: ContentRefs): ContentRefs => ({
  canvases: s.canvases,
  definitions: s.definitions,
  transports: s.transports,
  styles: s.styles,
  customIcons: s.customIcons,
});

/** True when content has changed since `saved`. Pan, zoom, and selection don't count. */
export function isDirty(current: ContentRefs, saved: ContentRefs): boolean {
  return (
    current.canvases !== saved.canvases ||
    current.definitions !== saved.definitions ||
    current.transports !== saved.transports ||
    current.styles !== saved.styles ||
    current.customIcons !== saved.customIcons
  );
}

/** Autosave interval choices in minutes; 0 means never. */
export const AUTOSAVE_CHOICES = [0, 1, 2, 5, 10, 15] as const;
export const DEFAULT_AUTOSAVE_MINUTES = 5;

/**
 * An autosave is due when autosave is on, the project has a file to save
 * into (untitled projects wait for their first manual save), there are
 * unsaved changes, and the interval has passed since the last save.
 */
export function autosaveDue(o: {
  now: number;
  lastSavedAt: number;
  intervalMinutes: number;
  dirty: boolean;
  hasFile: boolean;
}): boolean {
  return (
    o.intervalMinutes > 0 &&
    o.hasFile &&
    o.dirty &&
    o.now - o.lastSavedAt >= o.intervalMinutes * 60_000
  );
}

/** Display name for the open project: its file name, or "Untitled". */
export const projectLabel = (path: string | null): string =>
  path ? path.split(/[\\/]/).pop()! : "Untitled";

/** Window title, e.g. "Snip.glyph • — Glyph Palette". */
export const windowTitle = (path: string | null, dirty: boolean): string =>
  `${projectLabel(path)}${dirty ? " •" : ""} — Glyph Palette`;
