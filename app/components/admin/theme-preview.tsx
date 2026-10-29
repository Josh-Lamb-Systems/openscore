import { useState } from "react";
import { BrandLogo, ProgressBar, RespondentFrame, ThemedButton } from "~/components/respondent/frame";
import { QuestionView } from "~/components/respondent/question-view";
import type { Answer, Question } from "~/lib/scorecard/schema";
import type { BrandTokens } from "~/lib/theme";
import { cn } from "~/lib/utils";

/** Fixed sample question (stable ids so SSR and hydration match). */
export const SAMPLE_QUESTION: Question = {
  id: "q_sample",
  type: "choice_buttons",
  text: "How would you rate your current process?",
  instruction: "Choose the answer that fits best.",
  showInstruction: true,
  required: true,
  categoryId: null,
  media: null,
  randomize: false,
  options: [
    { id: "o1", label: "Just starting", points: 0, imageUrl: null },
    { id: "o2", label: "Getting there", points: 1, imageUrl: null },
    { id: "o3", label: "Nailed it", points: 2, imageUrl: null },
  ],
};

/**
 * Live preview of a theme using the real respondent components, scaled down to
 * fit an admin side panel.
 */
export function ThemePreview({
  theme,
  question = SAMPLE_QUESTION,
  className,
}: {
  theme: BrandTokens;
  question?: Question;
  className?: string;
}) {
  const [answer, setAnswer] = useState<Answer | undefined>();
  return (
    <div className={cn("overflow-hidden rounded-lg border border-gray-200 shadow-sm", className)}>
      <div className="flex items-center gap-1.5 border-b border-gray-200 bg-gray-50 px-3 py-2">
        <span className="size-2.5 rounded-full bg-gray-300" />
        <span className="size-2.5 rounded-full bg-gray-300" />
        <span className="size-2.5 rounded-full bg-gray-300" />
        <span className="ml-2 text-xs text-gray-500">Preview</span>
      </div>
      <div style={{ zoom: 0.72 }}>
        <RespondentFrame theme={theme} className="min-h-[520px] px-8 py-6">
          <BrandLogo theme={theme} />
          <div className="mt-8 rounded-[var(--os-radius)] bg-[var(--os-surface)] p-8 shadow-sm">
            <QuestionView
              question={question}
              value={answer}
              onChange={setAnswer}
              onNext={(a) => setAnswer(a)}
              emptyTextPlaceholder="Your question"
            />
            <div className="mt-8 flex items-center justify-between gap-3">
              <ThemedButton variant="outline" className="min-h-10 px-4 text-base">
                Back
              </ThemedButton>
              <ThemedButton variant={theme.buttonStyle} className="min-h-10 px-6 text-base">
                Next
              </ThemedButton>
            </div>
          </div>
          <div className="mt-8">
            <ProgressBar percent={40} />
          </div>
        </RespondentFrame>
      </div>
    </div>
  );
}
