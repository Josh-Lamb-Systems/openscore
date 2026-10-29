import { RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { Field, Input, SectionLabel, Select } from "~/components/ui/input";
import { BRAND_TOKEN_FIELDS, normalizeHex } from "~/lib/admin/brand-tokens";
import { FONT_OPTIONS, type BrandTokens } from "~/lib/theme";
import { cn } from "~/lib/utils";

type Key = keyof BrandTokens;

export interface BrandTokensEditorProps {
  value: BrandTokens;
  onChange: <K extends Key>(key: K, value: BrandTokens[K]) => void;
  /** Per-scorecard mode: which fields differ from the kit, and how to reset them. */
  isOverridden?: (key: Key) => boolean;
  onReset?: (key: Key) => void;
  resetLabel?: string;
  errors?: Record<string, string>;
}

function ColorInput({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const swatch = normalizeHex(value) ?? "#000000";
  return (
    <div className="flex h-9 items-center overflow-hidden rounded-md border border-gray-300 bg-white focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20">
      <label className="relative grid h-full w-10 shrink-0 cursor-pointer place-items-center border-r border-gray-300">
        <span className="size-5 rounded border border-black/10" style={{ backgroundColor: swatch }} />
        <input
          type="color"
          value={swatch.toLowerCase()}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="absolute inset-0 cursor-pointer opacity-0"
          aria-label="Pick colour"
          tabIndex={-1}
        />
      </label>
      <input
        id={id}
        value={draft}
        spellCheck={false}
        onChange={(e) => {
          setDraft(e.target.value);
          if (/^#?[0-9a-fA-F]{6}$/.test(e.target.value.trim())) onChange(normalizeHex(e.target.value)!);
        }}
        onBlur={() => {
          const hex = normalizeHex(draft);
          if (hex) onChange(hex);
          else setDraft(value);
        }}
        className="min-w-0 flex-1 px-3 font-mono text-sm uppercase text-ink focus:outline-none"
      />
    </div>
  );
}

/** Editor for every brand token, used by brand kits and per-scorecard theme overrides. */
export function BrandTokensEditor({
  value,
  onChange,
  isOverridden,
  onReset,
  resetLabel = "Reset to kit",
  errors,
}: BrandTokensEditorProps) {
  const field = (key: Key) => BRAND_TOKEN_FIELDS.find((f) => f.key === key)!;

  const label = (key: Key) => {
    const overridden = isOverridden?.(key);
    return (
      <span className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          {field(key).label}
          {overridden && (
            <span className="rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-700">
              Custom
            </span>
          )}
        </span>
        {overridden && onReset && (
          <button
            type="button"
            onClick={() => onReset(key)}
            className="inline-flex items-center gap-1 text-xs font-normal text-gray-600 hover:text-brand-700"
          >
            <RotateCcw className="size-3" /> {resetLabel}
          </button>
        )}
      </span>
    );
  };

  const urlField = (key: "logoUrl" | "backgroundImageUrl") => (
    <Field label={label(key)} htmlFor={`tok-${key}`} hint={field(key).hint} error={errors?.[key]}>
      <Input
        id={`tok-${key}`}
        type="url"
        placeholder="https://"
        value={value[key]}
        onChange={(e) => onChange(key, e.target.value)}
        aria-invalid={!!errors?.[key]}
      />
    </Field>
  );

  const colorKeys = ["primaryColor", "accentColor", "textColor", "backgroundColor", "surfaceColor"] as const;

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <SectionLabel>Logo & background</SectionLabel>
        {urlField("logoUrl")}
        {urlField("backgroundImageUrl")}
      </div>

      <div className="space-y-4">
        <SectionLabel>Colours</SectionLabel>
        <div className="grid gap-4 sm:grid-cols-2">
          {colorKeys.map((key) => (
            <Field key={key} label={label(key)} htmlFor={`tok-${key}`} hint={field(key).hint} error={errors?.[key]}>
              <ColorInput id={`tok-${key}`} value={value[key]} onChange={(v) => onChange(key, v)} />
            </Field>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <SectionLabel>Typography & buttons</SectionLabel>
        <Field label={label("font")} htmlFor="tok-font" error={errors?.font}>
          <Select id="tok-font" value={value.font} onChange={(e) => onChange("font", e.target.value)}>
            {Object.entries(FONT_OPTIONS).map(([k, f]) => (
              <option key={k} value={k}>
                {f.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={label("buttonRadius")} htmlFor="tok-radius" error={errors?.buttonRadius}>
          <div className="flex items-center gap-4">
            <input
              id="tok-radius"
              type="range"
              min={0}
              max={32}
              step={1}
              value={value.buttonRadius}
              onChange={(e) => onChange("buttonRadius", Number(e.target.value))}
              className="flex-1 accent-brand-600"
            />
            <span className="w-12 text-right text-sm tabular-nums text-gray-700">{value.buttonRadius}px</span>
          </div>
        </Field>
        <Field label={label("buttonStyle")} error={errors?.buttonStyle}>
          <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Button style">
            {(["solid", "outline"] as const).map((style) => {
              const on = value.buttonStyle === style;
              return (
                <button
                  key={style}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => onChange("buttonStyle", style)}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-lg border bg-white p-3 text-sm capitalize",
                    on ? "border-brand-600 ring-2 ring-brand-500/20" : "border-gray-200 hover:border-gray-300",
                  )}
                >
                  <span
                    className="h-7 w-24 border-2"
                    style={{
                      borderRadius: Math.min(value.buttonRadius, 14),
                      borderColor: value.primaryColor,
                      backgroundColor: style === "solid" ? value.primaryColor : "transparent",
                    }}
                  />
                  {style}
                </button>
              );
            })}
          </div>
        </Field>
      </div>
    </div>
  );
}
