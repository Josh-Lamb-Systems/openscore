import { Check } from "lucide-react";
import { useMemo } from "react";
import { respondentStrings as t } from "~/lib/respondent-strings";
import { isOptionQuestion, type Answer, type ChoiceOption, type Question } from "~/lib/scorecard/schema";
import { isMultiSelect, visibleOptions } from "~/lib/scoring/score";
import { cn } from "~/lib/utils";
import { ThemedButton } from "./frame";
import { ProcessCurveChart } from "./process-curve";

export interface QuestionViewProps {
  question: Question;
  value: Answer | undefined;
  onChange: (answer: Answer | undefined) => void;
  /**
   * Called to move on. Single-select button questions call this immediately
   * with the chosen answer (auto-advance); other types via the Next button.
   */
  onNext: (answer: Answer | undefined) => void;
  error?: string | null;
  /** Seed for answer randomisation, so the order is stable for one respondent. */
  shuffleSeed?: string;
  disabled?: boolean;
  /** Placeholder shown when the question text is empty (builder canvas). */
  emptyTextPlaceholder?: string;
}

/** The implicit answer for scales that show a starting value the respondent may accept as-is. */
export function defaultAnswer(q: Question): Answer | undefined {
  if (q.type === "sliding_scale") return { value: q.start };
  if (q.type === "linear_scale" && q.start != null) return { value: q.start };
  return undefined;
}

/** Deterministic Fisher–Yates shuffle seeded by a string. */
export function seededShuffle<T>(items: T[], seed: string): T[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  const rand = () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function MediaBlock({ media }: { media: Question["media"] }) {
  if (!media?.url) return null;
  if (media.kind === "image") {
    return <img src={media.url} alt="" className="mb-6 max-h-72 rounded-lg object-contain" />;
  }
  const yt = media.url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{6,})/);
  const vimeo = media.url.match(/vimeo\.com\/(\d+)/);
  const src = yt ? `https://www.youtube-nocookie.com/embed/${yt[1]}` : vimeo ? `https://player.vimeo.com/video/${vimeo[1]}` : null;
  return src ? (
    <iframe src={src} title="Question video" className="mb-6 aspect-video w-full max-w-xl rounded-lg" allow="fullscreen" />
  ) : (
    <video src={media.url} controls className="mb-6 max-h-72 rounded-lg" />
  );
}

export function QuestionView({
  question: q,
  value,
  onChange,
  onNext,
  error,
  shuffleSeed,
  disabled,
  emptyTextPlaceholder = "Write your question here",
}: QuestionViewProps) {
  const options = useMemo(() => {
    if (!isOptionQuestion(q)) return [];
    const opts = visibleOptions(q);
    return "randomize" in q && q.randomize && shuffleSeed ? seededShuffle(opts, `${shuffleSeed}:${q.id}`) : opts;
  }, [q, shuffleSeed]);

  const selected = value && "optionIds" in value ? value.optionIds : [];
  const multi = isMultiSelect(q);

  const toggle = (opt: ChoiceOption) => {
    if (multi) {
      const next = selected.includes(opt.id) ? selected.filter((id) => id !== opt.id) : [...selected, opt.id];
      const max = q.type === "choice_checkbox" ? q.maxSelections : null;
      if (max != null && next.length > max) return;
      onChange({ optionIds: next });
    } else {
      const answer = { optionIds: [opt.id] };
      onChange(answer);
      if (q.type !== "choice_radio") onNext(answer);
    }
  };

  const showNext = !(q.type === "yes_no" || q.type === "choice_buttons" || q.type === "divided_scale" || (q.type === "image_buttons" && !q.multiSelect));

  return (
    <div className="w-full">
      <MediaBlock media={q.media} />
      {q.type !== "info" || q.text ? (
        <h2 className={cn("text-3xl font-medium leading-tight md:text-4xl", !q.text && "opacity-50")}>
          {q.text || emptyTextPlaceholder}
        </h2>
      ) : null}
      {q.showInstruction && q.instruction && <p className="mt-3 text-lg opacity-75">{q.instruction}</p>}

      <div className="mt-8">
        {(q.type === "yes_no" || q.type === "choice_buttons") && (
          <div className="flex flex-wrap gap-2">
            {options.map((o) => (
              <ThemedButton
                key={o.id}
                disabled={disabled}
                onClick={() => toggle(o)}
                variant={selected.includes(o.id) ? "solid" : "solid"}
                className={cn("min-w-40", selected.includes(o.id) && "ring-2 ring-[var(--os-primary)] ring-offset-2")}
              >
                {o.label || "…"}
              </ThemedButton>
            ))}
          </div>
        )}

        {(q.type === "choice_radio" || q.type === "choice_checkbox") && (
          <div className="flex max-w-xl flex-col gap-2" role={q.type === "choice_radio" ? "radiogroup" : "group"}>
            {options.map((o) => {
              const on = selected.includes(o.id);
              return (
                <button
                  key={o.id}
                  type="button"
                  role={q.type === "choice_radio" ? "radio" : "checkbox"}
                  aria-checked={on}
                  disabled={disabled}
                  onClick={() => toggle(o)}
                  className={cn(
                    "flex items-center gap-3 rounded-[var(--os-radius)] border-2 px-4 py-3 text-left text-lg transition-colors",
                    on ? "border-[var(--os-primary)] bg-[color-mix(in_srgb,var(--os-primary)_8%,transparent)]" : "border-current/15 hover:border-[var(--os-primary)]",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-5 shrink-0 place-items-center border-2 border-[var(--os-primary)]",
                      q.type === "choice_radio" ? "rounded-full" : "rounded",
                      on && "bg-[var(--os-primary)] text-white",
                    )}
                  >
                    {on && (q.type === "choice_radio" ? <span className="size-2 rounded-full bg-white" /> : <Check className="size-3.5" />)}
                  </span>
                  {o.label || "…"}
                </button>
              );
            })}
            {q.type === "choice_checkbox" && (q.maxSelections != null || q.minSelections != null) && (
              <p className="text-sm opacity-70">
                {q.maxSelections != null ? t.selectUpTo(q.maxSelections) : t.selectAtLeast(q.minSelections!)}
              </p>
            )}
          </div>
        )}

        {q.type === "image_buttons" && (
          <div className="grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-3">
            {options.map((o) => {
              const on = selected.includes(o.id);
              return (
                <button
                  key={o.id}
                  type="button"
                  aria-pressed={on}
                  disabled={disabled}
                  onClick={() => toggle(o)}
                  className={cn(
                    "overflow-hidden rounded-[var(--os-radius)] border-2 bg-[var(--os-surface)] text-left transition-colors",
                    on ? "border-[var(--os-primary)]" : "border-current/10 hover:border-[var(--os-primary)]",
                  )}
                >
                  <div className="aspect-[4/3] bg-current/5">
                    {o.imageUrl ? <img src={o.imageUrl} alt="" className="size-full object-cover" /> : null}
                  </div>
                  <p className="px-3 py-2 font-medium">{o.label || "…"}</p>
                </button>
              );
            })}
          </div>
        )}

        {q.type === "divided_scale" && (
          <div className="flex max-w-3xl overflow-hidden rounded-[var(--os-radius)] border-2 border-[var(--os-primary)]">
            {options.map((o, i) => {
              const on = selected.includes(o.id);
              return (
                <button
                  key={o.id}
                  type="button"
                  disabled={disabled}
                  aria-pressed={on}
                  onClick={() => toggle(o)}
                  className={cn(
                    "flex-1 px-2 py-4 text-center text-sm font-medium transition-colors sm:text-base",
                    i > 0 && "border-l-2 border-[var(--os-primary)]",
                    on ? "bg-[var(--os-primary)] text-white" : "hover:bg-[color-mix(in_srgb,var(--os-primary)_10%,transparent)]",
                  )}
                >
                  {o.label || "…"}
                </button>
              );
            })}
          </div>
        )}

        {q.type === "linear_scale" && (
          <LinearScale q={q} value={value && "value" in value ? value.value : null} onChange={(v) => onChange({ value: v })} disabled={disabled} />
        )}

        {q.type === "sliding_scale" && (
          <SlidingScale q={q} value={value && "value" in value ? value.value : null} onChange={(v) => onChange({ value: v })} disabled={disabled} />
        )}

        {q.type === "numeric" && (
          <div className="flex max-w-xs items-center gap-2">
            <input
              type="number"
              inputMode="decimal"
              disabled={disabled}
              min={q.min ?? undefined}
              max={q.max ?? undefined}
              placeholder={t.enterNumber}
              value={value && "value" in value && Number.isFinite(value.value) ? value.value : ""}
              onChange={(e) => onChange(e.target.value === "" ? undefined : { value: Number(e.target.value) })}
              onKeyDown={(e) => e.key === "Enter" && onNext(value)}
              className="w-full rounded-[var(--os-radius)] border-2 border-current/20 bg-[var(--os-surface)] px-4 py-3 text-lg focus:border-[var(--os-primary)] focus:outline-none"
            />
            {q.unit && <span className="text-lg opacity-75">{q.unit}</span>}
          </div>
        )}

        {q.type === "open_text" &&
          (q.multiline ? (
            <textarea
              disabled={disabled}
              rows={5}
              placeholder={q.placeholder || t.typeAnswer}
              value={value && "text" in value ? value.text : ""}
              onChange={(e) => onChange({ text: e.target.value })}
              className="w-full max-w-2xl rounded-[var(--os-radius)] border-2 border-current/20 bg-[var(--os-surface)] px-4 py-3 text-lg focus:border-[var(--os-primary)] focus:outline-none"
            />
          ) : (
            <input
              disabled={disabled}
              placeholder={q.placeholder || t.typeAnswer}
              value={value && "text" in value ? value.text : ""}
              onChange={(e) => onChange({ text: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && onNext(value)}
              className="w-full max-w-2xl rounded-[var(--os-radius)] border-2 border-current/20 bg-[var(--os-surface)] px-4 py-3 text-lg focus:border-[var(--os-primary)] focus:outline-none"
            />
          ))}

        {q.type === "info" && q.body && (
          <div className="os-prose max-w-2xl text-lg" dangerouslySetInnerHTML={{ __html: q.body }} />
        )}

        {q.type === "process_curve" && (
          <ProcessCurveChart
            question={q}
            values={value && "values" in value ? value.values : null}
            onChange={(values) => onChange({ values })}
            disabled={disabled}
            className="max-w-4xl"
          />
        )}
      </div>

      {error && <p className="mt-4 text-base font-medium text-red-600">{error}</p>}

      {(showNext || (multi && q.type === "image_buttons")) && (
        <ThemedButton className="mt-8 min-w-40" disabled={disabled} onClick={() => onNext(value ?? defaultAnswer(q))}>
          {q.type === "info" ? q.buttonLabel || t.next : t.next}
        </ThemedButton>
      )}
    </div>
  );
}

function ScaleLabels({ labels }: { labels: { left: string; center: string; right: string } }) {
  if (!labels.left && !labels.center && !labels.right) return null;
  return (
    <div className="mt-3 grid grid-cols-3 text-sm opacity-75">
      <span>{labels.left}</span>
      <span className="text-center">{labels.center}</span>
      <span className="text-right">{labels.right}</span>
    </div>
  );
}

function LinearScale({
  q,
  value,
  onChange,
  disabled,
}: {
  q: Extract<Question, { type: "linear_scale" }>;
  value: number | null;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  const steps = q.max >= q.min && q.max - q.min <= 20 ? Array.from({ length: q.max - q.min + 1 }, (_, i) => q.min + i) : [];
  const current = value ?? q.start;
  return (
    <div className="max-w-3xl">
      <div className="flex justify-between gap-2" role="radiogroup">
        {steps.map((n) => (
          <label key={n} className="flex cursor-pointer flex-col items-center gap-2">
            <span className="text-sm">{n}</span>
            <input
              type="radio"
              name={`scale-${q.id}`}
              checked={current === n}
              disabled={disabled}
              onChange={() => onChange(n)}
              className="size-5 cursor-pointer accent-[var(--os-primary)]"
            />
          </label>
        ))}
      </div>
      <ScaleLabels labels={q.labels} />
    </div>
  );
}

function SlidingScale({
  q,
  value,
  onChange,
  disabled,
}: {
  q: Extract<Question, { type: "sliding_scale" }>;
  value: number | null;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  const current = value ?? q.start;
  return (
    <div className="max-w-3xl">
      <div className="mb-2 text-center text-2xl font-semibold">{current}</div>
      <input
        type="range"
        min={q.min}
        max={q.max}
        step={q.step}
        value={current}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full cursor-pointer accent-[var(--os-primary)]"
        aria-label={q.text}
      />
      <div className="flex justify-between text-sm opacity-60">
        <span>{q.min}</span>
        <span>{q.max}</span>
      </div>
      <ScaleLabels labels={q.labels} />
    </div>
  );
}
