import { redirect } from "react-router";
import { auth } from "./auth.server";

/** Copies Set-Cookie headers from a Better Auth response onto a redirect. */
export function redirectWithAuthCookies(authResponse: Response, to: string): Response {
  const headers = new Headers();
  for (const cookie of authResponse.headers.getSetCookie()) headers.append("Set-Cookie", cookie);
  return redirect(to, { headers });
}

/** Better Auth returns JSON errors like { message, code }. */
export async function authErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.clone().json()) as { message?: string };
    return body.message || fallback;
  } catch {
    return fallback;
  }
}

export async function signInWithPassword(request: Request, email: string, password: string) {
  return auth.api.signInEmail({
    body: { email, password },
    headers: request.headers,
    asResponse: true,
  });
}

export async function signUpWithPassword(request: Request, name: string, email: string, password: string) {
  return auth.api.signUpEmail({
    body: { name, email, password },
    headers: request.headers,
    asResponse: true,
  });
}

/** Only allow same-site relative redirects. */
export function safeRedirect(to: FormDataEntryValue | string | null, fallback = "/scorecards"): string {
  if (typeof to !== "string" || !to.startsWith("/") || to.startsWith("//")) return fallback;
  return to;
}
