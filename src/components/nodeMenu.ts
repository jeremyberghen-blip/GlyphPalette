// The right-click menu on a placed node. Thin glue: each item calls a store
// action or opens a dialog; what's offered follows the node's kind.

import { useApp } from "../store";
import { isPortDefId, resolveDef } from "../lib/ports";
import { buildPlan, placementForTrail } from "../lib/paths";
import { isStandardDef } from "../lib/standardLibrary";
import { MenuEntry } from "./ContextMenu";
import { openWizard } from "./DefinitionWizard";
import { openPathDialog } from "./PathOverrideDialog";
import { openAddPipDialog } from "./AddPipDialog";

export function nodeMenuItems(nodeId: string): MenuEntry[] {
  const s = useApp.getState();
  const node = s.canvases[s.activeCanvasId]?.nodes.find((n) => n.id === nodeId);
  if (!node) return [];
  const remove: MenuEntry = {
    label: "Delete",
    danger: true,
    shortcut: "Del",
    onClick: () => {
      s.setSelection([nodeId]);
      useApp.getState().deleteSelection();
    },
  };
  if (isPortDefId(node.definitionId)) return [remove];

  const def = resolveDef(s.definitions, s.activeCanvasId, node.definitionId);
  if (!def) return [remove];
  const open: MenuEntry = { label: "Open inside", onClick: () => s.enterDefinition(def.id) };

  // A collapsed group is a fold: no path of its own, nothing to edit
  if (def.expandable) {
    return [open, { label: "Expand", onClick: () => s.expandNode(nodeId) }, "separator", remove];
  }

  const here = placementForTrail(buildPlan(s.projectName, s.canvases, s.definitions), nodeId, s.trail);
  const notBuilt = !here
    ? "Not reachable from the top canvas"
    : here.status === "external"
      ? "External — never built"
      : here.status === "sketch"
        ? "Inside a file — a sketch, not built"
        : undefined;
  const standard = isStandardDef(def.id);
  const readOnly = standard ? "Standard nodes are read-only — Permute… makes this node your own copy" : undefined;

  return [
    { label: "Override path…", onClick: () => openPathDialog(nodeId), disabled: !!notBuilt, title: notBuilt },
    ...(node.pathOverride
      ? [{ label: "Reset to automatic path", onClick: () => s.setPathOverride(nodeId, null) }]
      : []),
    "separator",
    open,
    { label: "Edit definition…", onClick: () => openWizard({ editing: def }), disabled: standard, title: readOnly },
    { label: "Add pip…", onClick: () => openAddPipDialog(def.id), disabled: standard, title: readOnly },
    ...(standard
      ? [
          {
            label: "Permute…",
            onClick: () => openWizard({ base: def, replaceNodeId: nodeId }),
            title: "Replace this node with your own copy of the standard node, to edit",
          },
        ]
      : []),
    {
      label: "Duplicate",
      shortcut: "Ctrl+D",
      onClick: () => {
        s.setSelection([nodeId]);
        useApp.getState().duplicateSelection(null);
      },
    },
    "separator",
    remove,
  ];
}
