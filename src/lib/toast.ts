// Pop-up feedback: brief center messages for saves/opens/exports, red errors
// that stay until dismissed, and quiet corner notes for autosaves.

import { create } from "zustand";

export type ToastKind = "info" | "error" | "autosave";

export interface Toast {
  id: number;
  kind: ToastKind;
  text: string;
}

const FADE_AFTER_MS = 1500;
let next = 0;

interface ToastState {
  toasts: Toast[];
  dismiss: (id: number) => void;
}

export const useToasts = create<ToastState>((set) => ({
  toasts: [],
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** Shows a message. Errors stay until clicked away; everything else fades. */
export function toast(text: string, kind: ToastKind = "info"): void {
  const t: Toast = { id: ++next, kind, text };
  useToasts.setState((s) => ({ toasts: [...s.toasts.filter((x) => x.kind !== kind || kind === "error"), t] }));
  if (kind !== "error") setTimeout(() => useToasts.getState().dismiss(t.id), FADE_AFTER_MS);
}
