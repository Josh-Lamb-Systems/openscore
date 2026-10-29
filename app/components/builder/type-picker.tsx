import { X } from "lucide-react";
import { QUESTION_TYPES } from "~/lib/scorecard/meta";
import type { QuestionType } from "~/lib/scorecard/schema";
import { QuestionTypeTile } from "./question-icons";

/** "Choose question type" panel shown in place of the question list. */
export function TypePickerPane({ onPick, onClose }: { onPick: (type: QuestionType) => void; onClose: () => void }) {
  return (
    <div className="h-full overflow-y-auto px-3 py-4">
      <div className="mb-3 flex items-center justify-between px-1">
        <h2 className="text-lg text-ink">Choose question type</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close question types"
          className="grid size-7 place-items-center rounded text-gray-500 hover:bg-gray-100 hover:text-ink"
        >
          <X className="size-4" />
        </button>
      </div>
      <ul className="space-y-1">
        {QUESTION_TYPES.map((t) => (
          <li key={t.type}>
            <button
              type="button"
              onClick={() => onPick(t.type)}
              title={t.description}
              className="flex w-full items-center gap-4 rounded-md p-1 text-left text-[15px] text-ink hover:bg-gray-100 focus-visible:bg-gray-100 focus-visible:outline-none"
            >
              <QuestionTypeTile type={t.type} />
              <span className="leading-snug">{t.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
