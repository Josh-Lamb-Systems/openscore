import { Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { SwitchRow } from "~/components/ui/switch";
import { RichTextEditor } from "~/components/ui/rich-text-editor";
import { newId } from "~/lib/scorecard/defaults";
import type { Question, QuestionOfType, QuestionType } from "~/lib/scorecard/schema";
import { cn } from "~/lib/utils";
import { convertQuestion } from "./convert";
import { InspectorSection, LabeledField, NumberField, RangeFields, SelectField, TextAreaField, TextField } from "./fields";
import { replaceQuestion, useBuilder, useQuestionPatch } from "./store";
import { TypeSelect } from "./type-select";

const RANDOMIZABLE: QuestionType[] = ["yes_no", "choice_buttons", "choice_radio", "choice_checkbox", "image_buttons"];

export function QuestionTab({ question: q, errors }: { question: Question; errors: string[] }) {
  const patch = useQuestionPatch();
  const update = useBuilder((s) => s.update);

  const changeType = (type: QuestionType) =>
    update((doc) => replaceQuestion(doc, q.id, (cur) => convertQuestion(cur, type)));

  return (
    <div>
      <InspectorSection>
        <TypeSelect value={q.type} onChange={changeType} />
        {errors.length > 0 && (
          <ul className="space-y-0.5 text-xs text-red-600" aria-live="polite">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}
        <LabeledField label={q.type === "info" ? "Heading (optional)" : "Question"}>
          {(id) => (
            <TextAreaField
              id={id}
              rows={2}
              value={q.text}
              placeholder={q.type === "info" ? "Write a heading" : "Write your question here"}
              onChange={(e) => patch(q, { text: e.target.value.replace(/\n/g, " ") }, "text")}
            />
          )}
        </LabeledField>

        <div>
          <SwitchRow
            label="Show instruction"
            checked={q.showInstruction}
            onCheckedChange={(v) => patch(q, { showInstruction: v })}
          />
          {q.showInstruction && (
            <TextAreaField
              aria-label="Instruction"
              rows={2}
              className="my-1.5"
              value={q.instruction}
              placeholder="e.g. Choose the answer that fits best"
              onChange={(e) => patch(q, { instruction: e.target.value }, "instruction")}
            />
          )}
          {q.type === "yes_no" && (
            <SwitchRow label="Show maybe answer" checked={q.showMaybe} onCheckedChange={(v) => patch(q, { showMaybe: v })} />
          )}
          {q.type !== "info" && (
            <SwitchRow label="Required" checked={q.required} onCheckedChange={(v) => patch(q, { required: v })} />
          )}
          {RANDOMIZABLE.includes(q.type) && "randomize" in q && (
            <SwitchRow
              label="Randomize answers order"
              checked={q.randomize}
              onCheckedChange={(v) => patch(q, { randomize: v })}
            />
          )}
          {q.type === "image_buttons" && (
            <SwitchRow
              label="Allow multiple selections"
              checked={q.multiSelect}
              onCheckedChange={(v) => patch(q, { multiSelect: v })}
            />
          )}
          {q.type === "open_text" && (
            <SwitchRow label="Long answer (multi-line)" checked={q.multiline} onCheckedChange={(v) => patch(q, { multiline: v })} />
          )}
        </div>

        {q.type === "open_text" && (
          <LabeledField label="Placeholder">
            {(id) => (
              <TextField
                id={id}
                value={q.placeholder}
                placeholder="Type your answer here"
                onChange={(e) => patch(q, { placeholder: e.target.value }, "placeholder")}
              />
            )}
          </LabeledField>
        )}

        {q.type === "choice_checkbox" && <CheckboxSettings q={q} />}
        {(q.type === "linear_scale" || q.type === "sliding_scale") && <ScaleSettings q={q} />}
        {q.type === "numeric" && <NumericSettings q={q} />}
        {q.type === "info" && <InfoSettings q={q} />}
      </InspectorSection>

      {(q.type === "linear_scale" || q.type === "sliding_scale") && (
        <InspectorSection title="Labels">
          {(["left", "center", "right"] as const).map((side) => (
            <LabeledField key={side} label={side === "left" ? "Left" : side === "center" ? "Center" : "Right"}>
              {(id) => (
                <TextField
                  id={id}
                  value={q.labels[side]}
                  onChange={(e) => patch(q, { labels: { ...q.labels, [side]: e.target.value } }, `label-${side}`)}
                />
              )}
            </LabeledField>
          ))}
        </InspectorSection>
      )}

      {q.type === "numeric" && <NumericRanges q={q} />}

      {q.type !== "info" && <CategorySection q={q} />}
      <MediaSection q={q} />
    </div>
  );
}

function CheckboxSettings({ q }: { q: QuestionOfType<"choice_checkbox"> }) {
  const patch = useQuestionPatch();
  return (
    <div className="grid grid-cols-2 gap-2">
      <LabeledField label="Min selections">
        {(id) => (
          <NumberField
            id={id}
            integer
            min={0}
            nullable
            placeholder="None"
            value={q.minSelections}
            onChange={(v) => patch(q, { minSelections: v })}
          />
        )}
      </LabeledField>
      <LabeledField label="Max selections">
        {(id) => (
          <NumberField
            id={id}
            integer
            min={1}
            nullable
            placeholder="None"
            value={q.maxSelections}
            onChange={(v) => patch(q, { maxSelections: v })}
          />
        )}
      </LabeledField>
    </div>
  );
}

function ScaleSettings({ q }: { q: QuestionOfType<"linear_scale"> | QuestionOfType<"sliding_scale"> }) {
  const patch = useQuestionPatch();
  const linear = q.type === "linear_scale";
  return (
    <>
      <RangeFields
        label="Scale range"
        integer={linear}
        min={q.min}
        max={q.max}
        onMin={(v) => v != null && patch(q, { min: v })}
        onMax={(v) => v != null && patch(q, { max: v })}
      />
      <div className={cn("grid gap-2", linear ? "grid-cols-1" : "grid-cols-2")}>
        {q.type === "sliding_scale" && (
          <LabeledField label="Step">
            {(id) => (
              <NumberField id={id} min={0} value={q.step} onChange={(v) => v != null && v > 0 && patch(q, { step: v })} />
            )}
          </LabeledField>
        )}
        <LabeledField label="Starting value">
          {(id) =>
            q.type === "linear_scale" ? (
              <NumberField
                id={id}
                integer
                nullable
                placeholder="None"
                value={q.start}
                onChange={(v) => patch(q, { start: v })}
              />
            ) : (
              <NumberField id={id} value={q.start} onChange={(v) => v != null && patch(q, { start: v })} />
            )
          }
        </LabeledField>
      </div>
      <RangeFields
        label="Points range"
        integer
        nonNegative
        min={q.pointsMin}
        max={q.pointsMax}
        onMin={(v) => v != null && patch(q, { pointsMin: v })}
        onMax={(v) => v != null && patch(q, { pointsMax: v })}
      />
      <p className="-mt-1 text-xs text-gray-500">
        Answers are mapped linearly from {q.pointsMin} pt{q.pointsMin === 1 ? "" : "s"} at {q.min} to {q.pointsMax} pt
        {q.pointsMax === 1 ? "" : "s"} at {q.max}.
      </p>
    </>
  );
}

function NumericSettings({ q }: { q: QuestionOfType<"numeric"> }) {
  const patch = useQuestionPatch();
  return (
    <>
      <RangeFields
        label="Allowed values"
        nullable
        min={q.min}
        max={q.max}
        onMin={(v) => patch(q, { min: v })}
        onMax={(v) => patch(q, { max: v })}
      />
      <LabeledField label="Unit" hint="Shown after the input, e.g. “staff” or “%”.">
        {(id) => <TextField id={id} value={q.unit} onChange={(e) => patch(q, { unit: e.target.value }, "unit")} />}
      </LabeledField>
    </>
  );
}

function NumericRanges({ q }: { q: QuestionOfType<"numeric"> }) {
  const patch = useQuestionPatch();
  const setRange = (id: string, p: Partial<QuestionOfType<"numeric">["ranges"][number]>) =>
    patch(q, { ranges: q.ranges.map((r) => (r.id === id ? { ...r, ...p } : r)) });
  return (
    <InspectorSection
      title="Scoring ranges"
      action={
        <button
          type="button"
          aria-label="Add scoring range"
          onClick={() => {
            const last = q.ranges[q.ranges.length - 1];
            const start = last?.max != null ? last.max + 1 : null;
            patch(q, { ranges: [...q.ranges, { id: newId("rng"), min: start, max: null, points: 0 }] });
          }}
          className="grid size-7 place-items-center rounded-md border border-brand-600 text-brand-700 hover:bg-brand-50"
        >
          <Plus className="size-4" />
        </button>
      }
    >
      <p className="text-xs text-gray-500">The first range that contains the answer decides the points. Leave a bound empty for “any”.</p>
      <div className="grid grid-cols-[1fr_auto_1fr_3.5rem_auto] items-center gap-1.5 text-xs text-gray-500">
        <span>From</span>
        <span />
        <span>To</span>
        <span>Points</span>
        <span />
        {q.ranges.map((r, i) => (
          <RangeRow
            key={r.id}
            index={i}
            range={r}
            onChange={(p) => setRange(r.id, p)}
            onRemove={() => patch(q, { ranges: q.ranges.filter((x) => x.id !== r.id) })}
          />
        ))}
      </div>
    </InspectorSection>
  );
}

function RangeRow({
  index,
  range: r,
  onChange,
  onRemove,
}: {
  index: number;
  range: QuestionOfType<"numeric">["ranges"][number];
  onChange: (p: Partial<QuestionOfType<"numeric">["ranges"][number]>) => void;
  onRemove: () => void;
}) {
  return (
    <>
      <NumberField aria-label={`Range ${index + 1} from`} nullable placeholder="Any" value={r.min} onChange={(v) => onChange({ min: v })} className="px-2" />
      <span className="text-gray-400">–</span>
      <NumberField aria-label={`Range ${index + 1} to`} nullable placeholder="Any" value={r.max} onChange={(v) => onChange({ max: v })} className="px-2" />
      <NumberField
        aria-label={`Range ${index + 1} points`}
        integer
        min={0}
        value={r.points}
        onChange={(v) => v != null && onChange({ points: v })}
        className="px-2"
      />
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove range ${index + 1}`}
        className="grid size-7 place-items-center rounded text-gray-400 hover:bg-red-50 hover:text-red-600"
      >
        <Trash2 className="size-3.5" />
      </button>
    </>
  );
}

function InfoSettings({ q }: { q: QuestionOfType<"info"> }) {
  const patch = useQuestionPatch();
  return (
    <>
      <div className="space-y-1.5">
        <p className="text-sm text-gray-800">Content</p>
        <RichTextEditor
          key={q.id}
          label="Info screen content"
          value={q.body}
          placeholder="Add some content for this screen…"
          onChange={(html) => patch(q, { body: html }, "body")}
        />
      </div>
      <LabeledField label="Button label">
        {(id) => (
          <TextField
            id={id}
            value={q.buttonLabel}
            placeholder="Continue"
            onChange={(e) => patch(q, { buttonLabel: e.target.value }, "buttonLabel")}
          />
        )}
      </LabeledField>
    </>
  );
}

const NEW_CATEGORY = "__new__";

function CategorySection({ q }: { q: Question }) {
  const categories = useBuilder((s) => s.doc.categories);
  const update = useBuilder((s) => s.update);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");

  const assign = (categoryId: string | null) =>
    update((doc) => replaceQuestion(doc, q.id, (cur) => ({ ...cur, categoryId })));

  const create = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const id = newId("cat");
    update((doc) =>
      replaceQuestion(
        { ...doc, categories: [...doc.categories, { id, name: trimmed, description: "" }] },
        q.id,
        (cur) => ({ ...cur, categoryId: id }),
      ),
    );
    setName("");
    setCreating(false);
  };

  return (
    <InspectorSection title="Category">
      <SelectField
        aria-label="Category"
        value={creating ? NEW_CATEGORY : (q.categoryId ?? "")}
        onChange={(e) => {
          if (e.target.value === NEW_CATEGORY) setCreating(true);
          else {
            setCreating(false);
            assign(e.target.value || null);
          }
        }}
      >
        <option value="">No category</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name || "Untitled category"}
          </option>
        ))}
        <option value={NEW_CATEGORY}>+ New category</option>
      </SelectField>
      {creating && (
        <form
          className="flex gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            create();
          }}
        >
          <TextField autoFocus aria-label="New category name" placeholder="Category name" value={name} onChange={(e) => setName(e.target.value)} />
          <button
            type="submit"
            disabled={!name.trim()}
            className="h-9 shrink-0 rounded-md bg-brand-600 px-3 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            Add
          </button>
          <button
            type="button"
            aria-label="Cancel new category"
            onClick={() => setCreating(false)}
            className="grid size-9 shrink-0 place-items-center rounded-md text-gray-500 hover:bg-gray-100"
          >
            <X className="size-4" />
          </button>
        </form>
      )}
      {q.type === "open_text" && <p className="text-xs text-gray-500">Open text answers aren't scored.</p>}
    </InspectorSection>
  );
}

function MediaSection({ q }: { q: Question }) {
  const patch = useQuestionPatch();
  const media = q.media;
  return (
    <InspectorSection title="Media">
      {!media ? (
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-800">Image or video</span>
          <button
            type="button"
            aria-label="Add image or video"
            onClick={() => patch(q, { media: { kind: "image", url: "" } })}
            className="grid size-8 place-items-center rounded-md border border-brand-600 text-brand-700 hover:bg-brand-50"
          >
            <Plus className="size-4" />
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <div className="flex flex-1 rounded-md border border-gray-300 p-0.5" role="radiogroup" aria-label="Media type">
              {(["image", "video"] as const).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  role="radio"
                  aria-checked={media.kind === kind}
                  onClick={() => patch(q, { media: { ...media, kind } })}
                  className={cn(
                    "flex-1 rounded px-2 py-1 text-sm capitalize text-gray-600",
                    media.kind === kind && "bg-gray-100 font-medium text-ink",
                  )}
                >
                  {kind}
                </button>
              ))}
            </div>
            <button
              type="button"
              aria-label="Remove media"
              onClick={() => patch(q, { media: null })}
              className="grid size-8 place-items-center rounded-md text-gray-500 hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
          <LabeledField
            label={media.kind === "image" ? "Image URL" : "Video URL"}
            hint={media.kind === "video" ? "YouTube, Vimeo or a direct video file link." : undefined}
          >
            {(id) => (
              <TextField
                id={id}
                type="url"
                placeholder="https://"
                value={media.url}
                onChange={(e) => patch(q, { media: { ...media, url: e.target.value } }, "media-url")}
              />
            )}
          </LabeledField>
        </>
      )}
    </InspectorSection>
  );
}

