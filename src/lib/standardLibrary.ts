// The standard library: node definitions and pip types that ship with Glyph
// Palette. Read-only and always present in every project, alongside the
// project's own definitions. Stored as an ordinary `.glyph` file with an empty
// canvas — a library is just a project you draw definitions from.

import raw from "./standard.glyph?raw";
import { NodeDefinition, PipType } from "../types";

export interface Library {
  pipTypes: Record<string, PipType>;
  definitions: Record<string, NodeDefinition>;
}

const file = JSON.parse(raw) as Library;

export const STANDARD: Library = {
  pipTypes: file.pipTypes,
  definitions: file.definitions,
};

/** True for a standard-library definition (not editable in place). */
export const isStandardDef = (id: string): boolean => id in STANDARD.definitions;

export const isStandardPipType = (id: string): boolean => id in STANDARD.pipTypes;
