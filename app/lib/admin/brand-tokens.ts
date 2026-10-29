import { z } from "zod";
import { DEFAULT_BRAND_TOKENS, FONT_OPTIONS, type BrandTokens } from "~/lib/theme";

const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function isHexColor(v: string): boolean {
  return HEX.test(v);
}

/** "#abc" → "#AABBCC"; returns null for anything that isn't a hex colour. */
export function normalizeHex(v: string): string | null {
  const s = v.trim().startsWith("#") ? v.trim() : `#${v.trim()}`;
  if (!HEX.test(s)) return null;
  const hex = s.length === 4 ? `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}` : s;
  return hex.toUpperCase();
}

export function isHttpUrl(v: string): boolean {
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

const color = z.string().regex(HEX, "Use a hex colour like #0D9488.");
const optionalUrl = z
  .string()
  .trim()
  .refine((v) => v === "" || isHttpUrl(v), "Use a full http(s):// URL.");

export const brandTokensSchema = z.object({
  logoUrl: optionalUrl,
  primaryColor: color,
  accentColor: color,
  textColor: color,
  backgroundColor: color,
  surfaceColor: color,
  backgroundImageUrl: optionalUrl,
  font: z.string().refine((f) => f in FONT_OPTIONS, "Choose a font from the list."),
  buttonRadius: z.number().int().min(0).max(40),
  buttonStyle: z.enum(["solid", "outline"]),
}) satisfies z.ZodType<BrandTokens>;

export const brandTokenOverridesSchema = brandTokensSchema.partial();

/** Display metadata for each token, in editor order. */
export const BRAND_TOKEN_FIELDS: {
  key: keyof BrandTokens;
  label: string;
  kind: "url" | "color" | "font" | "radius" | "style";
  hint?: string;
}[] = [
  { key: "logoUrl", label: "Logo URL", kind: "url", hint: "A PNG or SVG with a transparent background works best." },
  { key: "primaryColor", label: "Primary colour", kind: "color", hint: "Buttons, progress bar and highlights." },
  { key: "accentColor", label: "Accent colour", kind: "color" },
  { key: "textColor", label: "Text colour", kind: "color" },
  { key: "backgroundColor", label: "Background colour", kind: "color" },
  { key: "surfaceColor", label: "Surface colour", kind: "color", hint: "Cards and panels on top of the background." },
  { key: "backgroundImageUrl", label: "Background image URL", kind: "url" },
  { key: "font", label: "Font", kind: "font" },
  { key: "buttonRadius", label: "Button radius", kind: "radius" },
  { key: "buttonStyle", label: "Button style", kind: "style" },
];

/** Parses a JSON payload into full tokens, filling gaps from the defaults. */
export function parseBrandTokens(
  json: string,
): { ok: true; tokens: BrandTokens } | { ok: false; errors: Record<string, string> } {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { ok: false, errors: { form: "Invalid data." } };
  }
  const parsed = brandTokensSchema.safeParse({ ...DEFAULT_BRAND_TOKENS, ...(raw as object) });
  if (!parsed.success) return { ok: false, errors: zodFieldErrors(parsed.error) };
  return { ok: true, tokens: parsed.data };
}

export function parseBrandTokenOverrides(
  json: string,
): { ok: true; overrides: Partial<BrandTokens> } | { ok: false; errors: Record<string, string> } {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { ok: false, errors: { form: "Invalid data." } };
  }
  const parsed = brandTokenOverridesSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: zodFieldErrors(parsed.error) };
  const overrides = Object.fromEntries(Object.entries(parsed.data).filter(([, v]) => v !== undefined));
  return { ok: true, overrides: overrides as Partial<BrandTokens> };
}

/** First message per top-level path. */
export function zodFieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}
