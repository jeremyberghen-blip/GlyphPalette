# Writing a `.glyph` file

How to create a Glyph Palette project file correctly — by hand, from a
script, or from an AI session — without reading the app. Current as of
**v1.5** (file format **version 2**). If anything here disagrees with the
code, the code wins: `src/types.ts` (the shapes), `src/lib/projectFile.ts`
(loading and upgrading), `src/lib/standard.glyph` (the standard library).

A `.glyph` file is JSON. GP opens it with **Open**; nothing else about it is
special. Finish by running the [validator](#validating-a-file) — it catches
nearly every mistake on the [checklist](#checklist).

---

## A minimal file

Two systems and a person, one wire each. This opens as-is:

```json
{
  "app": "glyph-palette",
  "version": 2,
  "name": "Pastebin",
  "transports": {},
  "styles": {},
  "definitions": {
    "def-pastebin": {
      "id": "def-pastebin",
      "name": "Pastebin",
      "icon": "Box",
      "layers": ["context"],
      "pips": [
        { "id": "pip-web", "label": "Web", "transportId": "tr-http", "styleId": "s-html", "direction": "inbound", "side": "left" },
        { "id": "pip-mail", "label": "Email", "transportId": "tr-http", "styleId": "s-rest", "direction": "outbound", "side": "right" }
      ],
      "canvasId": null,
      "description": "Lets people paste text and share it by link."
    },
    "def-writer": {
      "id": "def-writer",
      "name": "Writer",
      "icon": "User",
      "layers": ["context"],
      "pips": [
        { "id": "pip-uses", "label": "Uses", "transportId": "tr-http", "styleId": "s-html", "direction": "outbound", "side": "right" }
      ],
      "canvasId": null,
      "external": true
    }
  },
  "customIcons": {},
  "canvases": {
    "canvas-root": {
      "id": "canvas-root",
      "layer": "context",
      "nodes": [
        { "id": "n-writer", "definitionId": "def-writer", "x": -300, "y": -48 },
        { "id": "n-pastebin", "definitionId": "def-pastebin", "x": -60, "y": -48 },
        { "id": "n-mail", "definitionId": "def-external", "x": 180, "y": -48 }
      ],
      "relationships": [
        { "id": "r1", "transportId": "tr-http", "styleId": "s-html",
          "from": { "nodeId": "n-writer", "pipId": "pip-uses" }, "to": { "nodeId": "n-pastebin", "pipId": "pip-web" } },
        { "id": "r2", "transportId": "tr-http", "styleId": "s-rest",
          "from": { "nodeId": "n-pastebin", "pipId": "pip-mail" }, "to": { "nodeId": "n-mail", "pipId": "p-ext-in" } }
      ],
      "boundaries": []
    }
  }
}
```

Note `n-mail`: it places the **standard** External System (`def-external`)
without defining it, and wires to its standard pip `p-ext-in`.

---

## Top level

| Field | Required | Notes |
|---|---|---|
| `app` | yes | Always `"glyph-palette"`. |
| `version` | yes | Always `2`. Anything else is treated as an old file and "upgraded" (wrongly). |
| `name` | recommended | The project name; its build folder is the name in kebab-case. Missing → GP uses the file name. |
| `transports` | yes | **Your own** transports only (`{}` if none). Standard ones are merged in. |
| `styles` | yes | **Your own** API styles only (`{}` if none). |
| `definitions` | yes | **Your own** definitions only. Never write a standard definition here (see [Standard library](#standard-library)). |
| `standardInteriors` | optional | `{ "def-database": "canvas-x" }` — an inside drawn for a *standard* definition, which can't hold `canvasId` itself. |
| `customIcons` | yes | `{ "<id>": "data:image/png;base64,…" }`; used as icon `"custom:<id>"`. Usually `{}`. |
| `canvases` | yes | Must include `"canvas-root"`. |

---

## IDs and names

- **IDs** are any unique strings. GP's own look like `def-…`, `pip-…`,
  `canvas-…` and short random strings for nodes and wires; nothing depends
  on the prefixes except **reserved ids**: `canvas-root`, `@port-in`,
  `@port-out`, and every id in the standard library (`def-…`, `p-…`,
  `tr-…`, `s-…` listed below). Don't reuse those for your own things.
- **Pip ids** only need to be unique *within their definition*. Wires refer
  to a pip by `(nodeId, pipId)`.
- **Definition names must be unique, case-insensitively, across the whole
  library — standard names included.** A project definition can't be called
  "Database", "Cache", "Person", etc.; use "Links DB", "Session Cache".

---

## Standard library

Every project gets these, read-only. **Reference them by id; never copy them
into `definitions`.** (A standard id in `definitions` is read as a v1.0-era
copy: identical → dropped; different → silently re-id'd as a new
definition.) To customise one, write your own definition instead.

**Transports** — how bytes travel. `layers` only orders the node dialog's
pickers; any transport works anywhere.

| id | name | default style |
|---|---|---|
| `tr-http` | HTTP | `s-rest` |
| `tr-http2` | HTTP/2 | `s-grpc` |
| `tr-ws` | WebSocket | — |
| `tr-tcp` | TCP | — |
| `tr-queue` | Message queue | `s-event` |
| `tr-fs` | Filesystem | — |
| `tr-inproc` | In-process | `s-call` |

**Styles** — what the bytes mean.

| id | name | usual on | kind |
|---|---|---|---|
| `s-any` | any (pass-through) | anything | — |
| `s-rest` | REST/JSON | HTTP | — |
| `s-graphql` | GraphQL | HTTP | — |
| `s-soap` | SOAP/XML | HTTP | — |
| `s-html` | Web pages | HTTP | — |
| `s-grpc` | gRPC | HTTP/2 | — |
| `s-sql` | SQL | TCP | — |
| `s-kv` | Key-value | TCP | — |
| `s-event` | Event | Message queue, WebSocket | — |
| `s-call` | Call | In-process | `call` |
| `s-import` | Import | In-process | `import` |

**Definitions** (with their pip ids). External ones draw in stone and are
never built.

| id | name | layers | pips (`id` direction transport/style side) |
|---|---|---|---|
| `def-system` | System | context | — |
| `def-person` | Person *(external)* | context, container | — |
| `def-external` | External System *(external)* | all three | `p-ext-in` in http/rest left · `p-ext-out` out http/rest right |
| `def-internet` | Internet *(external)* | container | `p-inet-http` out http/any right |
| `def-firewall` | Firewall *(external)* | container | `p-fw-in` in http/any left · `p-fw-out` out http/any right |
| `def-webapp` | Web App | container | `p-wa-in` in http/html left · `p-wa-api` out http/rest right |
| `def-spa` | Single-Page App | container | `p-spa-api` out http/rest right |
| `def-mobile` | Mobile App | container | `p-mob-api` out http/rest right |
| `def-server` | API Service | container | `p-srv-http` in http/rest left · `p-srv-sql` out tcp/sql right · `p-srv-evt` both queue/event bottom |
| `def-gateway` | API Gateway | container | `p-gw-in` in http/any left · `p-gw-out` out http/rest right |
| `def-database` | Database | container | `p-db-sql` in tcp/sql left · `p-db-evt` both queue/event top |
| `def-cache` | Cache *(external)* | container | `p-cache-in` in tcp/kv left |
| `def-queue` | Message Queue *(external)* | container | `p-q-pub` in queue/any left · `p-q-sub` out queue/any right |
| `def-blobstore` | Object Store *(external)* | container | `p-blob-io` in http/rest left |
| `def-worker` | Worker / Job | container | `p-wrk-q` in queue/any left |
| `def-file` | File *(builds as a file)* | component | — |
| `def-module` | Module | component | — |
| `def-controller` | Controller | component | — |
| `def-service` | Service | component | — |
| `def-repository` | Repository | component | — |
| `def-client` | Client / Adapter | component | — |
| `def-model` | Model / Schema | component | — |

Standard definitions can't carry descriptions, languages, or path facts —
for a buildable part, write your own definition.

---

## Definitions

```jsonc
{
  "id": "def-link-service",
  "name": "Link Service",            // unique (see IDs and names)
  "icon": "Cog",                     // a Lucide icon name, PascalCase; or "custom:<id>"
  "layers": ["component"],           // where it may be placed; non-empty
  "pips": [ /* see Pips */ ],
  "canvasId": "canvas-link-service", // its drawn inside, or null
  // optional:
  "description": "Turns long URLs into short slugs and resolves them back.",
  "constraints": ["no direct database access", "never log full URLs"],
  "slug": "links",                   // file/folder name; default: derived from name (snake_case)
  "external": true,                  // managed by someone else — never built (omit kind/language)
  "kind": "file",                    // builds as one file; omit for a folder (the default)
  "language": "python"               // omit to inherit the nearest ancestor's
}
```

- **Icons:** safe choices include `Box`, `Server`, `Database`, `Globe`,
  `Monitor`, `Smartphone`, `User`, `Users`, `Cloud`, `Shield`, `ShieldCheck`,
  `Lock`, `KeyRound`, `Mail`, `Bell`, `Zap`, `Layers`, `Cog`, `Workflow`,
  `Route`, `Archive`, `Package`, `HardDrive`, `FileText`, `FileCode`,
  `Settings`, `Activity`, `Link`, `Camera`, `Receipt`, `ShoppingCart`,
  `CreditCard`, `MessageCircle`, `Radio`, `ListChecks`, `TrendingUp`. An
  unknown name renders as nothing (the validator flags it).
- **Languages:** `python`, `typescript`, `javascript`, `go`, `rust`, `ruby`,
  `java`, `csharp`, `kotlin`, `swift`, `sql`.
- **`external` and `kind`:** an external node is neither file nor folder —
  don't set `kind` or `language` on it. `kind` exists only as `"file"`.
- **Layers:** include the layer of every canvas you place it on.
- A definition placed more than once **shares one interior** (`canvasId`);
  each placement is built separately, at its own path.

---

## Pips

```json
{ "id": "pip-db", "label": "DB", "transportId": "tr-tcp", "styleId": "s-sql", "direction": "outbound", "side": "right" }
```

| Field | Values |
|---|---|
| `direction` | `inbound` (is called) · `outbound` (starts the conversation) · `bidirectional` · `none` |
| `side` | `left` · `right` · `top` · `bottom` (pips spread evenly along each side). Convention: inbound left, outbound right. |
| `transportId` / `styleId` | standard or your own ids |
| `removed` | never write it — GP's own bookkeeping for deleted-but-wired pips |

**Two pips connect only if** the transports are equal, the styles are equal
or either is `s-any`, and the directions pair up: `outbound`↔`inbound`,
`bidirectional`↔`bidirectional`, or `none`↔`none`.

A wire's **kind** in Publish comes from its style: Import → `import`, Call →
`call`, anything else on `tr-inproc` → `call`, everything else →
`transport`.

---

## Canvases and layers

```json
"canvas-link-service": { "id": "canvas-link-service", "layer": "component", "nodes": [], "relationships": [], "boundaries": [] }
```

- `canvas-root` is always `"layer": "context"`.
- A definition's inside is **one layer down from the canvas it's placed on**:
  context → container → component; component stays component.
- Give a definition an inside by setting its `canvasId` and adding that
  canvas. For a *standard* definition use `standardInteriors` instead.
- A canvas that no placed definition owns is unreachable — it loads, but
  nothing shows it.

---

## Nodes

```json
{ "id": "n-api", "definitionId": "def-snip-api", "x": 180, "y": -48 }
```

- `x`, `y` are the **top-left corner** in world units; every node is
  **120 × 96**. A canvas opens centred on (0, 0), so lay nodes out around
  the origin; ~220–240 apart horizontally reads well.
- Optional `pathOverride`: a full build path from the project folder
  (`"services/api"`); its children build under it. Rarely needed.

---

## Wires (`relationships`)

```json
{ "id": "r7", "transportId": "tr-tcp", "styleId": "s-sql",
  "from": { "nodeId": "n-api", "pipId": "pip-db" }, "to": { "nodeId": "n-db", "pipId": "p-db-sql" } }
```

- Both ends are **nodes on the same canvas** as the wire.
- **`from` is the outbound end** (for `bidirectional`/`none` either order).
- `transportId` is the shared transport; `styleId` is the **more specific**
  of the two pips' styles (the non-`any` one). A wire whose recorded type no
  longer fits its pips draws as broken (red).
- No two wires between the same two pips.
- Optional `waypoints` (bend points: `{x, y, angle, half}`) — leave them
  out; GP draws a plain curve.

---

## Ports — connecting an inside to the outside

Inside a definition's canvas you may place one **Inbound** and one
**Outbound** port node (never on `canvas-root`):

```json
{ "id": "n-in", "definitionId": "@port-in", "x": -400, "y": 0 },
{ "id": "n-out", "definitionId": "@port-out", "x": 400, "y": 0 }
```

Ports carry the **parent definition's pips, flipped, with the same ids**:

- the parent's **inbound** pips appear on `@port-in` as **outbound** — so a
  wire runs `from` the port `to` the inner node that handles it;
- the parent's **outbound** pips appear on `@port-out` as **inbound** — so a
  wire runs `from` the inner node `to` the port;
- `bidirectional` and `none` pips appear on both.

Example: Snip API (`def-snip-api`) has inbound `pip-api` (HTTP/REST) and
outbound `pip-db` (TCP/SQL). Inside its canvas:

```json
{ "id": "w1", "transportId": "tr-http", "styleId": "s-rest",
  "from": { "nodeId": "n-in", "pipId": "pip-api" }, "to": { "nodeId": "n-controller", "pipId": "pip-http" } },
{ "id": "w2", "transportId": "tr-tcp", "styleId": "s-sql",
  "from": { "nodeId": "n-repository", "pipId": "pip-db" }, "to": { "nodeId": "n-out", "pipId": "pip-db" } }
```

(The inner pip ids can match the parent's or not — here the repository's
own outbound pip happens to be called `pip-db` too.)

---

## Boundaries and collapsed groups

- **Boundaries** are labelled boxes on a canvas:
  `{ "id": "b1", "name": "Backend", "icon": "Box", "x": -100, "y": -150, "width": 500, "height": 300 }`.
  Purely visual; they don't change paths.
- **Collapsed groups** (a boundary collapsed into one node) are a
  definition with `"expandable": true`, a `pipMap` tracing each of its pips
  to an inner node and pip, and `sourceSize`. They're GP's own fold —
  **don't write them by hand**; draw a boundary and let the user collapse
  it if they want.

---

## Checklist

- [ ] `"app": "glyph-palette"`, `"version": 2`, `canvas-root` with `"layer": "context"`.
- [ ] No standard definition (or standard pip/transport/style id) redefined in your own maps.
- [ ] Definition names unique, case-insensitively, including standard names.
- [ ] Every `definitionId` exists (yours, standard, or `@port-in`/`@port-out`).
- [ ] Every wire's pips exist on those nodes, are compatible, and `from` is the outbound end.
- [ ] Wire `transportId`/`styleId` = the shared transport and the more specific style.
- [ ] Port wires use the **parent's** pip ids; ports only inside a definition's canvas, one of each.
- [ ] Each inside's canvas `layer` is one below where the definition is placed.
- [ ] Icons are real Lucide names; languages from the list; no `kind`/`language` on external nodes.
- [ ] Nothing gets built at the same path twice (two definitions with the same slug side by side clash).

---

## Validating a file

Run GP's own loader and rules over it. In the repo, save this as
`src/zz-check.tmp.test.ts`, point it at your file, run
`npx vitest run src/zz-check.tmp.test.ts`, then delete it:

```ts
import { it, expect } from "vitest";
import { readFileSync } from "fs";
import { icons } from "lucide-react";
import { loadProjectFile, parseProjectFile } from "./lib/projectFile";
import { STANDARD } from "./lib/standardLibrary";
import { resolveDef } from "./lib/ports";
import { canConnect } from "./lib/graph";
import { buildArchitecture } from "./lib/architecture";

const FILE = "C:/path/to/project.glyph";

it("is a valid project", () => {
  const c = loadProjectFile(parseProjectFile(readFileSync(FILE, "utf8")), STANDARD);
  const problems: string[] = [];
  for (const d of Object.values(c.definitions))
    if (!d.icon.startsWith("custom:") && !(d.icon in icons)) problems.push(`unknown icon ${d.icon} on ${d.name}`);
  for (const cv of Object.values(c.canvases))
    for (const r of cv.relationships) {
      const pipAt = (e: { nodeId: string; pipId: string }) => {
        const n = cv.nodes.find((x) => x.id === e.nodeId);
        return n && resolveDef(c.definitions, cv.id, n.definitionId)?.pips.find((p) => p.id === e.pipId);
      };
      const a = pipAt(r.from), b = pipAt(r.to);
      if (!a || !b) problems.push(`wire ${r.id}: missing node or pip`);
      else if (!canConnect(a, b)) problems.push(`wire ${r.id}: ${a.label} can't connect to ${b.label}`);
      else if (a.direction === "inbound") problems.push(`wire ${r.id}: from should be the outbound end`);
    }
  const arch = buildArchitecture({ projectName: c.projectName ?? "Project", ...c });
  console.log(`${arch.nodes.length} nodes, ${arch.edges.length} connections`, arch.warnings);
  expect(problems).toEqual([]);
});
```

`arch.warnings` lists what Publish would flag (missing languages, path
clashes, broken wires) — worth fixing, but not errors.

---

## A small builder (Python)

For more than a handful of nodes, generate the file. This helper keeps ids,
layers, interiors, ports, and wire normalisation right:

```python
import itertools, json

LAYERS = ["context", "container", "component"]

class Project:
    def __init__(self, name):
        self.name, self.defs, self.canvases = name, {}, {}
        self._ids = itertools.count(1)
        self._canvas("canvas-root", "context")

    def _id(self, prefix):
        return f"{prefix}-{next(self._ids)}"

    def _canvas(self, cid, layer):
        self.canvases[cid] = {"id": cid, "layer": layer, "nodes": [], "relationships": [], "boundaries": []}
        return cid

    def node(self, canvas, name, icon, x, y, pips=(), **facts):
        """Defines and places a node. pips: (key, label, direction, transport, style[, side]).
        facts: description, constraints, external, kind, language, slug."""
        did, keys, pipdefs = self._id("def"), {}, []
        for p in pips:
            key, label, d, tr, st = p[:5]
            side = p[5] if len(p) > 5 else ("left" if d == "inbound" else "right")
            keys[key] = self._id("pip")
            pipdefs.append({"id": keys[key], "label": label, "transportId": tr, "styleId": st,
                            "direction": d, "side": side})
        self.defs[did] = {"id": did, "name": name, "icon": icon, "pips": pipdefs, "canvasId": None,
                          "layers": [self.canvases[canvas]["layer"]], **facts}
        nid = self._id("n")
        self.canvases[canvas]["nodes"].append({"id": nid, "definitionId": did, "x": x, "y": y})
        return {"node": nid, "def": did, "pips": keys, "canvas": canvas}

    def inside(self, n):
        """Gives a placed node a drawn inside, one layer down; returns its canvas id."""
        layer = self.canvases[n["canvas"]]["layer"]
        cid = self._canvas(self._id("canvas"), LAYERS[min(LAYERS.index(layer) + 1, 2)])
        self.defs[n["def"]]["canvasId"] = cid
        return cid

    def port(self, canvas, kind, x, y):
        nid = self._id("n")
        self.canvases[canvas]["nodes"].append({"id": nid, "definitionId": "@port-in" if kind == "in" else "@port-out", "x": x, "y": y})
        return nid

    def _pip(self, n, key):
        return next(p for p in self.defs[n["def"]]["pips"] if p["id"] == n["pips"][key])

    def _rel(self, canvas, a_node, a_pip, b_node, b_pip, tr, st):
        self.canvases[canvas]["relationships"].append({"id": self._id("rel"), "transportId": tr, "styleId": st,
            "from": {"nodeId": a_node, "pipId": a_pip}, "to": {"nodeId": b_node, "pipId": b_pip}})

    def wire(self, a, akey, b, bkey):
        """a's outbound pip → b's inbound pip (same canvas)."""
        pa, pb = self._pip(a, akey), self._pip(b, bkey)
        style = pa["styleId"] if pa["styleId"] != "s-any" else pb["styleId"]
        self._rel(a["canvas"], a["node"], pa["id"], b["node"], pb["id"], pa["transportId"], style)

    def port_in(self, port, parent, pkey, b, bkey):
        """Inside `parent`: its inbound pip `pkey`, from the Inbound port to b's pip."""
        pp, pb = self._pip(parent, pkey), self._pip(b, bkey)
        self._rel(b["canvas"], port, pp["id"], b["node"], pb["id"], pp["transportId"], pp["styleId"])

    def port_out(self, a, akey, port, parent, pkey):
        """Inside `parent`: from a's pip to the Outbound port, on the parent's outbound pip `pkey`."""
        pa, pp = self._pip(a, akey), self._pip(parent, pkey)
        self._rel(a["canvas"], a["node"], pa["id"], port, pp["id"], pp["transportId"], pp["styleId"])

    def standard(self, canvas, def_id, x, y):
        """Places a standard definition (never define it yourself); returns its node id.
        Wire it with _rel(canvas, from_node, from_pip, to_node, to_pip, transport, style),
        using its standard pip ids from the table above."""
        nid = self._id("n")
        self.canvases[canvas]["nodes"].append({"id": nid, "definitionId": def_id, "x": x, "y": y})
        return nid

    def save(self, path):
        json.dump({"app": "glyph-palette", "version": 2, "name": self.name, "transports": {}, "styles": {},
                   "definitions": self.defs, "customIcons": {}, "canvases": self.canvases},
                  open(path, "w", encoding="utf-8"), indent=2)
```

`wire()` and the port helpers look up pips on `self.defs`, so they work for
your own definitions; to wire a standard node, use `_rel` with its standard
pip ids (from the table above). The example projects in `learning/examples/`
(git-ignored, on the user's machine) were generated this way.
