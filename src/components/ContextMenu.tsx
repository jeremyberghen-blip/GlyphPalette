import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { create } from "zustand";

export interface MenuItem {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  /** Why it's disabled, or what it does — shown on hover. */
  title?: string;
  /** Keyboard shortcut shown on the right. */
  shortcut?: string;
  danger?: boolean;
}
export type MenuEntry = MenuItem | "separator";

interface MenuState {
  at: { x: number; y: number } | null;
  items: MenuEntry[];
}

/** The open right-click menu, if any (one at a time, app-wide). */
export const useContextMenu = create<MenuState>(() => ({ at: null, items: [] }));

export const openContextMenu = (x: number, y: number, items: MenuEntry[]) =>
  useContextMenu.setState({ at: { x, y }, items });
export const closeContextMenu = () => useContextMenu.setState({ at: null, items: [] });

/** Renders the open menu at the pointer, kept on screen. Closes on any outside click, Esc, scroll, or resize. */
export default function ContextMenu() {
  const { at, items } = useContextMenu();
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  useLayoutEffect(() => {
    if (!at || !ref.current) return setPos(null);
    const { offsetWidth: w, offsetHeight: h } = ref.current;
    setPos({
      x: Math.max(4, Math.min(at.x, window.innerWidth - w - 4)),
      y: Math.max(4, Math.min(at.y, window.innerHeight - h - 4)),
    });
  }, [at, items]);

  useEffect(() => {
    if (!at) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) closeContextMenu();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeContextMenu();
    window.addEventListener("mousedown", onDown, true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("wheel", closeContextMenu, true);
    window.addEventListener("resize", closeContextMenu);
    window.addEventListener("blur", closeContextMenu);
    return () => {
      window.removeEventListener("mousedown", onDown, true);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("wheel", closeContextMenu, true);
      window.removeEventListener("resize", closeContextMenu);
      window.removeEventListener("blur", closeContextMenu);
    };
  }, [at]);

  if (!at) return null;
  return (
    <div
      ref={ref}
      className="fixed z-[80] min-w-[200px] rounded-md border border-[#3a3d52] bg-[#22242e] py-1 text-sm shadow-2xl"
      style={{ left: pos?.x ?? at.x, top: pos?.y ?? at.y, visibility: pos ? "visible" : "hidden" }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item, i) =>
        item === "separator" ? (
          <div key={i} className="my-1 h-px bg-[#2e3040]" />
        ) : (
          // Disabled items stay hoverable (not `disabled`) so their reason shows on hover
          <button
            key={i}
            aria-disabled={item.disabled}
            title={item.title}
            onClick={() => {
              if (item.disabled) return;
              closeContextMenu();
              item.onClick();
            }}
            className={`flex w-full items-center justify-between gap-6 px-3 py-1 text-left ${
              item.disabled
                ? "cursor-default text-[#e2e4ee] opacity-40"
                : item.danger
                  ? "text-[#fca5a5] hover:bg-[#4a2028]"
                  : "text-[#e2e4ee] hover:bg-[#2b3a55]"
            }`}
          >
            <span>{item.label}</span>
            {item.shortcut && <span className="text-xs text-[#7a7d92]">{item.shortcut}</span>}
          </button>
        )
      )}
    </div>
  );
}
