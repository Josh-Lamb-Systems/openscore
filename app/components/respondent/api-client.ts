import type { RespondError, RespondRequest, RespondResult } from "~/lib/respond-api";
import { respondentStrings as t } from "~/lib/respondent-strings";

/** Calls `POST /api/respond`. Never throws; network failures become a RespondError. */
export async function respond<T extends RespondResult>(body: RespondRequest): Promise<T | RespondError> {
  try {
    const res = await fetch("/api/respond", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      credentials: "same-origin",
    });
    const data = (await res.json().catch(() => null)) as T | RespondError | null;
    return data ?? { ok: false, error: t.somethingWentWrong };
  } catch {
    return { ok: false, error: t.somethingWentWrong };
  }
}

export interface StoredSession {
  responseId: string;
  resultToken: string;
  step?: "questions" | "lead";
  index?: number;
}

export function readSession(key: string): StoredSession | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const v = JSON.parse(raw) as StoredSession;
    return typeof v?.responseId === "string" && typeof v?.resultToken === "string" ? v : null;
  } catch {
    return null;
  }
}

export function writeSession(key: string, value: StoredSession) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage may be unavailable (private mode, blocked third-party storage in iframes).
  }
}

export function clearSession(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}
