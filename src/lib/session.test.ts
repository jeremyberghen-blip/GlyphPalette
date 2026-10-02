import { describe, expect, it } from "vitest";
import { autosaveDue, contentRefs, glyphFileName, isDirty, projectLabel, windowTitle } from "./session";

describe("isDirty", () => {
  const state = { projectName: "Snip", canvases: {}, definitions: {}, transports: {}, styles: {}, customIcons: {} };

  it("is clean right after a save", () => {
    expect(isDirty(state, contentRefs(state))).toBe(false);
  });

  it("notices any content slice being replaced", () => {
    const saved = contentRefs(state);
    expect(isDirty({ ...state, canvases: {} }, saved)).toBe(true);
    expect(isDirty({ ...state, definitions: {} }, saved)).toBe(true);
    expect(isDirty({ ...state, transports: {} }, saved)).toBe(true);
    expect(isDirty({ ...state, styles: {} }, saved)).toBe(true);
    expect(isDirty({ ...state, customIcons: {} }, saved)).toBe(true);
  });

  it("counts renaming the project as a change", () => {
    const saved = contentRefs(state);
    expect(isDirty({ ...state, projectName: "Snip" }, saved)).toBe(false);
    expect(isDirty({ ...state, projectName: "Snip 2" }, saved)).toBe(true);
  });

  it("ignores non-content state like the viewport", () => {
    const saved = contentRefs(state);
    expect(isDirty({ ...state, viewport: { x: 5 } } as typeof state, saved)).toBe(false);
  });
});

describe("autosaveDue", () => {
  const base = { now: 10 * 60_000, lastSavedAt: 0, intervalMinutes: 5, dirty: true, hasFile: true };

  it("fires once the interval has passed with unsaved changes", () => {
    expect(autosaveDue(base)).toBe(true);
    expect(autosaveDue({ ...base, now: 4 * 60_000 })).toBe(false);
  });

  it("never fires when set to never, when clean, or before a first manual save", () => {
    expect(autosaveDue({ ...base, intervalMinutes: 0 })).toBe(false);
    expect(autosaveDue({ ...base, dirty: false })).toBe(false);
    expect(autosaveDue({ ...base, hasFile: false })).toBe(false);
  });
});

describe("labels", () => {
  it("names the file, or Untitled", () => {
    expect(projectLabel("C:\\Users\\me\\Desktop\\Snip.glyph")).toBe("Snip.glyph");
    expect(projectLabel("/home/me/Snip.glyph")).toBe("Snip.glyph");
    expect(projectLabel(null)).toBe("Untitled");
  });

  it("titles the window with the project name, marking unsaved changes", () => {
    expect(windowTitle("Snip", true)).toBe("Snip • — Glyph Palette");
    expect(windowTitle("Untitled", false)).toBe("Untitled — Glyph Palette");
  });

  it("names the dev copy in its title, so it can't be mistaken for the installed app", () => {
    expect(windowTitle("Snip", false, "GP Dev Mode")).toBe("Snip — GP Dev Mode");
  });

  it("suggests a safe file name from the project name", () => {
    expect(glyphFileName("Snip")).toBe("Snip.glyph");
    expect(glyphFileName("Snip: v2 / beta")).toBe("Snip v2 beta.glyph");
    expect(glyphFileName("  ...  ")).toBe("project.glyph");
  });
});
