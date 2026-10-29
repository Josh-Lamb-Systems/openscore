import { describe, expect, it } from "vitest";
import { createDefaultDefinition } from "./defaults";
import { CONSENT_ERROR_KEY, isValidEmail, isValidPhone, validateLead, validateLeadField } from "./lead";
import type { LeadField, LeadForm } from "./schema";

const form = (patch: Partial<LeadForm> = {}): LeadForm => ({ ...createDefaultDefinition("X").leadForm, ...patch });

const field = (patch: Partial<LeadField>): LeadField => ({
  id: "f",
  key: "custom_f",
  label: "Field",
  type: "text",
  required: false,
  enabled: true,
  builtIn: false,
  options: [],
  ...patch,
});

describe("isValidEmail / isValidPhone", () => {
  it("accepts reasonable values and rejects junk", () => {
    expect(isValidEmail("jo@example.com")).toBe(true);
    expect(isValidEmail("jo@example")).toBe(false);
    expect(isValidEmail("jo example.com")).toBe(false);
    expect(isValidPhone("+44 (0)20 7946-0958")).toBe(true);
    expect(isValidPhone("12345")).toBe(false);
    expect(isValidPhone("call me")).toBe(false);
  });
});

describe("validateLeadField", () => {
  it("trims text and enforces required", () => {
    expect(validateLeadField(field({ required: true }), "  Jo ")).toEqual({ value: "Jo", error: null });
    expect(validateLeadField(field({ required: true }), "   ").error).toBeTruthy();
    expect(validateLeadField(field({ required: false }), "").error).toBeNull();
  });

  it("validates select options and checkboxes", () => {
    const select = field({ type: "select", options: ["Small", "Large"] });
    expect(validateLeadField(select, "Small").error).toBeNull();
    expect(validateLeadField(select, "Huge").error).toBeTruthy();
    expect(validateLeadField(field({ type: "checkbox", required: true }), false).error).toBeTruthy();
    expect(validateLeadField(field({ type: "checkbox" }), true)).toEqual({ value: true, error: null });
  });

  it("lower-cases emails", () => {
    expect(validateLeadField(field({ type: "email" }), "Jo@Example.COM").value).toBe("jo@example.com");
  });
});

describe("validateLead", () => {
  it("returns normalised lead values and the email", () => {
    const r = validateLead(form(), { values: { firstName: "Jo", lastName: "Bloggs", email: "JO@x.io", extra: "dropped" } });
    expect(r).toEqual({ ok: true, lead: { firstName: "Jo", lastName: "Bloggs", email: "jo@x.io" }, email: "jo@x.io", consentGiven: true });
  });

  it("reports every invalid field", () => {
    const r = validateLead(form(), { values: { firstName: "", email: "nope" } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(["email", "firstName", "lastName"]);
  });

  it("ignores disabled fields", () => {
    const f = form();
    f.fields = f.fields.map((x) => (x.key === "lastName" ? { ...x, enabled: false } : x));
    const r = validateLead(f, { values: { firstName: "Jo", lastName: "Ignored", email: "jo@x.io" } });
    expect(r.ok && r.lead).toEqual({ firstName: "Jo", email: "jo@x.io" });
  });

  it("applies the consent mode", () => {
    const values = { firstName: "Jo", lastName: "B", email: "jo@x.io" };
    const consent = (mode: LeadForm["consent"]["mode"]) => ({ ...form().consent, mode });
    expect(validateLead(form({ consent: consent("implied") }), { values })).toMatchObject({ ok: true, consentGiven: true });
    expect(validateLead(form({ consent: consent("explicit_optional") }), { values })).toMatchObject({ ok: true, consentGiven: false });
    expect(validateLead(form({ consent: consent("explicit_optional") }), { values, consent: true })).toMatchObject({ consentGiven: true });
    const required = validateLead(form({ consent: consent("explicit_required") }), { values });
    expect(required.ok === false && required.errors[CONSENT_ERROR_KEY]).toBeTruthy();
    expect(validateLead(form({ consent: consent("explicit_required") }), { values, consent: true }).ok).toBe(true);
  });

  it("falls back to the first email-type field when the built-in email is disabled", () => {
    const f = form();
    f.fields = [
      ...f.fields.map((x) => (x.key === "email" ? { ...x, enabled: false } : x)),
      field({ key: "custom_work", type: "email", required: true }),
    ];
    const r = validateLead(f, { values: { firstName: "Jo", lastName: "B", custom_work: "w@x.io" } });
    expect(r.ok && r.email).toBe("w@x.io");
  });
});
