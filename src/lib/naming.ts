// Names for the filesystem. A definition's slug is its canonical file-safe
// name, always snake_case; when paths are built, it's converted to each
// language's own convention (LinkService.java, link-service.ts…). See
// DECISIONS.md, "Hephaestus groundwork (v1.3)".

import { NodeDefinition } from "../types";

export type LanguageId =
  | "python"
  | "typescript"
  | "javascript"
  | "go"
  | "rust"
  | "ruby"
  | "java"
  | "csharp"
  | "kotlin"
  | "swift"
  | "sql";

/** How a name is written: link_service, link-service, LinkService, linkservice. */
export type Convention = "snake" | "kebab" | "pascal" | "flat";

export interface LanguageInfo {
  name: string;
  /** File extension, with the dot. */
  ext: string;
  file: Convention;
  folder: Convention;
}

export const LANGUAGES: Record<LanguageId, LanguageInfo> = {
  python: { name: "Python", ext: ".py", file: "snake", folder: "snake" },
  typescript: { name: "TypeScript", ext: ".ts", file: "kebab", folder: "kebab" },
  javascript: { name: "JavaScript", ext: ".js", file: "kebab", folder: "kebab" },
  go: { name: "Go", ext: ".go", file: "snake", folder: "flat" },
  rust: { name: "Rust", ext: ".rs", file: "snake", folder: "snake" },
  ruby: { name: "Ruby", ext: ".rb", file: "snake", folder: "snake" },
  java: { name: "Java", ext: ".java", file: "pascal", folder: "flat" },
  csharp: { name: "C#", ext: ".cs", file: "pascal", folder: "pascal" },
  kotlin: { name: "Kotlin", ext: ".kt", file: "pascal", folder: "flat" },
  swift: { name: "Swift", ext: ".swift", file: "pascal", folder: "pascal" },
  sql: { name: "SQL", ext: ".sql", file: "snake", folder: "snake" },
};

export const LANGUAGE_IDS = Object.keys(LANGUAGES) as LanguageId[];

/**
 * A name as a snake_case slug: accents and symbols dropped, camelCase and
 * any separators split into words, lowercase, joined with `_`; a leading
 * digit gets a `_` prefix so it stays importable. Never empty.
 *   "Safe Browsing API (Snip)" → "safe_browsing_api_snip"
 *   "createLink()" → "create_link"
 */
export function slugify(name: string): string {
  const words = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // accents (combining marks)
    .replace(/([a-z])([A-Z])/g, "$1 $2") // camelCase → camel Case
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2") // HTTPServer → HTTP Server
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  const slug = words.join("_") || "node";
  return /^[0-9]/.test(slug) ? `_${slug}` : slug;
}

/** A definition's slug: the one typed into the node dialog, else derived from its name. */
export const slugOf = (def: Pick<NodeDefinition, "name" | "slug">): string => def.slug || slugify(def.name);

/** Writes a snake_case slug in a naming convention. */
export function convert(slug: string, convention: Convention): string {
  const lead = slug.startsWith("_") ? "_" : "";
  const parts = slug.split("_").filter(Boolean);
  switch (convention) {
    case "snake":
      return slug;
    case "kebab":
      return lead + parts.join("-");
    case "flat":
      return lead + parts.join("");
    case "pascal":
      return lead + parts.map((p) => p[0].toUpperCase() + p.slice(1)).join("");
  }
}

/** A file's name in a language: "link_service" + Java → "LinkService.java". */
export const fileName = (slug: string, lang: LanguageId): string =>
  convert(slug, LANGUAGES[lang].file) + LANGUAGES[lang].ext;

/** A folder's name in a language (no language: the plain slug). */
export const folderName = (slug: string, lang: LanguageId | undefined): string =>
  lang ? convert(slug, LANGUAGES[lang].folder) : slug;
