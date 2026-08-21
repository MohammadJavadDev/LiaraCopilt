"use client";

import { useSyncExternalStore } from "react";

function subscribe(): () => void {
  return () => {};
}

function getClientSnapshot(): boolean {
  return true;
}

function getServerSnapshot(): boolean {
  return false;
}

/**
 * True only after the component has mounted on the client. Used to defer
 * rendering of values that are only known client-side (e.g. resolved
 * theme) without a hydration mismatch — implemented via
 * `useSyncExternalStore` rather than `useEffect` + `setState`.
 */
export function useHasMounted(): boolean {
  return useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
}
