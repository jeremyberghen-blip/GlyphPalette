import { useEffect, useRef, useState } from "react";
import CanvasStage from "./components/CanvasStage";
import LibraryPanel from "./components/LibraryPanel";
import NavTree from "./components/NavTree";
import Breadcrumbs from "./components/Breadcrumbs";
import BoundaryModal from "./components/BoundaryModal";
import Toasts from "./components/Toasts";
import UnsavedPrompt from "./components/UnsavedPrompt";
import SettingsDialog from "./components/SettingsDialog";
import ProjectNamePrompt from "./components/ProjectNamePrompt";
import ProjectTitle from "./components/ProjectTitle";
import InfoCardHost from "./components/InfoCard";
import ContextMenu from "./components/ContextMenu";
import PathOverrideDialog from "./components/PathOverrideDialog";
import AddPipDialog from "./components/AddPipDialog";
import { SquareDashed, FilePlus2, FolderOpen, Save, ImageDown, Settings } from "lucide-react";
import { APP_NAME, IS_DEV_BUILD, isTauri } from "./lib/env";
import {
  closeWindowFlow,
  exportPngFlow,
  newProjectFlow,
  openProjectFlow,
  reopenLastProject,
  saveNow,
} from "./lib/fileActions";
import { autosaveDue, isDirty, windowTitle } from "./lib/session";
import { loadSettings, useSettings } from "./lib/settings";
import Konva from "konva";
import { useApp, getPointerWorld } from "./store";
import { setCustomIconResolver } from "./lib/icons";
import "./App.css";

/** How often the autosave timer checks whether a save is due. */
const AUTOSAVE_CHECK_MS = 10_000;

setCustomIconResolver((id) => useApp.getState().customIcons[id]);

export default function App() {
  const canvasHost = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 800, height: 600 });
  const placingDefId = useApp((s) => s.placingDefId);
  const boundaryDrawing = useApp((s) => s.boundaryDrawing);
  const pendingBoundaryRect = useApp((s) => s.pendingBoundaryRect);
  const activeCanvasId = useApp((s) => s.activeCanvasId);
  const projectName = useApp((s) => s.projectName);
  const dirty = useApp((s) => isDirty(s, s.savedRefs));
  const autosaveMinutes = useSettings((s) => s.autosaveMinutes);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Settings first, then the project last worked on (so a restart, or a dev
  // reload, comes back to it instead of a blank project)
  useEffect(() => {
    void loadSettings().then(reopenLastProject);
  }, []);

  // Window title: project name, with a dot while there are unsaved changes
  useEffect(() => {
    const title = windowTitle(projectName, dirty, APP_NAME);
    document.title = title;
    if (isTauri()) {
      void import("@tauri-apps/api/window").then(({ getCurrentWindow }) =>
        getCurrentWindow().setTitle(title)
      );
    }
  }, [projectName, dirty]);

  // Autosave: into the project's file, only when there are unsaved changes
  useEffect(() => {
    if (!autosaveMinutes) return;
    const timer = setInterval(() => {
      const s = useApp.getState();
      const due = autosaveDue({
        now: Date.now(),
        lastSavedAt: s.savedAt,
        intervalMinutes: autosaveMinutes,
        dirty: isDirty(s, s.savedRefs),
        hasFile: !!s.filePath,
      });
      if (due) void saveNow({ auto: true });
    }, AUTOSAVE_CHECK_MS);
    return () => clearInterval(timer);
  }, [autosaveMinutes]);

  // Closing the window with unsaved changes asks first
  useEffect(() => {
    if (!isTauri()) return;
    let unlisten: (() => void) | undefined;
    let disposed = false;
    void (async () => {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const win = getCurrentWindow();
      const off = await win.onCloseRequested((event) => {
        // GP always decides (and reports failures) rather than leaving it to Tauri
        event.preventDefault();
        return closeWindowFlow(() => win.destroy());
      });
      // Unmounted while registering (React runs effects twice in dev): don't leak
      // a second, stale close handler that could block closing.
      if (disposed) off();
      else unlisten = off;
    })();
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  // First visit to a canvas: center the world origin in the view
  useEffect(() => {
    const s = useApp.getState();
    if (!s.viewports[activeCanvasId]) {
      const el = canvasHost.current;
      if (el) {
        s.setViewport({ x: el.clientWidth / 2, y: el.clientHeight / 2, scale: 1 });
      }
    }
  }, [activeCanvasId]);

  useEffect(() => {
    const el = canvasHost.current;
    if (!el) return;
    const obs = new ResizeObserver(() => {
      setSize({ width: el.clientWidth, height: el.clientHeight });
    });
    obs.observe(el);
    setSize({ width: el.clientWidth, height: el.clientHeight });
    // Start with the world origin at the center of the view
    useApp.getState().setViewport({
      x: el.clientWidth / 2,
      y: el.clientHeight / 2,
      scale: 1,
    });
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const s = useApp.getState();
      if (e.ctrlKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        s.undo();
      } else if (e.ctrlKey && e.key.toLowerCase() === "c") {
        s.copySelection();
      } else if (e.ctrlKey && e.key.toLowerCase() === "v") {
        s.paste();
      } else if (e.ctrlKey && e.key.toLowerCase() === "d") {
        e.preventDefault();
        s.duplicateSelection(getPointerWorld());
      } else if (e.ctrlKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void saveNow({ saveAs: e.shiftKey });
      } else if (e.ctrlKey && e.key.toLowerCase() === "o") {
        e.preventDefault();
        void openProjectFlow();
      } else if (e.key === "Delete" || e.key === "Backspace") {
        // A selected bend point is deleted on its own; otherwise the selection
        if (s.selectedWaypoint && s.selection.includes(s.selectedWaypoint.relId)) {
          s.removeSelectedWaypoint();
        } else {
          s.deleteSelection();
        }
      } else if (e.key === "Escape") {
        s.setPlacing(null);
        useApp.setState({ wireDrag: null, boundaryDrawing: false });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const doExport = () => {
    const stage = Konva.stages[0];
    if (!stage) return;
    // Bounds of actual content (nodes/wires/boundaries layer), in screen coords
    const layer = stage.getLayers().find((l) => l.name() === "content");
    if (!layer) return;
    const rect = layer.getClientRect({ skipTransform: false });
    if (rect.width === 0 || rect.height === 0) return;
    const pad = 24;
    const dataUrl = stage.toDataURL({
      x: rect.x - pad,
      y: rect.y - pad,
      width: rect.width + pad * 2,
      height: rect.height + pad * 2,
      pixelRatio: 2,
    });
    void exportPngFlow(dataUrl);
  };

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#191a21] text-[#c9cbd8]">
      <header className="flex h-11 shrink-0 items-center gap-3 border-b border-[#2e3040] bg-[#1e1f28] px-4 select-none">
        <span className="shrink-0 whitespace-nowrap text-sm font-semibold tracking-wide text-[#e2e4ee]">
          Glyph Palette
        </span>
        {IS_DEV_BUILD && (
          <span
            className="shrink-0 rounded border border-[#b7791f] bg-[#3b2f17] px-1.5 py-px text-[10px] font-bold tracking-wider text-[#f6c453]"
            title="Running from a dev server (GP Dev Mode): changes to the code reload it. The installed app has no badge."
          >
            DEV
          </span>
        )}
        <ProjectTitle dirty={dirty} />
        <div className="mx-1 h-5 w-px bg-[#2e3040]" />
        <button
          onClick={() => void newProjectFlow()}
          className="flex items-center gap-1.5 rounded border border-[#3a3d52] bg-[#262835] px-2.5 py-1 text-xs hover:border-[#4c9aff] hover:text-white"
          title="New project"
        >
          <FilePlus2 size={13} /> New
        </button>
        <button
          onClick={() => void openProjectFlow()}
          className="flex items-center gap-1.5 rounded border border-[#3a3d52] bg-[#262835] px-2.5 py-1 text-xs hover:border-[#4c9aff] hover:text-white"
          title="Open project (Ctrl+O)"
        >
          <FolderOpen size={13} /> Open
        </button>
        <button
          onClick={() => void saveNow()}
          className="flex items-center gap-1.5 rounded border border-[#3a3d52] bg-[#262835] px-2.5 py-1 text-xs hover:border-[#4c9aff] hover:text-white"
          title="Save project (Ctrl+S; Ctrl+Shift+S to save as)"
        >
          <Save size={13} /> Save
        </button>
        <button
          onClick={doExport}
          className="flex items-center gap-1.5 rounded border border-[#3a3d52] bg-[#262835] px-2.5 py-1 text-xs hover:border-[#4c9aff] hover:text-white"
          title="Export visible content as PNG"
        >
          <ImageDown size={13} /> PNG
        </button>
        <div className="mx-1 h-5 w-px bg-[#2e3040]" />
        <button
          onClick={() => useApp.getState().setBoundaryDrawing(!boundaryDrawing)}
          className={`flex items-center gap-1.5 rounded border px-2.5 py-1 text-xs hover:border-[#4c9aff] hover:text-white ${
            boundaryDrawing
              ? "border-[#4c9aff] bg-[#2b3a55] text-white"
              : "border-[#3a3d52] bg-[#262835]"
          }`}
          title="Drag on the canvas to draw a boundary"
        >
          <SquareDashed size={13} /> Boundary
        </button>
        <div className="ml-auto truncate text-xs text-[#565a72]">
          Del delete · Ctrl+Z undo · Ctrl+C/V copy/paste · Ctrl+D duplicate · middle-drag pan · wheel zoom · Esc cancels
        </div>
        <button
          onClick={() => setSettingsOpen(true)}
          className="shrink-0 rounded p-1 text-[#7a7d92] hover:bg-[#2b2d3a] hover:text-white"
          title="Settings"
        >
          <Settings size={15} />
        </button>
      </header>
      <div className="flex min-h-0 flex-1">
        <LibraryPanel />
        <div className="relative min-h-0 min-w-0 flex-1">
          <Breadcrumbs />
          <div
            ref={canvasHost}
            className="h-full w-full"
            style={{ cursor: placingDefId || boundaryDrawing ? "crosshair" : "default" }}
          >
            <CanvasStage width={size.width} height={size.height} />
          </div>
        </div>
        <NavTree />
      </div>
      {pendingBoundaryRect && <BoundaryModal />}
      {settingsOpen && <SettingsDialog onClose={() => setSettingsOpen(false)} />}
      <UnsavedPrompt />
      <ProjectNamePrompt />
      <InfoCardHost canvasHost={canvasHost} />
      <PathOverrideDialog />
      <AddPipDialog />
      <ContextMenu />
      <Toasts />
    </div>
  );
}
