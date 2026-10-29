import {
  closestCenter,
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type Modifier,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowUp, CircleAlert, CirclePlus, Copy, MoreHorizontal, Settings, Trash2 } from "lucide-react";
import { useMemo } from "react";
import { Link } from "react-router";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "~/components/ui/dropdown-menu";
import type { Question, Tier } from "~/lib/scorecard/schema";
import { validateQuestion } from "~/lib/scorecard/validate";
import { cn } from "~/lib/utils";
import { useQuestionActions } from "./question-actions";
import { QuestionTypeIcon } from "./question-icons";
import { useBuilder } from "./store";

/** Keeps dragged rows in their column. */
export const restrictToVerticalAxis: Modifier = ({ transform }) => ({ ...transform, x: 0 });

/** Errors per question id, recomputed when questions or categories change. */
export function useQuestionErrors(): Map<string, string[]> {
  const questions = useBuilder((s) => s.doc.questions);
  const categories = useBuilder((s) => s.doc.categories);
  return useMemo(() => {
    const ids = new Set(categories.map((c) => c.id));
    return new Map(questions.map((q) => [q.id, validateQuestion(q, ids)]));
  }, [questions, categories]);
}

export function QuestionListPane({ scorecardId, tiers }: { scorecardId: string; tiers: Tier[] }) {
  const questions = useBuilder((s) => s.doc.questions);
  const selectedId = useBuilder((s) => s.selectedQuestionId);
  const selectQuestion = useBuilder((s) => s.selectQuestion);
  const setPanel = useBuilder((s) => s.setPanel);
  const actions = useQuestionActions();
  const errors = useQuestionErrors();

  // Pointer-only dragging so Enter/Space on a row still selects it;
  // keyboard users reorder with "Move up/down" in the row menu.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (over && active.id !== over.id) actions.move(String(active.id), String(over.id));
  };

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
        <h2 className="mb-3 px-1 text-lg text-ink">Questions</h2>
        {questions.length === 0 ? (
          <div className="rounded-md bg-gray-50 px-4 py-5 text-center">
            <p className="text-sm text-gray-800">Nothing here yet</p>
            <AddQuestionLink onClick={() => setPanel("add")} className="mx-auto mt-1.5" />
          </div>
        ) : (
          <>
            <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis]} onDragEnd={onDragEnd}>
              <SortableContext items={questions.map((q) => q.id)} strategy={verticalListSortingStrategy}>
                <ol className="space-y-0.5" aria-label="Questions (drag to reorder)">
                  {questions.map((q, i) => (
                    <QuestionRow
                      key={q.id}
                      question={q}
                      index={i}
                      count={questions.length}
                      selected={q.id === selectedId}
                      errors={errors.get(q.id) ?? []}
                      onSelect={() => selectQuestion(q.id)}
                      onMove={(delta) => actions.shift(q.id, delta)}
                      onDuplicate={() => actions.duplicate(q.id)}
                      onDelete={() => actions.remove(q.id)}
                    />
                  ))}
                </ol>
              </SortableContext>
            </DndContext>
            <AddQuestionLink onClick={() => setPanel("add")} className="mt-2 px-1.5" />
          </>
        )}
      </div>
      <ResultsSummary scorecardId={scorecardId} tiers={tiers} />
    </div>
  );
}

function AddQuestionLink({ onClick, className }: { onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-800 hover:underline", className)}
    >
      <CirclePlus className="size-4" /> Add question
    </button>
  );
}

function QuestionRow({
  question: q,
  index,
  count,
  selected,
  errors,
  onSelect,
  onMove,
  onDuplicate,
  onDelete,
}: {
  question: Question;
  index: number;
  count: number;
  selected: boolean;
  errors: string[];
  onSelect: () => void;
  onMove: (delta: -1 | 1) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const { listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: q.id });
  const hasError = errors.length > 0;
  const label = q.text.trim() || (hasError ? errors[0] : "Untitled");

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "group relative flex items-center rounded-md",
        selected ? "bg-gray-200/70" : "hover:bg-gray-100",
        isDragging && "z-10 bg-white shadow-md ring-1 ring-gray-200",
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-current={selected || undefined}
        aria-label={`Question ${index + 1}: ${label}${hasError ? " (needs attention)" : ""}`}
        title={hasError ? errors.join("\n") : q.text}
        className="flex min-w-0 flex-1 cursor-grab items-center gap-2 py-2 pl-2 pr-8 text-left text-sm active:cursor-grabbing"
        {...listeners}
      >
        {hasError ? (
          <CircleAlert aria-hidden className="size-4 shrink-0 text-red-600" />
        ) : (
          <QuestionTypeIcon type={q.type} />
        )}
        <span
          className={cn(
            "truncate",
            hasError ? "text-red-600" : "text-gray-800",
            selected && "font-medium",
            !q.text.trim() && !hasError && "italic text-gray-500",
          )}
        >
          {label}
        </span>
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`Actions for question ${index + 1}`}
          className={cn(
            "absolute right-1 grid size-6 place-items-center rounded text-gray-500 hover:bg-gray-300/60 hover:text-ink data-[state=open]:opacity-100",
            selected ? "opacity-100" : "opacity-0 focus-visible:opacity-100 group-hover:opacity-100",
          )}
        >
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem disabled={index === 0} onSelect={() => onMove(-1)} className="data-[disabled]:opacity-40">
            <ArrowUp /> Move up
          </DropdownMenuItem>
          <DropdownMenuItem disabled={index === count - 1} onSelect={() => onMove(1)} className="data-[disabled]:opacity-40">
            <ArrowDown /> Move down
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onDuplicate}>
            <Copy /> Duplicate
          </DropdownMenuItem>
          <DropdownMenuItem destructive onSelect={onDelete}>
            <Trash2 /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}

function ResultsSummary({ scorecardId, tiers }: { scorecardId: string; tiers: Tier[] }) {
  const base = `/scorecards/${scorecardId}`;
  const sorted = [...tiers].sort((a, b) => a.min - b.min);
  return (
    <div className="shrink-0 border-t border-gray-200 px-4 py-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-lg text-ink">Results</h2>
        <Link
          to={`${base}/settings/tiers`}
          aria-label="Edit score tiers"
          title="Edit score tiers"
          className="grid size-7 place-items-center rounded text-gray-600 hover:bg-gray-100 hover:text-ink"
        >
          <Settings className="size-4" />
        </Link>
      </div>
      {sorted.length === 0 ? (
        <p className="text-sm text-gray-600">
          No score tiers yet.{" "}
          <Link to={`${base}/settings/tiers`} className="font-medium text-brand-700 hover:underline">
            Add tiers
          </Link>
        </p>
      ) : (
        <ul className="space-y-1.5">
          {sorted.map((t) => (
            <li key={t.id} className="flex items-center gap-2 text-sm">
              <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: t.color }} aria-hidden />
              <span className="flex-1 truncate text-gray-800">{t.name || "Untitled tier"}</span>
              <span className="tabular-nums text-xs text-gray-500">
                {t.min}–{t.max}%
              </span>
            </li>
          ))}
        </ul>
      )}
      <Link
        to={`${base}/build/results`}
        className="mt-3 flex items-center justify-between rounded-md border border-gray-200 px-3 py-2 text-sm font-medium text-ink hover:border-brand-500 hover:text-brand-700"
      >
        Edit result page <span aria-hidden>→</span>
      </Link>
    </div>
  );
}
