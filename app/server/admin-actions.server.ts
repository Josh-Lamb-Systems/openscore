import { data } from "react-router";
import type { ActionResult } from "~/lib/admin/action-result";

/** Successful action result. */
export function ok(intent: string, message = "Saved"): ActionResult {
  return { ok: true, intent, message };
}

/** Failed action result with a 400 status. */
export function fail(intent: string, error: string, fieldErrors?: Record<string, string>) {
  return data<ActionResult>({ ok: false, intent, error, fieldErrors }, { status: 400 });
}

export function str(form: FormData, name: string): string {
  const v = form.get(name);
  return typeof v === "string" ? v : "";
}

/** Parses a JSON form field; returns undefined on bad JSON. */
export function jsonField(form: FormData, name: string): unknown {
  try {
    return JSON.parse(str(form, name));
  } catch {
    return undefined;
  }
}
