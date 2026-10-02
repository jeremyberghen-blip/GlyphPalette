// File operations as the UI runs them: each reports how it went with a pop-up,
// and anything that would throw away unsaved work asks first. Thin glue over
// persist.ts and the store.

import { create } from "zustand";
import { useApp } from "../store";
import { exportPng, isTauri, openProject, openProjectAt, saveProject, writeArchitecture } from "./persist";
import { architectureSummary, buildArchitecture } from "./architecture";
import { useSettings } from "./settings";
import { isDirty, projectLabel } from "./session";
import { toast } from "./toast";

export type UnsavedChoice = "save" | "discard" | "cancel";

interface PromptState {
  /** The question on screen, or null when no prompt is open. */
  question: string | null;
  resolve: ((c: UnsavedChoice) => void) | null;
}

/** The Save / Don't save / Cancel dialog (rendered by UnsavedPrompt). */
export const useUnsavedPrompt = create<PromptState>(() => ({ question: null, resolve: null }));

function askUnsaved(question: string): Promise<UnsavedChoice> {
  // A second request (e.g. clicking close twice) cancels the first rather than orphaning it
  useUnsavedPrompt.getState().resolve?.("cancel");
  return new Promise((resolve) => {
    useUnsavedPrompt.setState({
      question,
      resolve: (c) => {
        useUnsavedPrompt.setState({ question: null, resolve: null });
        resolve(c);
      },
    });
  });
}

interface NamePromptState {
  /** Open with this starting text, or null when closed. */
  initial: string | null;
  resolve: ((name: string | null) => void) | null;
}

/** The project-name dialog shown by New (rendered by ProjectNamePrompt). */
export const useNamePrompt = create<NamePromptState>(() => ({ initial: null, resolve: null }));

/** Asks for a project name. Resolves null if cancelled. */
function askProjectName(initial = ""): Promise<string | null> {
  useNamePrompt.getState().resolve?.(null);
  return new Promise((resolve) => {
    useNamePrompt.setState({
      initial,
      resolve: (name) => {
        useNamePrompt.setState({ initial: null, resolve: null });
        resolve(name);
      },
    });
  });
}

export const projectIsDirty = (): boolean => {
  const s = useApp.getState();
  return isDirty(s, s.savedRefs);
};

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Saves and reports it. `auto` saves quietly (corner note) and never opens a dialog. */
export async function saveNow(opts: { saveAs?: boolean; auto?: boolean } = {}): Promise<boolean> {
  if (opts.auto && !useApp.getState().filePath) return false;
  try {
    const result = await saveProject(opts.saveAs);
    if (result === "cancelled") return false;
    const name = projectLabel(useApp.getState().filePath);
    toast(opts.auto ? `Autosaved ${name}` : `Saved ${name}`, opts.auto ? "autosave" : "info");
    return true;
  } catch (e) {
    toast(`Couldn't save: ${errorText(e)}`, "error");
    return false;
  }
}

/**
 * If there are unsaved changes, asks Save / Don't save / Cancel. Resolves
 * true when it's safe to go ahead (saved, or the user chose to discard).
 */
export async function confirmDiscardIfDirty(action: string): Promise<boolean> {
  if (!projectIsDirty()) return true;
  const name = projectLabel(useApp.getState().filePath);
  const choice = await askUnsaved(`Save changes to ${name} before ${action}?`);
  if (choice === "cancel") return false;
  if (choice === "discard") return true;
  return saveNow();
}

/** New: asks about unsaved work, then for the new project's name. Nothing is saved until the user saves. */
export async function newProjectFlow(): Promise<void> {
  if (!(await confirmDiscardIfDirty("starting a new project"))) return;
  const name = await askProjectName();
  if (!name) return;
  useApp.getState().newProject(name);
  // A new project isn't saved anywhere yet, so the next startup begins fresh too
  useSettings.getState().update({ lastProjectPath: null });
}

let reopened = false;

/**
 * Startup: reopens the project last opened or saved, quietly. If that file
 * is gone or unreadable, GP starts fresh and says so. Runs once per page
 * load (React runs mount effects twice in dev).
 */
export async function reopenLastProject(): Promise<void> {
  if (reopened || !isTauri()) return;
  reopened = true;
  const path = useSettings.getState().lastProjectPath;
  if (!path) return;
  try {
    await openProjectAt(path);
  } catch (e) {
    useSettings.getState().update({ lastProjectPath: null });
    console.error(`Couldn't reopen ${path}`, e);
    toast(`Couldn't reopen ${projectLabel(path)} (moved, deleted, or unreadable) — started a new project`);
  }
}

export async function openProjectFlow(): Promise<void> {
  if (!(await confirmDiscardIfDirty("opening another project"))) return;
  try {
    if (await openProject()) toast(`Opened ${projectLabel(useApp.getState().filePath)}`);
  } catch (e) {
    toast(`Couldn't open that file: ${errorText(e)}`, "error");
  }
}

/**
 * The window's close button: asks first if there are unsaved changes, then
 * closes. Anything that goes wrong is shown, never swallowed.
 */
export async function closeWindowFlow(destroy: () => Promise<void>): Promise<void> {
  try {
    if (await confirmDiscardIfDirty("closing")) await destroy();
  } catch (e) {
    console.error("Closing the window failed", e);
    toast(`Couldn't close the window: ${errorText(e)}`, "error");
  }
}

/** What the last Publish wrote, for its summary dialog (PublishSummary); null when closed. */
export const usePublishSummary = create<{
  result: { path: string; summary: string; warnings: string[] } | null;
}>(() => ({ result: null }));

/** Publish: builds `architecture.json` from the project and writes it; problems are listed, never blocking. */
export async function publishFlow(): Promise<void> {
  const s = useApp.getState();
  const arch = buildArchitecture({
    projectName: s.projectName,
    canvases: s.canvases,
    definitions: s.definitions,
    transports: s.transports,
    styles: s.styles,
  });
  try {
    const path = await writeArchitecture(JSON.stringify(arch, null, 2));
    if (!path) return;
    usePublishSummary.setState({ result: { path, summary: architectureSummary(arch), warnings: arch.warnings } });
  } catch (e) {
    toast(`Couldn't publish: ${errorText(e)}`, "error");
  }
}

export async function exportPngFlow(dataUrl: string): Promise<void> {
  try {
    if (await exportPng(dataUrl)) toast("Exported PNG");
  } catch (e) {
    toast(`Couldn't export: ${errorText(e)}`, "error");
  }
}
