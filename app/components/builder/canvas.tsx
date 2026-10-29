import { useEffect, useRef, useState } from "react";
import { BrandLogo, ProgressBar, RespondentFrame } from "~/components/respondent/frame";
import { QuestionView } from "~/components/respondent/question-view";
import { Button } from "~/components/ui/button";
import type { Answer, Question } from "~/lib/scorecard/schema";
import type { BrandTokens } from "~/lib/theme";
import { cn } from "~/lib/utils";
import { IsolatedFrame } from "./device-frame";
import { replaceQuestion, useBuilder, type DeviceMode } from "./store";

/** Grey canvas area; constrains the preview card to a phone width in mobile mode. */
export function CanvasViewport({ device, children }: { device: DeviceMode; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-1 justify-center overflow-hidden bg-gray-100 p-4">
      <div
        className={cn(
          "h-full min-h-0 w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition-[max-width] duration-200",
          device === "mobile" ? "max-w-[390px]" : "max-w-none",
        )}
      >
        {device === "mobile" ? <IsolatedFrame title="Mobile preview">{children}</IsolatedFrame> : children}
      </div>
    </div>
  );
}

export function CanvasEmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex min-w-0 flex-1 items-center justify-center bg-gray-100 p-6">
      <div className="max-w-sm text-center">
        <h2 className="text-xl font-semibold text-ink">Build your quiz</h2>
        <p className="mt-3 text-[15px] text-gray-700">
          Start collecting valuable data and calculating scores by adding questions and categories
        </p>
        <Button className="mt-4" onClick={onAdd}>
          Add question
        </Button>
      </div>
    </div>
  );
}

/** Progress shown above a question: share of non-info questions before it. */
export function progressFor(questions: Question[], id: string): number {
  const counted = questions.filter((q) => q.type !== "info");
  if (counted.length === 0) return 0;
  const idx = questions.findIndex((q) => q.id === id);
  const before = questions.slice(0, Math.max(idx, 0)).filter((q) => q.type !== "info").length;
  return Math.round((100 * before) / counted.length);
}

/** Live, interactive render of the selected question with inline text editing. */
export function QuestionCanvas({ question: q, theme }: { question: Question; theme: BrandTokens }) {
  const questions = useBuilder((s) => s.doc.questions);
  const update = useBuilder((s) => s.update);
  // Answers are only for trying the question out; never saved.
  const [answers, setAnswers] = useState<Record<string, Answer | undefined>>({});
  const percent = progressFor(questions, q.id);

  const setText = (text: string) =>
    update((doc) => replaceQuestion(doc, q.id, (cur) => ({ ...cur, text })), { coalesce: `${q.id}:text` });

  return (
    <RespondentFrame theme={theme} className="flex h-full flex-col">
      <div className="shrink-0 p-4 sm:p-6">
        <BrandLogo theme={theme} />
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 sm:px-6 lg:px-10">
        <div className="my-auto w-full max-w-4xl py-8">
          <CanvasMedia media={q.media} />
          <TitleEditor
            value={q.text}
            onChange={setText}
            placeholder={q.type === "info" ? "Write a heading" : "Write your question here"}
            className="text-3xl md:text-4xl"
          />
          <QuestionView
            question={{ ...q, text: "", media: null }}
            emptyTextPlaceholder=""
            value={answers[q.id]}
            onChange={(a) => setAnswers((prev) => ({ ...prev, [q.id]: a }))}
            onNext={() => {}}
          />
        </div>
      </div>
      <div className={cn("shrink-0 py-5", q.type === "info" && "invisible")}>
        <ProgressBar percent={percent} />
      </div>
    </RespondentFrame>
  );
}

/** Borderless auto-growing textarea styled like the respondent question heading. */
function TitleEditor({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  className?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      el.style.height = "0px";
      el.style.height = `${el.scrollHeight}px`;
    };
    fit();
    // Re-fit when the available width changes (desktop/mobile toggle, window resize).
    let width = el.parentElement?.clientWidth ?? 0;
    const ro = new ResizeObserver(() => {
      const w = el.parentElement?.clientWidth ?? 0;
      if (w !== width) {
        width = w;
        fit();
      }
    });
    if (el.parentElement) ro.observe(el.parentElement);
    return () => ro.disconnect();
  }, [value, className]);

  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      placeholder={placeholder}
      aria-label="Question text"
      onChange={(e) => onChange(e.target.value.replace(/\n/g, " "))}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
      className={cn(
        "block w-full resize-none overflow-hidden rounded-md border-0 bg-transparent p-0 font-medium leading-tight text-inherit outline-offset-4 placeholder:text-current placeholder:opacity-50 hover:outline-1 hover:outline-dashed hover:outline-current/25 focus:outline-2 focus:outline-dashed focus:outline-[var(--os-primary)]",
        className,
      )}
    />
  );
}

/** Mirrors the respondent media block (image or embedded video) above the question. */
function CanvasMedia({ media }: { media: Question["media"] }) {
  if (!media?.url) return null;
  if (media.kind === "image") {
    return <img src={media.url} alt="" className="mb-6 max-h-72 rounded-lg object-contain" />;
  }
  const yt = media.url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{6,})/);
  const vimeo = media.url.match(/vimeo\.com\/(\d+)/);
  const src = yt
    ? `https://www.youtube-nocookie.com/embed/${yt[1]}`
    : vimeo
      ? `https://player.vimeo.com/video/${vimeo[1]}`
      : null;
  return src ? (
    <iframe src={src} title="Question video" className="mb-6 aspect-video w-full max-w-xl rounded-lg" allow="fullscreen" />
  ) : (
    <video src={media.url} controls className="mb-6 max-h-72 rounded-lg" />
  );
}
