import { CheckCircle2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { FetcherWithComponents } from "react-router";
import type { ActionResult } from "~/lib/admin/action-result";
import { cn } from "~/lib/utils";

/**
 * True for a few seconds after a fetcher/form finishes with `{ ok: true }`.
 * Pass the fetcher's (or navigation's) state and the latest result.
 */
export function useFlash(
  state: "idle" | "loading" | "submitting",
  result: ActionResult | undefined | null,
  intent?: string,
) {
  const [flash, setFlash] = useState(false);
  const prev = useRef(state);
  useEffect(() => {
    const finished = prev.current !== "idle" && state === "idle";
    prev.current = state;
    if (finished && result?.ok && (!intent || result.intent === intent)) {
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 2500);
      return () => clearTimeout(t);
    }
  }, [state, result, intent]);
  return flash;
}

/** "✓ Saved" text that appears briefly after a successful fetcher submission. */
export function SavedIndicator({
  fetcher,
  intent,
  className,
}: {
  fetcher: Pick<FetcherWithComponents<ActionResult>, "state" | "data">;
  intent?: string;
  className?: string;
}) {
  const flash = useFlash(fetcher.state, fetcher.data, intent);
  return (
    <span
      aria-live="polite"
      className={cn(
        "inline-flex items-center gap-1 text-sm text-green-700 transition-opacity",
        flash ? "opacity-100" : "opacity-0",
        className,
      )}
    >
      {flash && (
        <>
          <CheckCircle2 className="size-4" /> {fetcher.data?.message ?? "Saved"}
        </>
      )}
    </span>
  );
}

/** Form-level error from an action result (hidden when ok or for other intents). */
export function ResultError({
  result,
  intent,
  className,
}: {
  result: ActionResult | undefined | null;
  intent?: string;
  className?: string;
}) {
  if (!result || result.ok || !result.error || (intent && result.intent !== intent)) return null;
  return (
    <div
      role="alert"
      className={cn("rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800", className)}
    >
      {result.error}
    </div>
  );
}
