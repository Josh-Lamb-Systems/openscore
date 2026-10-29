/**
 * Uniform shape returned by admin route actions so components can read
 * `actionData` / `fetcher.data` without narrowing unions.
 */
export interface ActionResult {
  ok: boolean;
  /** Which form/intent produced this result. */
  intent: string;
  /** Success message, e.g. "Saved". */
  message?: string;
  /** Form-level error. */
  error?: string;
  /** Field-level errors keyed by input name. */
  fieldErrors?: Record<string, string>;
}
