import { Check, CheckCircle2 } from "lucide-react";
import * as React from "react";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/misc";
import { SectionLabel } from "~/components/ui/input";
import { cn } from "~/lib/utils";

/** Native checkbox styled with the brand colour. */
export function Checkbox({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="checkbox"
      className={cn(
        "size-4 cursor-pointer rounded border-gray-300 accent-brand-600 disabled:cursor-not-allowed",
        className,
      )}
      {...props}
    />
  );
}

/** Radio with a title and description underneath, as in the consent settings. */
export function RadioOption({
  name,
  value,
  checked,
  onChange,
  title,
  description,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: (value: string) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 py-1.5">
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={() => onChange(value)}
        className="mt-1 size-4 cursor-pointer accent-brand-600"
      />
      <span>
        <span className="block text-[15px] text-ink">{title}</span>
        {description && <span className="block text-sm text-gray-600">{description}</span>}
      </span>
    </label>
  );
}

/** Input with a fixed prefix, e.g. "https://". */
export function InputAddon({
  addon,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { addon: React.ReactNode }) {
  return (
    <div
      className={cn(
        "flex h-9 overflow-hidden rounded-md border border-gray-300 bg-white focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20",
        className,
      )}
    >
      <span className="grid place-items-center border-r border-gray-300 bg-gray-50 px-3 text-sm text-gray-700">
        {addon}
      </span>
      <input className="min-w-0 flex-1 px-3 text-sm text-ink placeholder:text-gray-400 focus:outline-none" {...props} />
    </div>
  );
}

/** A settings section: small-caps heading + description, then content (019.png). */
export function SettingsSection({
  title,
  description,
  children,
  className,
  boxed = true,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  boxed?: boolean;
}) {
  return (
    <section className={cn("border-t border-gray-200 pt-6", className)}>
      <SectionLabel>{title}</SectionLabel>
      {description && <p className="mt-1 text-[15px] text-gray-600">{description}</p>}
      <div className={cn("mt-4", boxed && "rounded-lg bg-gray-50 p-5")}>{children}</div>
    </section>
  );
}

/** Narrow page wrapper for settings pages. */
export function SettingsPage({
  title,
  description,
  actions,
  children,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-3xl px-10 pb-28 pt-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
          {description && <p className="mt-1 text-gray-600">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      <div className="space-y-8">{children}</div>
    </div>
  );
}

/**
 * Sticky bar at the bottom of the scroll area with Save / Discard. Shown at all
 * times so the Save button is easy to find; highlights when there are unsaved changes.
 */
export function SaveBar({
  dirty,
  busy,
  onSave,
  onDiscard,
  saved,
  error,
  saveLabel = "Save changes",
  disabled,
}: {
  dirty: boolean;
  busy: boolean;
  onSave?: () => void;
  onDiscard?: () => void;
  /** Briefly true after a successful save. */
  saved?: boolean;
  error?: React.ReactNode;
  saveLabel?: string;
  disabled?: boolean;
}) {
  return (
    // Only float over the form when there is something to act on or report.
    <div
      className={cn(
        "pointer-events-none bottom-0 z-10 -mx-10 mt-10 px-10 pb-4",
        (dirty || error || saved) && "sticky",
      )}
    >
      <Card
        className={cn(
          "pointer-events-auto flex items-center gap-3 px-4 py-3 shadow-lg transition-colors",
          dirty ? "border-brand-200 bg-white" : "bg-white/95",
        )}
      >
        <div className="min-w-0 flex-1 text-sm">
          {error ? (
            <span className="text-red-700">{error}</span>
          ) : dirty ? (
            <span className="font-medium text-ink">You have unsaved changes</span>
          ) : (
            <span
              className={cn("inline-flex items-center gap-1.5", saved ? "font-medium text-green-700" : "text-gray-500")}
            >
              {saved && <CheckCircle2 className="size-4" />}
              {saved ? "Saved" : "All changes saved"}
            </span>
          )}
        </div>
        {onDiscard && (
          <Button variant="ghost" onClick={onDiscard} disabled={!dirty || busy}>
            Discard
          </Button>
        )}
        <Button type={onSave ? "button" : "submit"} onClick={onSave} disabled={!dirty || busy || disabled}>
          {busy ? "Saving…" : saveLabel}
        </Button>
      </Card>
    </div>
  );
}

/** Round tick used in the setup checklist. */
export function CircleCheck({ checked, className }: { checked: boolean; className?: string }) {
  return (
    <span
      className={cn(
        "grid size-6 shrink-0 place-items-center rounded-full border-2 transition-colors",
        checked ? "border-brand-600 bg-brand-600 text-white" : "border-gray-300 bg-white text-transparent",
        className,
      )}
    >
      <Check className="size-3.5" strokeWidth={3} />
    </span>
  );
}

/** Tier name pill coloured with the tier colour. */
export function TierPill({ name, color, className }: { name: string; color: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex max-w-40 items-center gap-1.5 truncate rounded-full px-2 py-0.5 text-xs font-medium",
        className,
      )}
      style={{
        backgroundColor: `color-mix(in srgb, ${color} 14%, white)`,
        color: `color-mix(in srgb, ${color} 75%, black)`,
      }}
    >
      <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      <span className="truncate">{name}</span>
    </span>
  );
}
