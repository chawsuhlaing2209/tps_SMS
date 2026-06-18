"use client";

import { useEffect, useState } from "react";

export type NavigationSegment = { label: string; href: string };

const STORAGE_KEY = "sms-navigation-trail";
const TRAIL_EVENT = "sms-navigation-trail-change";

export function readNavigationTrail(): NavigationSegment[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as NavigationSegment[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeNavigationTrail(trail: NavigationSegment[]) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(trail));
  window.dispatchEvent(new Event(TRAIL_EVENT));
}

export function resetNavigationTrail(segments: NavigationSegment[]) {
  writeNavigationTrail(segments);
}

export function appendNavigationTrail(segment: NavigationSegment) {
  const trail = readNavigationTrail();
  const last = trail[trail.length - 1];
  if (last?.href === segment.href) {
    return;
  }
  writeNavigationTrail([...trail, segment]);
}

/** Register the current page; truncates forward history when revisiting an earlier step. */
export function registerNavigationSegment(segment: NavigationSegment) {
  const trail = readNavigationTrail();
  const index = trail.findIndex((item) => item.href === segment.href);

  if (index >= 0) {
    if (index < trail.length - 1) {
      writeNavigationTrail(trail.slice(0, index + 1));
    }
    return;
  }

  const last = trail[trail.length - 1];
  if (last?.href === segment.href) {
    return;
  }

  writeNavigationTrail([...trail, segment]);
}

export function getNavigationParent(): NavigationSegment | null {
  const trail = readNavigationTrail();
  return trail.length >= 2 ? trail[trail.length - 2]! : null;
}

export function useNavigationTrail(): NavigationSegment[] {
  const [trail, setTrail] = useState<NavigationSegment[]>([]);

  useEffect(() => {
    const sync = () => setTrail(readNavigationTrail());
    sync();
    window.addEventListener(TRAIL_EVENT, sync);
    return () => window.removeEventListener(TRAIL_EVENT, sync);
  }, []);

  return trail;
}

export function navigateWithTrail(
  router: { push: (href: string) => void },
  targetHref: string,
  from: NavigationSegment
) {
  appendNavigationTrail(from);
  router.push(targetHref);
}
