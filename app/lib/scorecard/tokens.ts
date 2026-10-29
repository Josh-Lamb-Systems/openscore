/** Result page tokens: {{firstName}}, {{lastName}}, {{score}}, {{tier}}, {{constraint}} (docs/SPEC.md §6). */

/**
 * Replaces {{firstName}}, {{lastName}}, {{score}}, {{tier}} and {{constraint}} in
 * plain text (rendered by React, so no escaping needed); unknown or empty tokens become "".
 */
export function interpolate(template: string, vars: Record<string, string>): string {
  return template
    .replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => vars[key] ?? "")
    .replace(/\s+([,.!?])/g, "$1")
    .replace(/,\s*$/, "")
    .trim();
}

const HTML_ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

/**
 * Token replacement inside sanitised rich-text HTML. Values are HTML-escaped,
 * since they include respondent input (e.g. their first name).
 */
export function interpolateHtml(html: string, vars: Record<string, string>): string {
  return html.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) =>
    (vars[key] ?? "").replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]),
  );
}
