import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** False during SSR and hydration, true afterwards (avoids hydration mismatches for client-only values). */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}

/**
 * Formats a date in the viewer's time zone. The server (and hydration) render
 * uses UTC so the markup matches, then the browser switches to local time.
 */
export function DateTime({ value, className }: { value: Date | string; className?: string }) {
  const hydrated = useHydrated();
  const d = typeof value === "string" ? new Date(value) : value;
  const text = new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: hydrated ? undefined : "UTC",
  }).format(d);
  return (
    <time dateTime={d.toISOString()} className={className} title={hydrated ? undefined : "UTC"}>
      {text}
    </time>
  );
}
