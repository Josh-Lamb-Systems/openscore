/**
 * The production server rebuilds every request URL from APP_URL (the public
 * origin), so React Router's action CSRF check (Origin header vs request URL)
 * works behind TLS-terminating reverse proxies, which otherwise make the app
 * see `http://<internal host>` while browsers send `Origin: https://<public host>`.
 */

export interface PublicOrigin {
  /** "https" | "http" */
  protocol: string;
  /** Host with optional port, e.g. "scores.example.com" or "localhost:3000". */
  host: string;
  /** e.g. "https://scores.example.com" */
  origin: string;
}

export function parsePublicOrigin(appUrl: string): PublicOrigin {
  const url = new URL(appUrl);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`APP_URL must be an http(s) URL, got "${appUrl}"`);
  }
  return { protocol: url.protocol.slice(0, -1), host: url.host, origin: url.origin };
}

/**
 * Headers to force onto each incoming request (with Express `trust proxy` on) so
 * the request URL React Router sees is the public origin. Client-supplied
 * forwarding headers are overwritten, never trusted.
 */
export function forwardedHeadersFor(origin: PublicOrigin): Record<string, string> {
  return { "x-forwarded-proto": origin.protocol, "x-forwarded-host": origin.host };
}

/**
 * For mutating requests: an explanation when the browser's Origin doesn't match
 * APP_URL (React Router will reject the action with a bare 400), else null.
 */
export function originMismatchWarning(method: string, originHeader: string | undefined, origin: PublicOrigin): string | null {
  if (method === "GET" || method === "HEAD" || !originHeader || originHeader === "null") return null;
  let requestOrigin: string;
  try {
    requestOrigin = new URL(originHeader).origin;
  } catch {
    return null;
  }
  if (requestOrigin === origin.origin) return null;
  return (
    `Rejected a form submission from ${requestOrigin} because it doesn't match APP_URL (${origin.origin}). ` +
    `If ${requestOrigin} is where people reach OpenScore, set APP_URL=${requestOrigin} and restart.`
  );
}
