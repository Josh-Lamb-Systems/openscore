import { appUrl } from "~/server/env.server";

/**
 * `/embed.js`: turns `<div data-openscore="<slug>"></div>` elements into
 * auto-resizing iframes of `/embed/<slug>`. The iframe posts
 * `{ type: "openscore:resize", height }` (see components/respondent/embed.tsx).
 *
 * Optional attributes: `data-height` (initial height in px, default 600) and
 * `data-title` (iframe title for screen readers).
 * `window.OpenScore.init()` re-scans the page for elements added later.
 */
function script(origin: string): string {
  return `/*! OpenScore embed */
(function () {
  "use strict";
  var ORIGIN = ${JSON.stringify(origin)};
  var frames = [];

  function init(root) {
    var nodes = (root || document).querySelectorAll("[data-openscore]");
    for (var i = 0; i < nodes.length; i++) mount(nodes[i]);
  }

  function mount(el) {
    if (el.getAttribute("data-openscore-mounted")) return;
    var slug = el.getAttribute("data-openscore");
    if (!slug) return;
    el.setAttribute("data-openscore-mounted", "1");
    var iframe = document.createElement("iframe");
    iframe.src = ORIGIN + "/embed/" + encodeURIComponent(slug);
    iframe.title = el.getAttribute("data-title") || "Scorecard";
    iframe.setAttribute("allow", "fullscreen");
    iframe.setAttribute("scrolling", "no");
    iframe.style.cssText = "display:block;width:100%;border:0;overflow:hidden;height:" +
      (parseInt(el.getAttribute("data-height") || "", 10) || 600) + "px";
    el.appendChild(iframe);
    frames.push(iframe);
  }

  function frameFor(source) {
    for (var i = 0; i < frames.length; i++) {
      if (frames[i].contentWindow === source) return frames[i];
    }
    return null;
  }

  window.addEventListener("message", function (event) {
    if (event.origin !== ORIGIN) return;
    var data = event.data;
    if (!data || typeof data !== "object") return;
    var iframe = frameFor(event.source);
    if (!iframe) return;
    if (data.type === "openscore:resize" && typeof data.height === "number" && data.height > 0) {
      iframe.style.height = Math.ceil(data.height) + "px";
    } else if (data.type === "openscore:step") {
      var top = iframe.getBoundingClientRect().top;
      if (top < 0 || top > window.innerHeight * 0.5) iframe.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });

  window.OpenScore = window.OpenScore || {};
  window.OpenScore.init = init;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { init(); });
  } else {
    init();
  }
})();
`;
}

export function loader() {
  const origin = new URL(appUrl()).origin;
  return new Response(script(origin), {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
      "Access-Control-Allow-Origin": "*",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
