// The standard library: node definitions, transports, and API styles that
// ship with Glyph Palette. Read-only and always present in every project,
// alongside the project's own. Stored as an ordinary `.glyph` file with an
// empty canvas — a library is just a project you draw definitions from.

import raw from "./standard.glyph?raw";
import { ApiStyle, NodeDefinition, Transport } from "../types";

export interface Library {
  transports: Record<string, Transport>;
  styles: Record<string, ApiStyle>;
  definitions: Record<string, NodeDefinition>;
}

const file = JSON.parse(raw) as Library;

export const STANDARD: Library = {
  transports: file.transports,
  styles: file.styles,
  definitions: file.definitions,
};

/** True for a standard-library definition (not editable in place). */
export const isStandardDef = (id: string): boolean => id in STANDARD.definitions;
