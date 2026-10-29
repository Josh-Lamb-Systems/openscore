import {
  CheckCheck,
  CircleDot,
  Columns3,
  Hash,
  Image as ImageIcon,
  Info,
  ListChecks,
  type LucideIcon,
  Rows3,
  SlidersHorizontal,
  SquareCheckBig,
  Type,
} from "lucide-react";
import type { QuestionType } from "~/lib/scorecard/schema";
import { cn } from "~/lib/utils";

const ICONS: Record<QuestionType, LucideIcon> = {
  yes_no: CheckCheck,
  choice_buttons: Rows3,
  choice_checkbox: SquareCheckBig,
  choice_radio: CircleDot,
  sliding_scale: SlidersHorizontal,
  linear_scale: ListChecks,
  divided_scale: Columns3,
  numeric: Hash,
  open_text: Type,
  image_buttons: ImageIcon,
  info: Info,
};

/** Small brand-coloured icon for a question type (list rows, type select). */
export function QuestionTypeIcon({ type, className }: { type: QuestionType; className?: string }) {
  const Icon = ICONS[type];
  return <Icon aria-hidden className={cn("size-4 shrink-0 text-brand-600", className)} />;
}

/** Larger tile used in the "Choose question type" picker. */
export function QuestionTypeTile({ type }: { type: QuestionType }) {
  const Icon = ICONS[type];
  return (
    <span className="grid size-11 shrink-0 place-items-center rounded-md bg-brand-50 text-brand-600">
      <Icon aria-hidden className="size-5" />
    </span>
  );
}
