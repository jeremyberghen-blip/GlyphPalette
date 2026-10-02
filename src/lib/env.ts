// Where GP is running: the desktop app or a plain browser, and a dev build
// (hot-reloading, from a launcher) or the installed release.

export const isTauri = () =>
  typeof (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ !==
  "undefined";

/** True when running from a dev server (GP Dev Mode, or the browser preview); false in the installed app. */
export const IS_DEV_BUILD = import.meta.env.DEV;

/** The app's name as the window title shows it: the installed app, or the dev copy. */
export const APP_NAME = IS_DEV_BUILD ? "GP Dev Mode" : "Glyph Palette";
