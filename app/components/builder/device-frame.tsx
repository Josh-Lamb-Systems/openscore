import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

const SRC_DOC =
  '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>' +
  '<body style="margin:0;height:100%"><div id="root" style="height:100%"></div></body></html>';

/**
 * Renders children inside a same-origin iframe so that viewport media queries
 * (`sm:`, `md:` in the respondent components) respond to the preview width,
 * not the admin window. The parent page's stylesheets are mirrored into the
 * frame (and re-synced when they change, e.g. during HMR).
 */
export function IsolatedFrame({ title, children }: { title: string; children: React.ReactNode }) {
  const [frame, setFrame] = useState<HTMLIFrameElement | null>(null);
  const [mount, setMount] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!frame) return;
    let observer: MutationObserver | null = null;

    const setup = () => {
      const doc = frame.contentDocument;
      if (!doc?.body) return;
      doc.documentElement.style.height = "100%";
      const syncStyles = () => {
        doc.head.querySelectorAll("[data-mirrored]").forEach((n) => n.remove());
        document.head.querySelectorAll('link[rel="stylesheet"], style').forEach((node) => {
          const copy = node.cloneNode(true) as HTMLElement;
          copy.setAttribute("data-mirrored", "");
          doc.head.appendChild(copy);
        });
      };
      syncStyles();
      observer = new MutationObserver(syncStyles);
      observer.observe(document.head, { childList: true, subtree: true, characterData: true });
      // Forward shortcuts (save, undo/redo) typed inside the frame to the builder.
      doc.addEventListener("keydown", forwardKey);
      setMount(doc.getElementById("root"));
    };

    const forwardKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const copy = new KeyboardEvent("keydown", e);
      window.dispatchEvent(copy);
      if (copy.defaultPrevented) e.preventDefault();
    };

    if (frame.contentDocument?.readyState === "complete" && frame.contentDocument.getElementById("root")) setup();
    else frame.addEventListener("load", setup, { once: true });

    return () => {
      frame.removeEventListener("load", setup);
      frame.contentDocument?.removeEventListener("keydown", forwardKey);
      observer?.disconnect();
      setMount(null);
    };
  }, [frame]);

  return (
    <>
      <iframe ref={setFrame} title={title} srcDoc={SRC_DOC} className="block size-full border-0" />
      {mount && createPortal(children, mount)}
    </>
  );
}
