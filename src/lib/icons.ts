// Renders lucide icons to HTMLImageElement for use in Konva.
// Icons are rasterized from SVG data-URIs and cached by name+color.

import { icons } from "lucide-react";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement, useEffect, useState } from "react";

const cache = new Map<string, HTMLImageElement>();
const pending = new Map<string, Promise<HTMLImageElement>>();

export function iconNames(): string[] {
  return Object.keys(icons);
}

/** Resolver for "custom:<id>" icons; wired to the store in App setup. */
let customResolver: (id: string) => string | undefined = () => undefined;
export function setCustomIconResolver(fn: (id: string) => string | undefined) {
  customResolver = fn;
}

export function loadIcon(name: string, color = "#e2e4ee"): Promise<HTMLImageElement> {
  const key = `${name}|${color}`;
  const hit = cache.get(key);
  if (hit) return Promise.resolve(hit);
  const inflight = pending.get(key);
  if (inflight) return inflight;

  let url: string;
  if (name.startsWith("custom:")) {
    url = customResolver(name.slice(7)) ?? "";
  } else {
    const Icon = icons[name as keyof typeof icons] ?? icons.CircleQuestionMark;
    const svg = renderToStaticMarkup(
      createElement(Icon, { color, size: 48, strokeWidth: 1.75 })
    );
    url = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }

  const p = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image(48, 48);
    img.onload = () => {
      cache.set(key, img);
      pending.delete(key);
      resolve(img);
    };
    img.onerror = reject;
    img.src = url;
  });
  pending.set(key, p);
  return p;
}

export function useIcon(name: string, color = "#e2e4ee"): HTMLImageElement | null {
  const [img, setImg] = useState<HTMLImageElement | null>(
    () => cache.get(`${name}|${color}`) ?? null
  );
  useEffect(() => {
    let alive = true;
    loadIcon(name, color).then((i) => {
      if (alive) setImg(i);
    });
    return () => {
      alive = false;
    };
  }, [name, color]);
  return img;
}
