import { describe, expect, it } from "vitest";
import { isTruncated } from "./text";

// Fake measurer: 8px per character
const measure = (t: string) => t.length * 8;

describe("isTruncated", () => {
  it("is false for names that fit and true for names that don't", () => {
    expect(isTruncated("Cache", 112, measure)).toBe(false);
    expect(isTruncated("Safe Browsing Client", 112, measure)).toBe(true);
  });

  it("treats an exact fit as fitting", () => {
    expect(isTruncated("x".repeat(14), 112, measure)).toBe(false);
  });
});
