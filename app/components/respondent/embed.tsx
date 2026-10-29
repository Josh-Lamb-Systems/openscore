import { useEffect, useRef } from "react";

/**
 * Embed helpers. Pages rendered inside the `/embed.js` iframe post their height
 * to the parent so it can auto-resize (docs/SPEC.md §7 "Embedding").
 */

export const EMBED_RESIZE = "openscore:resize";
export const EMBED_STEP = "openscore:step";

function post(message: Record<string, unknown>) {
  if (typeof window === "undefined" || window.parent === window) return;
  // Only the page height / a step ping is sent, so any parent origin may receive it.
  window.parent.postMessage(message, "*");
}

/** Tells the parent page that the respondent moved to a new screen (it scrolls the iframe into view). */
export function postEmbedStep() {
  post({ type: EMBED_STEP });
}

/** Observes the returned element and posts its height to the parent window. */
export function useEmbedResize<T extends HTMLElement>(enabled: boolean) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!enabled || !el) return;
    let last = 0;
    const send = () => {
      const height = Math.ceil(el.getBoundingClientRect().height);
      if (height !== last) {
        last = height;
        post({ type: EMBED_RESIZE, height });
      }
    };
    send();
    const observer = new ResizeObserver(send);
    observer.observe(el);
    // Images and fonts can change the height after first paint.
    window.addEventListener("load", send);
    return () => {
      observer.disconnect();
      window.removeEventListener("load", send);
    };
  }, [enabled]);
  return ref;
}
