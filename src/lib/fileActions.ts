// File operations as the UI runs them: each reports how it went with a pop-up,
// and anything that would throw away unsaved work asks first. Thin glue over
// persist.ts and the store.

import { create } from "zustand";
import { useApp } from "../store";
import { exportPng, openProject, saveProject } from "./persist";
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

export async function newProjectFlow(): Promise<void> {
  if (await confirmDiscardIfDirty("starting a new project")) useApp.getState().newProject();
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

export async function exportPngFlow(dataUrl: string): Promise<void> {
  try {
    if (await exportPng(dataUrl)) toast("Exported PNG");
  } catch (e) {
    toast(`Couldn't export: ${errorText(e)}`, "error");
  }
}
