// Text fitting for canvas labels.

/** True when `text` measured by `measure` is wider than `maxWidth` (so it gets an ellipsis). */
export function isTruncated(text: string, maxWidth: number, measure: (t: string) => number): boolean {
  return measure(text) > maxWidth;
}
