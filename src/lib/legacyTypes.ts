// Upgrading v1.0/v1.1 files, whose pips and wires had one flat `typeId`
// ("REST/JSON", "SQL"…), to two-part connection types (transport + style).

import { ANY_STYLE, Layer, Transport } from "../types";
import { ConnType } from "./connections";

/** A v1.1 pip type. */
export interface LegacyPipType {
  id: string;
  name: string;
  color: string;
  layers?: Layer[];
}

/** The ten built-in v1.1 types, and what each became. */
export const LEGACY_TYPE_MAP: Record<string, ConnType> = {
  "t-http": { transportId: "tr-http", styleId: ANY_STYLE },
  "t-rest": { transportId: "tr-http", styleId: "s-rest" },
  "t-grpc": { transportId: "tr-http2", styleId: "s-grpc" },
  "t-tcp": { transportId: "tr-tcp", styleId: ANY_STYLE },
  "t-sql": { transportId: "tr-tcp", styleId: "s-sql" },
  "t-queue": { transportId: "tr-queue", styleId: ANY_STYLE },
  "t-event": { transportId: "tr-queue", styleId: "s-event" },
  "t-file": { transportId: "tr-fs", styleId: ANY_STYLE },
  "t-call": { transportId: "tr-inproc", styleId: "s-call" },
  "t-import": { transportId: "tr-inproc", styleId: "s-import" },
};

/**
 * Converts a file's v1.1 pip types. Built-in ones map by the table; a custom
 * one becomes a transport of the same name and color (style "any"), since
 * user-made types were mostly protocols.
 */
export function convertLegacyTypes(pipTypes: Record<string, LegacyPipType>): {
  map: Record<string, ConnType>;
  transports: Record<string, Transport>;
} {
  const map: Record<string, ConnType> = { ...LEGACY_TYPE_MAP };
  const transports: Record<string, Transport> = {};
  for (const t of Object.values(pipTypes)) {
    if (map[t.id]) continue;
    const id = `tr-${t.id.replace(/^t-/, "")}`;
    transports[id] = { id, name: t.name, color: t.color, ...(t.layers?.length ? { layers: t.layers } : {}) };
    map[t.id] = { transportId: id, styleId: ANY_STYLE };
  }
  return { map, transports };
}

/** A legacy type id's two-part equivalent; unknown ids fall back to HTTP / any. */
export const legacyConn = (map: Record<string, ConnType>, typeId: string | undefined): ConnType =>
  (typeId && map[typeId]) || { transportId: "tr-http", styleId: ANY_STYLE };
