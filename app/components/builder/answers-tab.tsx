import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CirclePlus, GripVertical, ImageIcon, Trash2 } from "lucide-react";
import { newId } from "~/lib/scorecard/defaults";
import {
  isOptionQuestion,
  type ChoiceOption,
  type OptionQuestion,
  type Question,
  type QuestionOfType,
} from "~/lib/scorecard/schema";
import { questionMaxPoints, scalePoints, visibleOptions } from "~/lib/scoring/score";
import { cn } from "~/lib/utils";
import { InspectorSection, NumberField, TextField } from "./fields";
import { restrictToVerticalAxis } from "./question-list";
import { useQuestionPatch } from "./store";

export function AnswersTab({ question: q, errors }: { question: Question; errors: string[] }) {
  const max = questionMaxPoints(q);
  const scored = q.type !== "open_text" && q.type !== "info";
  return (
    <div>
      <InspectorSection>
        {scored ? (
          <div className="flex items-center justify-between rounded-md bg-brand-50 px-3 py-2 text-sm">
            <span className="text-brand-800">Max points for this question</span>
            <span className="font-semibold tabular-nums text-brand-800">{formatPoints(max)}</span>
          </div>
        ) : (
          <p className="rounded-md bg-gray-50 px-3 py-3 text-sm text-gray-700">
            This question isn't scored.
            {q.type === "open_text" && " Answers are saved with the response and sent in webhooks."}
          </p>
        )}
        {errors.length > 0 && (
          <ul className="space-y-0.5 text-xs text-red-600" aria-live="polite">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}
      </InspectorSection>
      {isOptionQuestion(q) && (q.type === "yes_no" ? <YesNoAnswers q={q} /> : <OptionAnswers q={q} />)}
      {(q.type === "linear_scale" || q.type === "sliding_scale") && <ScaleMapping q={q} />}
      {q.type === "numeric" && <NumericMapping q={q} />}
    </div>
  );
}

function formatPoints(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function YesNoAnswers({ q }: { q: QuestionOfType<"yes_no"> }) {
  const patch = useQuestionPatch();
  const shown = visibleOptions(q);
  const setOption = (id: string, p: Partial<ChoiceOption>, coalesce?: string) =>
    patch(q, { options: q.options.map((o) => (o.id === id ? { ...o, ...p } : o)) }, coalesce);
  return (
    <InspectorSection title="Answers">
      <div className="grid grid-cols-[1fr_4.5rem] gap-x-2 gap-y-2 text-xs text-gray-500">
        <span>Label</span>
        <span>Points</span>
        {shown.map((o) => (
          <AnswerLabelPoints key={o.id} option={o} onChange={(p, c) => setOption(o.id, p, c)} />
        ))}
      </div>
      {!q.showMaybe && <p className="text-xs text-gray-500">Turn on “Show maybe answer” on the Question tab to add a third answer.</p>}
    </InspectorSection>
  );
}

function AnswerLabelPoints({
  option: o,
  onChange,
}: {
  option: ChoiceOption;
  onChange: (p: Partial<ChoiceOption>, coalesce?: string) => void;
}) {
  return (
    <>
      <TextField
        aria-label={`Label for ${o.id}`}
        value={o.label}
        aria-invalid={!o.label.trim() || undefined}
        onChange={(e) => onChange({ label: e.target.value }, `label-${o.id}`)}
      />
      <NumberField
        aria-label={`Points for ${o.label || o.id}`}
        integer
        min={0}
        value={o.points}
        onChange={(v) => v != null && onChange({ points: v }, `points-${o.id}`)}
      />
    </>
  );
}

function OptionAnswers({ q }: { q: Exclude<OptionQuestion, { type: "yes_no" }> }) {
  const patch = useQuestionPatch();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const setOption = (id: string, p: Partial<ChoiceOption>, coalesce?: string) =>
    patch(q, { options: q.options.map((o) => (o.id === id ? { ...o, ...p } : o)) }, coalesce);

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = q.options.findIndex((o) => o.id === active.id);
    const to = q.options.findIndex((o) => o.id === over.id);
    if (from < 0 || to < 0) return;
    const options = [...q.options];
    const [moved] = options.splice(from, 1);
    options.splice(to, 0, moved);
    patch(q, { options });
  };

  const add = () => {
    const n = q.options.length + 1;
    const label = q.type === "image_buttons" ? `Option ${n}` : q.type === "divided_scale" ? `Segment ${n}` : `Answer ${n}`;
    patch(q, { options: [...q.options, { id: newId("opt"), label, points: 0, imageUrl: null }] });
  };

  return (
    <InspectorSection title={q.type === "divided_scale" ? "Segments (left to right)" : "Answers"}>
      <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis]} onDragEnd={onDragEnd}>
        <SortableContext items={q.options.map((o) => o.id)} strategy={verticalListSortingStrategy}>
          <ul className="space-y-2">
            {q.options.map((o, i) => (
              <OptionRow
                key={o.id}
                index={i}
                option={o}
                withImage={q.type === "image_buttons"}
                canRemove={q.options.length > 1}
                onChange={(p, c) => setOption(o.id, p, c)}
                onRemove={() => patch(q, { options: q.options.filter((x) => x.id !== o.id) })}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
      <button
        type="button"
        onClick={add}
        className="flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-800 hover:underline"
      >
        <CirclePlus className="size-4" /> Add {q.type === "divided_scale" ? "segment" : "answer"}
      </button>
      {q.type === "choice_checkbox" && (
        <p className="text-xs text-gray-500">Points of every selected answer are added up.</p>
      )}
    </InspectorSection>
  );
}

function OptionRow({
  index,
  option: o,
  withImage,
  canRemove,
  onChange,
  onRemove,
}: {
  index: number;
  option: ChoiceOption;
  withImage: boolean;
  canRemove: boolean;
  onChange: (p: Partial<ChoiceOption>, coalesce?: string) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: o.id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn("rounded-md border border-gray-200 bg-white p-2", isDragging && "relative z-10 shadow-md")}
    >
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          ref={setActivatorNodeRef}
          aria-label={`Reorder answer ${index + 1}`}
          className="grid h-9 w-5 shrink-0 cursor-grab place-items-center text-gray-400 hover:text-gray-700 active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </button>
        <TextField
          aria-label={`Answer ${index + 1} label`}
          value={o.label}
          placeholder={`Answer ${index + 1}`}
          aria-invalid={!o.label.trim() || undefined}
          onChange={(e) => onChange({ label: e.target.value }, `label-${o.id}`)}
          className="min-w-0 flex-1 px-2"
        />
        <NumberField
          aria-label={`Answer ${index + 1} points`}
          integer
          min={0}
          value={o.points}
          onChange={(v) => v != null && onChange({ points: v }, `points-${o.id}`)}
          className="w-14 shrink-0 px-2"
        />
        <button
          type="button"
          onClick={onRemove}
          disabled={!canRemove}
          aria-label={`Remove answer ${index + 1}`}
          className="grid size-7 shrink-0 place-items-center rounded text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
      {withImage && (
        <div className="mt-2 flex items-center gap-2 pl-6">
          <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded border border-gray-200 bg-gray-50 text-gray-400">
            {o.imageUrl ? <img src={o.imageUrl} alt="" className="size-full object-cover" /> : <ImageIcon className="size-4" />}
          </span>
          <TextField
            type="url"
            aria-label={`Answer ${index + 1} image URL`}
            placeholder="Image URL (https://…)"
            value={o.imageUrl ?? ""}
            aria-invalid={!o.imageUrl || undefined}
            onChange={(e) => onChange({ imageUrl: e.target.value || null }, `image-${o.id}`)}
            className="min-w-0 flex-1 px-2"
          />
        </div>
      )}
    </li>
  );
}

function ScaleMapping({ q }: { q: QuestionOfType<"linear_scale"> | QuestionOfType<"sliding_scale"> }) {
  const rows: number[] = [];
  if (q.type === "linear_scale" && q.max > q.min && q.max - q.min <= 20) {
    for (let v = q.min; v <= q.max; v++) rows.push(v);
  } else if (q.max > q.min) {
    rows.push(q.min, q.min + (q.max - q.min) / 4, q.min + (q.max - q.min) / 2, q.min + (3 * (q.max - q.min)) / 4, q.max);
  }
  return (
    <InspectorSection title="Points">
      <p className="text-sm text-gray-700">
        The answer is mapped linearly onto the points range: {q.min} scores {q.pointsMin}, {q.max} scores {q.pointsMax}. Change
        the ranges on the Question tab.
      </p>
      {rows.length > 0 && (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500">
              <th className="py-1 font-normal">Answer</th>
              <th className="py-1 text-right font-normal">Points</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((v) => (
              <tr key={v}>
                <td className="py-1 tabular-nums text-gray-800">{formatPoints(v)}</td>
                <td className="py-1 text-right tabular-nums text-gray-800">{formatPoints(Math.round(scalePoints(q, v) * 100) / 100)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </InspectorSection>
  );
}

function NumericMapping({ q }: { q: QuestionOfType<"numeric"> }) {
  const unit = q.unit ? ` ${q.unit}` : "";
  const describe = (r: QuestionOfType<"numeric">["ranges"][number]) =>
    r.min == null && r.max == null
      ? "Any value"
      : r.min == null
        ? `Up to ${r.max}${unit}`
        : r.max == null
          ? `${r.min}${unit} or more`
          : `${r.min}–${r.max}${unit}`;
  return (
    <InspectorSection title="Points">
      <p className="text-sm text-gray-700">
        The first range containing the answer decides the points; answers outside every range score 0. Edit the ranges on
        the Question tab.
      </p>
      {q.ranges.length > 0 && (
        <ul className="divide-y divide-gray-100 text-sm">
          {q.ranges.map((r) => (
            <li key={r.id} className="flex justify-between py-1">
              <span className="text-gray-800">{describe(r)}</span>
              <span className="tabular-nums text-gray-800">
                {r.points} pt{r.points === 1 ? "" : "s"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </InspectorSection>
  );
}
