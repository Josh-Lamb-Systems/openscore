/**
 * Minimal RFC 4180 CSV writer.
 *
 * Cells containing a comma, quote, CR or LF are quoted (quotes doubled). Text cells
 * that would be interpreted as a formula by spreadsheet apps (=, +, -, @, tab, CR)
 * are prefixed with an apostrophe, since lead data comes from untrusted respondents.
 * Numeric-looking strings (e.g. "-5" or "-5 kg") are left alone.
 */
export type CsvValue = string | number | boolean | null | undefined | Date;

const FORMULA_START = /^[=+\-@\t\r]/;
const NUMERIC_START = /^-?\d/;

export function csvCell(value: CsvValue): string {
  if (value == null) return "";
  let s: string;
  if (value instanceof Date) s = value.toISOString();
  else if (typeof value === "number") s = Number.isFinite(value) ? String(value) : "";
  else if (typeof value === "boolean") s = value ? "true" : "false";
  else {
    s = value;
    if (FORMULA_START.test(s) && !NUMERIC_START.test(s)) s = `'${s}`;
  }
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: CsvValue[][]): string {
  return rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
