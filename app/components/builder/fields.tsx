import { useEffect, useId, useState } from "react";
import { cn } from "~/lib/utils";

/** Inspector section with a small-caps heading, separated by a rule (MEDIA, LABELS, …). */
export function InspectorSection({
  title,
  action,
  className,
  children,
}: {
  title?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("border-b border-gray-200 px-4 py-4", className)}>
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          {title && <h3 className="text-xs font-semibold uppercase tracking-wide text-ink">{title}</h3>}
          {action}
        </div>
      )}
      <div className="space-y-3">{children}</div>
    </section>
  );
}

/** Label above a control; generates the id link. */
export function LabeledField({
  label,
  hint,
  children,
  className,
}: {
  label: React.ReactNode;
  hint?: React.ReactNode;
  children: (id: string) => React.ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="block text-sm text-gray-800">
        {label}
      </label>
      {children(id)}
      {hint && <p className="text-xs text-gray-500">{hint}</p>}
    </div>
  );
}

const inputClass =
  "h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-ink placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 aria-invalid:border-red-500";

/**
 * Number input that tolerates intermediate states ("", "-") while typing and
 * only commits valid numbers. `nullable` lets an empty field mean null.
 */
export function NumberField({
  value,
  onChange,
  integer,
  min,
  nullable,
  placeholder,
  className,
  id,
  "aria-label": ariaLabel,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  integer?: boolean;
  min?: number;
  nullable?: boolean;
  placeholder?: string;
  className?: string;
  id?: string;
  "aria-label"?: string;
}) {
  const [text, setText] = useState(value == null ? "" : String(value));

  // Sync from outside (undo/redo, type change) unless the text already means the same value.
  useEffect(() => {
    setText((cur) => (parse(cur) === value ? cur : value == null ? "" : String(value)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function parse(s: string): number | null | undefined {
    const t = s.trim();
    if (t === "") return nullable ? null : undefined;
    const n = Number(t);
    if (!Number.isFinite(n)) return undefined;
    if (integer && !Number.isInteger(n)) return undefined;
    if (min != null && n < min) return undefined;
    return n;
  }

  const parsed = parse(text);
  return (
    <input
      id={id}
      aria-label={ariaLabel}
      type="text"
      inputMode={integer && (min ?? -1) >= 0 ? "numeric" : "decimal"}
      value={text}
      placeholder={placeholder}
      aria-invalid={parsed === undefined || undefined}
      onChange={(e) => {
        setText(e.target.value);
        const n = parse(e.target.value);
        if (n !== undefined && n !== value) onChange(n);
      }}
      onBlur={() => {
        if (parse(text) === undefined) setText(value == null ? "" : String(value));
      }}
      className={cn(inputClass, className)}
    />
  );
}

export function TextField({
  className,
  ...props
}: React.ComponentProps<"input">) {
  return <input className={cn(inputClass, className)} {...props} />;
}

export function TextAreaField({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea className={cn(inputClass, "h-auto min-h-16 py-2", className)} {...props} />;
}

export function SelectField({ className, ...props }: React.ComponentProps<"select">) {
  return <select className={cn(inputClass, "pr-8", className)} {...props} />;
}

/** "min to max" pair of number inputs, as in the scale "Score range" field. */
export function RangeFields({
  label,
  min,
  max,
  onMin,
  onMax,
  integer,
  nonNegative,
  nullable,
}: {
  label: string;
  min: number | null;
  max: number | null;
  onMin: (v: number | null) => void;
  onMax: (v: number | null) => void;
  integer?: boolean;
  nonNegative?: boolean;
  nullable?: boolean;
}) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm text-gray-800">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <NumberField
          id={id}
          aria-label={`${label} from`}
          value={min}
          onChange={onMin}
          integer={integer}
          min={nonNegative ? 0 : undefined}
          nullable={nullable}
          placeholder={nullable ? "Any" : undefined}
        />
        <span className="text-sm text-gray-600">to</span>
        <NumberField
          aria-label={`${label} to`}
          value={max}
          onChange={onMax}
          integer={integer}
          min={nonNegative ? 0 : undefined}
          nullable={nullable}
          placeholder={nullable ? "Any" : undefined}
        />
      </div>
    </div>
  );
}
