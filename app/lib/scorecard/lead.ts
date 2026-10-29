import { respondentStrings as t } from "~/lib/respondent-strings";
import type { LeadField, LeadForm } from "./schema";

/**
 * Respondent lead form validation. Pure and isomorphic: the public flow runs it
 * in the browser for instant feedback, and `/api/respond` runs it again on the
 * server before storing anything.
 */

export type LeadValues = Record<string, string | boolean>;

export interface LeadInput {
  /** Raw values keyed by field key (firstName, email, custom_*). */
  values: Record<string, unknown>;
  /** Whether the consent checkbox was ticked (ignored for implied consent). */
  consent?: boolean;
}

export type LeadValidation =
  | { ok: true; lead: LeadValues; email: string | null; consentGiven: boolean }
  | { ok: false; errors: Record<string, string> };

/** Key used in the error map for the consent checkbox. */
export const CONSENT_ERROR_KEY = "__consent";

const MAX_TEXT = 500;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidEmail(value: string): boolean {
  return value.length <= 254 && EMAIL_RE.test(value);
}

/** Lenient phone check: digits with common separators, 6–20 digits. */
export function isValidPhone(value: string): boolean {
  if (!/^\+?[\d\s().-]+$/.test(value)) return false;
  const digits = value.replace(/\D/g, "").length;
  return digits >= 6 && digits <= 20;
}

export function enabledLeadFields(form: LeadForm): LeadField[] {
  return form.fields.filter((f) => f.enabled);
}

/** Validates a single field value. Returns the normalised value or an error message. */
export function validateLeadField(
  field: LeadField,
  raw: unknown,
): { value: string | boolean | undefined; error: string | null } {
  if (field.type === "checkbox") {
    const checked = raw === true || raw === "true" || raw === "on";
    if (field.required && !checked) return { value: checked, error: t.fieldRequired };
    return { value: checked, error: null };
  }

  const value = typeof raw === "string" ? raw.trim() : typeof raw === "number" ? String(raw) : "";
  if (!value) return { value: undefined, error: field.required ? t.fieldRequired : null };
  if (value.length > MAX_TEXT) return { value, error: t.fieldTooLong };

  switch (field.type) {
    case "email":
      return { value: value.toLowerCase(), error: isValidEmail(value) ? null : t.invalidEmail };
    case "phone":
      return { value, error: isValidPhone(value) ? null : t.invalidPhone };
    case "select":
      return { value, error: field.options.includes(value) ? null : t.invalidOption };
    default:
      return { value, error: null };
  }
}

export function consentRequired(form: LeadForm): boolean {
  return form.consent.mode === "explicit_required";
}

export function validateLead(form: LeadForm, input: LeadInput): LeadValidation {
  const errors: Record<string, string> = {};
  const lead: LeadValues = {};

  for (const field of enabledLeadFields(form)) {
    const { value, error } = validateLeadField(field, input.values[field.key]);
    if (error) errors[field.key] = error;
    else if (value !== undefined) lead[field.key] = value;
  }

  const consentGiven = form.consent.mode === "implied" ? true : input.consent === true;
  if (consentRequired(form) && !consentGiven) errors[CONSENT_ERROR_KEY] = t.consentRequired;

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  // The response's `email` column: the built-in email field, else the first email-type field.
  const emailField =
    enabledLeadFields(form).find((f) => f.key === "email") ?? enabledLeadFields(form).find((f) => f.type === "email");
  const email = emailField && typeof lead[emailField.key] === "string" ? (lead[emailField.key] as string) : null;

  return { ok: true, lead, email, consentGiven };
}
