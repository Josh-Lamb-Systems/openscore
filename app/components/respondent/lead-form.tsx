import { ChevronDown } from "lucide-react";
import { useId } from "react";
import { respondentStrings as t } from "~/lib/respondent-strings";
import { CONSENT_ERROR_KEY, enabledLeadFields } from "~/lib/scorecard/lead";
import type { LeadField, LeadForm as LeadFormConfig } from "~/lib/scorecard/schema";
import { cn } from "~/lib/utils";
import { ThemedButton } from "./frame";

export type LeadFormValues = Record<string, string | boolean>;

export interface LeadFormProps {
  form: LeadFormConfig;
  values: LeadFormValues;
  onChange: (values: LeadFormValues) => void;
  consent: boolean;
  onConsentChange: (consent: boolean) => void;
  errors: Record<string, string>;
  /** General error shown above the submit button (e.g. network failure). */
  formError?: string | null;
  submitting?: boolean;
  submitLabel: string;
  title?: string;
  onSubmit: () => void;
  className?: string;
}

/** Built-in name fields sit side by side; everything else spans the full width. */
const HALF_WIDTH = new Set(["firstName", "lastName"]);

const inputClass =
  "w-full rounded-[var(--os-radius)] border border-current/20 bg-[var(--os-surface)] px-4 py-3 text-base text-[var(--os-text)] placeholder:text-current/50 focus:border-[var(--os-primary)] focus:outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--os-primary)_25%,transparent)] aria-invalid:border-red-500";

/**
 * The respondent lead form (docs/SPEC.md §7): enabled fields in order, required
 * markers, consent per mode and inline validation errors.
 */
export function LeadForm({
  form,
  values,
  onChange,
  consent,
  onConsentChange,
  errors,
  formError,
  submitting,
  submitLabel,
  title,
  onSubmit,
  className,
}: LeadFormProps) {
  const fields = enabledLeadFields(form);
  const uid = useId();
  const { mode, label: consentLabel, privacyStatement, privacyUrl } = form.consent;
  const set = (key: string, value: string | boolean) => onChange({ ...values, [key]: value });
  // Pair adjacent half-width fields; a lone one spans the row.
  const spans = fields.map((f, i) => {
    if (!HALF_WIDTH.has(f.key)) return false;
    const prev = fields[i - 1];
    const next = fields[i + 1];
    return (prev && HALF_WIDTH.has(prev.key)) || (next && HALF_WIDTH.has(next.key));
  });

  return (
    <form
      noValidate
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      {title && <h2 className="mb-5 text-xl font-medium leading-snug">{title}</h2>}
      <div className="grid grid-cols-2 gap-3">
        {fields.map((f, i) => (
          <div key={f.id} className={spans[i] ? "col-span-2 sm:col-span-1" : "col-span-2"}>
            <LeadFieldInput
              field={f}
              id={`${uid}-${f.id}`}
              value={values[f.key]}
              error={errors[f.key]}
              onChange={(v) => set(f.key, v)}
              disabled={submitting}
            />
          </div>
        ))}
      </div>

      {mode !== "implied" && (
        <div className="mt-4">
          <label className="flex cursor-pointer items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => onConsentChange(e.target.checked)}
              disabled={submitting}
              aria-invalid={!!errors[CONSENT_ERROR_KEY] || undefined}
              aria-describedby={errors[CONSENT_ERROR_KEY] ? `${uid}-consent-error` : undefined}
              className="mt-0.5 size-4 shrink-0 cursor-pointer accent-[var(--os-primary)]"
            />
            <span>
              {consentLabel}
              {mode === "explicit_required" && <RequiredMark />}
            </span>
          </label>
          <FieldError id={`${uid}-consent-error`} message={errors[CONSENT_ERROR_KEY]} />
        </div>
      )}

      {(privacyStatement || privacyUrl) && (
        <p className="mt-4 text-xs leading-relaxed opacity-70">
          {privacyStatement}
          {privacyStatement && privacyUrl && " "}
          {privacyUrl && (
            <a href={safeUrl(privacyUrl)} target="_blank" rel="noopener noreferrer" className="underline hover:opacity-80">
              {t.privacyPolicy}
            </a>
          )}
        </p>
      )}

      {formError && (
        <p role="alert" className="mt-4 rounded-[var(--os-radius)] bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {formError}
        </p>
      )}

      <ThemedButton type="submit" className="mt-6 w-full" disabled={submitting} aria-busy={submitting || undefined}>
        {submitLabel}
      </ThemedButton>
    </form>
  );
}

function safeUrl(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

function RequiredMark() {
  return (
    <span aria-hidden className="ml-0.5">
      *
    </span>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1 text-sm font-medium text-red-600">
      {message}
    </p>
  );
}

function LeadFieldInput({
  field: f,
  id,
  value,
  error,
  onChange,
  disabled,
}: {
  field: LeadField;
  id: string;
  value: string | boolean | undefined;
  error?: string;
  onChange: (v: string | boolean) => void;
  disabled?: boolean;
}) {
  const errorId = `${id}-error`;
  const common = {
    id,
    name: f.key,
    disabled,
    required: f.required,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? errorId : undefined,
  } as const;
  const label = `${f.label}${f.required ? " *" : ""}`;

  if (f.type === "checkbox") {
    return (
      <div>
        <label htmlFor={id} className="flex cursor-pointer items-start gap-3 py-1 text-sm">
          <input
            {...common}
            type="checkbox"
            checked={value === true}
            onChange={(e) => onChange(e.target.checked)}
            className="mt-0.5 size-4 shrink-0 cursor-pointer accent-[var(--os-primary)]"
          />
          <span>
            {f.label}
            {f.required && <RequiredMark />}
          </span>
        </label>
        <FieldError id={errorId} message={error} />
      </div>
    );
  }

  const str = typeof value === "string" ? value : "";
  return (
    <div>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      {f.type === "select" ? (
        <div className="relative">
          <select
            {...common}
            value={str}
            onChange={(e) => onChange(e.target.value)}
            className={cn(inputClass, "appearance-none pr-10", !str && "text-current/50")}
          >
            <option value="">{`${label} — ${t.selectPlaceholder}`}</option>
            {f.options
              .filter((o) => o.trim())
              .map((o) => (
                <option key={o} value={o} className="text-[var(--os-text)]">
                  {o}
                </option>
              ))}
          </select>
          <ChevronDown aria-hidden className="pointer-events-none absolute top-1/2 right-3 size-5 -translate-y-1/2 opacity-50" />
        </div>
      ) : (
        <input
          {...common}
          type={f.type === "email" ? "email" : f.type === "phone" ? "tel" : "text"}
          autoComplete={autoComplete(f)}
          inputMode={f.type === "phone" ? "tel" : f.type === "email" ? "email" : undefined}
          placeholder={label}
          value={str}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        />
      )}
      <FieldError id={errorId} message={error} />
    </div>
  );
}

function autoComplete(f: LeadField): string | undefined {
  if (f.key === "firstName") return "given-name";
  if (f.key === "lastName") return "family-name";
  if (f.type === "email") return "email";
  if (f.type === "phone") return "tel";
  return undefined;
}
