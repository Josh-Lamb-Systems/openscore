import type { CSSProperties } from "react";

/**
 * Brand tokens control the look of respondent-facing pages (start screen,
 * questions, result page). Stored on brand kits and as per-scorecard overrides.
 */
export interface BrandTokens {
  logoUrl: string;
  primaryColor: string;
  accentColor: string;
  textColor: string;
  backgroundColor: string;
  /** Surface behind the question card / sections. */
  surfaceColor: string;
  backgroundImageUrl: string;
  /** A key from FONT_OPTIONS. */
  font: string;
  /** Button corner radius in px. */
  buttonRadius: number;
  buttonStyle: "solid" | "outline";
}

export const DEFAULT_BRAND_TOKENS: BrandTokens = {
  logoUrl: "",
  primaryColor: "#0D9488",
  accentColor: "#0F172A",
  textColor: "#0F172A",
  backgroundColor: "#F1F5F9",
  surfaceColor: "#FFFFFF",
  backgroundImageUrl: "",
  font: "inter",
  buttonRadius: 6,
  buttonStyle: "solid",
};

export const FONT_OPTIONS: Record<string, { label: string; family: string; googleFamily: string | null }> = {
  system: { label: "System", family: "ui-sans-serif, system-ui, sans-serif", googleFamily: null },
  inter: { label: "Inter", family: "'Inter', ui-sans-serif, system-ui, sans-serif", googleFamily: "Inter:wght@400;500;600;700" },
  roboto: { label: "Roboto", family: "'Roboto', ui-sans-serif, sans-serif", googleFamily: "Roboto:wght@400;500;700" },
  open_sans: { label: "Open Sans", family: "'Open Sans', ui-sans-serif, sans-serif", googleFamily: "Open+Sans:wght@400;600;700" },
  lato: { label: "Lato", family: "'Lato', ui-sans-serif, sans-serif", googleFamily: "Lato:wght@400;700" },
  montserrat: { label: "Montserrat", family: "'Montserrat', ui-sans-serif, sans-serif", googleFamily: "Montserrat:wght@400;500;600;700" },
  poppins: { label: "Poppins", family: "'Poppins', ui-sans-serif, sans-serif", googleFamily: "Poppins:wght@400;500;600;700" },
  dm_sans: { label: "DM Sans", family: "'DM Sans', ui-sans-serif, sans-serif", googleFamily: "DM+Sans:wght@400;500;700" },
  merriweather: { label: "Merriweather", family: "'Merriweather', Georgia, serif", googleFamily: "Merriweather:wght@400;700" },
  playfair: { label: "Playfair Display", family: "'Playfair Display', Georgia, serif", googleFamily: "Playfair+Display:wght@400;600;700" },
};

export function resolveTheme(
  kit: Partial<BrandTokens> | null | undefined,
  overrides: Partial<BrandTokens> | null | undefined,
): BrandTokens {
  const clean = (o: Partial<BrandTokens> | null | undefined) =>
    Object.fromEntries(Object.entries(o ?? {}).filter(([, v]) => v !== undefined && v !== null));
  return { ...DEFAULT_BRAND_TOKENS, ...clean(kit), ...clean(overrides) } as BrandTokens;
}

/** Google Fonts stylesheet URL for a theme, or null for system fonts. */
export function themeFontHref(theme: BrandTokens): string | null {
  const font = FONT_OPTIONS[theme.font] ?? FONT_OPTIONS.inter;
  return font.googleFamily
    ? `https://fonts.googleapis.com/css2?family=${font.googleFamily}&display=swap`
    : null;
}

/**
 * CSS custom properties consumed by respondent components (`--os-*`).
 * Apply to the wrapping element of any respondent-facing view.
 */
export function themeStyle(theme: BrandTokens): CSSProperties {
  const font = FONT_OPTIONS[theme.font] ?? FONT_OPTIONS.inter;
  return {
    "--os-primary": theme.primaryColor,
    "--os-accent": theme.accentColor,
    "--os-text": theme.textColor,
    "--os-bg": theme.backgroundColor,
    "--os-surface": theme.surfaceColor,
    "--os-radius": `${theme.buttonRadius}px`,
    "--os-font": font.family,
    fontFamily: font.family,
    color: theme.textColor,
    backgroundColor: theme.backgroundColor,
    backgroundImage: theme.backgroundImageUrl ? `url(${JSON.stringify(theme.backgroundImageUrl)})` : undefined,
    backgroundSize: "cover",
    backgroundPosition: "center",
  } as CSSProperties;
}
