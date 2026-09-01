// The seed default library: pip types + node definitions shipped with the app.
//
// This is the *fallback* content. The live default library is persisted per
// machine (see lib/library.ts) and can be edited by the user. Definitions here
// are templates — placing or editing one copies it into the open project
// (see store: `defaultLibraryIds`).

import { NodeDefinition, PipDef, PipType, Layer } from "../types";

export interface LibraryFile {
  version: 1;
  pipTypes: Record<string, PipType>;
  definitions: Record<string, NodeDefinition>;
}

const pipTypeList: PipType[] = [
  { id: "t-http", name: "HTTP", color: "#4ade80" },
  { id: "t-rest", name: "REST/JSON", color: "#22d3ee" },
  { id: "t-grpc", name: "gRPC", color: "#818cf8" },
  { id: "t-tcp", name: "TCP/IP", color: "#4c9aff" },
  { id: "t-sql", name: "SQL", color: "#f59e0b" },
  { id: "t-event", name: "Event", color: "#a78bfa" },
  { id: "t-queue", name: "Queue", color: "#fb923c" },
  { id: "t-file", name: "File I/O", color: "#f472b6" },
  { id: "t-import", name: "Import", color: "#94a3b8" },
  { id: "t-call", name: "Call", color: "#64748b" },
];

type DefSeed = Omit<NodeDefinition, "canvasId"> & { pips?: PipDef[] };

const defSeeds: DefSeed[] = [
  // ---- Context ----
  {
    id: "def-system",
    name: "System",
    icon: "Box",
    layers: ["context"],
    pips: [],
  },
  {
    id: "def-person",
    name: "Person",
    icon: "User",
    layers: ["context", "container"],
    pips: [],
  },
  {
    id: "def-external",
    name: "External System",
    icon: "Cloud",
    layers: ["context", "container", "component"],
    pips: [
      { id: "p-ext-in", label: "In", typeId: "t-rest", direction: "inbound", side: "left" },
      { id: "p-ext-out", label: "Out", typeId: "t-rest", direction: "outbound", side: "right" },
    ],
  },

  // ---- Container ----
  {
    id: "def-internet",
    name: "Internet",
    icon: "Globe",
    layers: ["container"],
    pips: [
      { id: "p-inet-http", label: "Requests", typeId: "t-http", direction: "outbound", side: "right" },
    ],
  },
  {
    id: "def-firewall",
    name: "Firewall",
    icon: "Shield",
    layers: ["container"],
    pips: [
      { id: "p-fw-in", label: "WAN", typeId: "t-http", direction: "inbound", side: "left" },
      { id: "p-fw-out", label: "LAN", typeId: "t-http", direction: "outbound", side: "right" },
    ],
  },
  {
    id: "def-webapp",
    name: "Web App",
    icon: "Globe",
    layers: ["container"],
    pips: [
      { id: "p-wa-in", label: "HTTP", typeId: "t-http", direction: "inbound", side: "left" },
      { id: "p-wa-api", label: "API", typeId: "t-rest", direction: "outbound", side: "right" },
    ],
  },
  {
    id: "def-spa",
    name: "Single-Page App",
    icon: "Monitor",
    layers: ["container"],
    pips: [
      { id: "p-spa-api", label: "API", typeId: "t-rest", direction: "outbound", side: "right" },
    ],
  },
  {
    id: "def-mobile",
    name: "Mobile App",
    icon: "Smartphone",
    layers: ["container"],
    pips: [
      { id: "p-mob-api", label: "API", typeId: "t-rest", direction: "outbound", side: "right" },
    ],
  },
  {
    id: "def-server",
    name: "API Service",
    icon: "Server",
    layers: ["container"],
    pips: [
      { id: "p-srv-http", label: "HTTP", typeId: "t-rest", direction: "inbound", side: "left" },
      { id: "p-srv-sql", label: "DB", typeId: "t-sql", direction: "outbound", side: "right" },
      { id: "p-srv-evt", label: "Events", typeId: "t-event", direction: "bidirectional", side: "bottom" },
    ],
  },
  {
    id: "def-gateway",
    name: "API Gateway",
    icon: "Network",
    layers: ["container"],
    pips: [
      { id: "p-gw-in", label: "Inbound", typeId: "t-http", direction: "inbound", side: "left" },
      { id: "p-gw-out", label: "Upstream", typeId: "t-rest", direction: "outbound", side: "right" },
    ],
  },
  {
    id: "def-database",
    name: "Database",
    icon: "Database",
    layers: ["container"],
    pips: [
      { id: "p-db-sql", label: "SQL", typeId: "t-sql", direction: "inbound", side: "left" },
      { id: "p-db-evt", label: "Events", typeId: "t-event", direction: "bidirectional", side: "top" },
    ],
  },
  {
    id: "def-cache",
    name: "Cache",
    icon: "Zap",
    layers: ["container"],
    pips: [
      { id: "p-cache-in", label: "Get/Set", typeId: "t-tcp", direction: "inbound", side: "left" },
    ],
  },
  {
    id: "def-queue",
    name: "Message Queue",
    icon: "Layers",
    layers: ["container"],
    pips: [
      { id: "p-q-pub", label: "Publish", typeId: "t-queue", direction: "inbound", side: "left" },
      { id: "p-q-sub", label: "Consume", typeId: "t-queue", direction: "outbound", side: "right" },
    ],
  },
  {
    id: "def-blobstore",
    name: "Object Store",
    icon: "Package",
    layers: ["container"],
    pips: [
      { id: "p-blob-io", label: "Get/Put", typeId: "t-rest", direction: "inbound", side: "left" },
    ],
  },
  {
    id: "def-worker",
    name: "Worker / Job",
    icon: "Cog",
    layers: ["container"],
    pips: [
      { id: "p-wrk-q", label: "Jobs", typeId: "t-queue", direction: "inbound", side: "left" },
    ],
  },

  // ---- Component ----
  {
    id: "def-file",
    name: "File",
    icon: "FileCode",
    layers: ["component"],
    pips: [],
  },
  {
    id: "def-module",
    name: "Module",
    icon: "Folder",
    layers: ["component"],
    pips: [],
  },
  {
    id: "def-controller",
    name: "Controller",
    icon: "Workflow",
    layers: ["component"],
    pips: [],
  },
  {
    id: "def-service",
    name: "Service",
    icon: "Cog",
    layers: ["component"],
    pips: [],
  },
  {
    id: "def-repository",
    name: "Repository",
    icon: "Database",
    layers: ["component"],
    pips: [],
  },
  {
    id: "def-client",
    name: "Client / Adapter",
    icon: "Cable",
    layers: ["component"],
    pips: [],
  },
  {
    id: "def-model",
    name: "Model / Schema",
    icon: "Table",
    layers: ["component"],
    pips: [],
  },

  // ---- Code ----
  {
    id: "def-function",
    name: "Function",
    icon: "Braces",
    layers: ["code"],
    pips: [],
  },
  {
    id: "def-class",
    name: "Class",
    icon: "Box",
    layers: ["code"],
    pips: [],
  },
  {
    id: "def-type",
    name: "Type / Interface",
    icon: "Type",
    layers: ["code"],
    pips: [],
  },
];

export const SEED_LIBRARY: LibraryFile = {
  version: 1,
  pipTypes: Object.fromEntries(pipTypeList.map((t) => [t.id, t])),
  definitions: Object.fromEntries(
    defSeeds.map((d) => [
      d.id,
      { ...d, pips: d.pips ?? [], canvasId: null } as NodeDefinition,
    ])
  ),
};

/** Fills in a missing/empty `layers` array so older library files stay valid. */
export function normalizeLibrary(raw: unknown): LibraryFile {
  const lib = (raw ?? {}) as Partial<LibraryFile>;
  const definitions: Record<string, NodeDefinition> = {};
  for (const [id, d] of Object.entries(lib.definitions ?? {})) {
    const def = d as NodeDefinition;
    definitions[id] = {
      ...def,
      layers: def.layers && def.layers.length ? def.layers : (["container"] as Layer[]),
      pips: def.pips ?? [],
      canvasId: def.canvasId ?? null,
    };
  }
  return {
    version: 1,
    pipTypes: (lib.pipTypes as Record<string, PipType>) ?? {},
    definitions,
  };
}
