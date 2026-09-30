import { useEffect, useRef, useState } from "react";
import CanvasStage from "./components/CanvasStage";
import LibraryPanel from "./components/LibraryPanel";
import NavTree from "./components/NavTree";
import Breadcrumbs from "./components/Breadcrumbs";
import BoundaryModal from "./components/BoundaryModal";
import { SquareDashed, FilePlus2, FolderOpen, Save, ImageDown } from "lucide-react";
import { saveProject, openProject, exportPng } from "./lib/persist";
import Konva from "konva";
import { useApp } from "./store";
import { setCustomIconResolver } from "./lib/icons";
import "./App.css";

setCustomIconResolver((id) => useApp.getState().customIcons[id]);

export default function App() {
  const canvasHost = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 800, height: 600 });
  const placingDefId = useApp((s) => s.placingDefId);
  const boundaryDrawing = useApp((s) => s.boundaryDrawing);
  const pendingBoundaryRect = useApp((s) => s.pendingBoundaryRect);
  const activeCanvasId = useApp((s) => s.activeCanvasId);

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
      } else if (e.ctrlKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void saveProject(e.shiftKey);
      } else if (e.ctrlKey && e.key.toLowerCase() === "o") {
        e.preventDefault();
        void openProject();
      } else if (e.key === "Delete" || e.key === "Backspace") {
        s.deleteSelection();
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
    const layer = stage.getLayers()[1];
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
    void exportPng(dataUrl);
  };

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#191a21] text-[#c9cbd8]">
      <header className="flex h-11 shrink-0 items-center gap-3 border-b border-[#2e3040] bg-[#1e1f28] px-4 select-none">
        <span className="text-sm font-semibold tracking-wide text-[#e2e4ee]">
          Glyph Palette
        </span>
        <div className="mx-1 h-5 w-px bg-[#2e3040]" />
        <button
          onClick={() => {
            if (window.confirm("Start a new project? Unsaved changes will be lost.")) {
              useApp.getState().newProject();
            }
          }}
          className="flex items-center gap-1.5 rounded border border-[#3a3d52] bg-[#262835] px-2.5 py-1 text-xs hover:border-[#4c9aff] hover:text-white"
          title="New project"
        >
          <FilePlus2 size={13} /> New
        </button>
        <button
          onClick={() => void openProject()}
          className="flex items-center gap-1.5 rounded border border-[#3a3d52] bg-[#262835] px-2.5 py-1 text-xs hover:border-[#4c9aff] hover:text-white"
          title="Open project (Ctrl+O)"
        >
          <FolderOpen size={13} /> Open
        </button>
        <button
          onClick={() => void saveProject()}
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
        <div className="ml-auto text-xs text-[#565a72]">
          Ctrl+Z undo · Ctrl+C/V copy/paste · middle-drag pan · wheel zoom · Esc cancels
        </div>
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
    </div>
  );
}
