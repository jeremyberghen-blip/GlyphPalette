import { describe, expect, it } from "vitest";
import { autosaveDue, contentRefs, isDirty, projectLabel, windowTitle } from "./session";

describe("isDirty", () => {
  const state = { canvases: {}, definitions: {}, pipTypes: {}, customIcons: {} };

  it("is clean right after a save", () => {
    expect(isDirty(state, contentRefs(state))).toBe(false);
  });

  it("notices any content slice being replaced", () => {
    const saved = contentRefs(state);
    expect(isDirty({ ...state, canvases: {} }, saved)).toBe(true);
    expect(isDirty({ ...state, definitions: {} }, saved)).toBe(true);
    expect(isDirty({ ...state, pipTypes: {} }, saved)).toBe(true);
    expect(isDirty({ ...state, customIcons: {} }, saved)).toBe(true);
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
  it("names the project after its file, or Untitled", () => {
    expect(projectLabel("C:\\Users\\me\\Desktop\\Snip.glyph")).toBe("Snip.glyph");
    expect(projectLabel("/home/me/Snip.glyph")).toBe("Snip.glyph");
    expect(projectLabel(null)).toBe("Untitled");
  });

  it("marks unsaved changes in the window title", () => {
    expect(windowTitle("C:\\x\\Snip.glyph", true)).toBe("Snip.glyph • — Glyph Palette");
    expect(windowTitle(null, false)).toBe("Untitled — Glyph Palette");
  });
});
