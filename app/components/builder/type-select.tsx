import { Check, ChevronDown } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "~/components/ui/dropdown-menu";
import { QUESTION_TYPES, questionTypeLabel } from "~/lib/scorecard/meta";
import type { QuestionType } from "~/lib/scorecard/schema";
import { QuestionTypeIcon } from "./question-icons";

/** Question type dropdown at the top of the inspector, with type icons. */
export function TypeSelect({ value, onChange }: { value: QuestionType; onChange: (t: QuestionType) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Question type: ${questionTypeLabel(value)}`}
        className="flex h-10 w-full items-center gap-2 rounded-md border border-gray-300 bg-white px-3 text-left text-sm text-ink hover:border-gray-400 focus-visible:border-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/20"
      >
        <QuestionTypeIcon type={value} />
        <span className="flex-1 truncate">{questionTypeLabel(value)}</span>
        <ChevronDown className="size-4 text-brand-600" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-[70vh] w-[var(--radix-dropdown-menu-trigger-width)] overflow-y-auto">
        {QUESTION_TYPES.map((t) => (
          <DropdownMenuItem key={t.type} onSelect={() => onChange(t.type)}>
            <QuestionTypeIcon type={t.type} />
            <span className="flex-1">{t.label}</span>
            {t.type === value && <Check className="text-brand-600" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
