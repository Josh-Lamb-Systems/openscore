import { Layers, ListOrdered, Palette, Plus, SlidersHorizontal } from "lucide-react";
import { data } from "react-router";
import { z } from "zod";
import { CanvasEmptyState, CanvasViewport, QuestionCanvas } from "~/components/builder/canvas";
import { CategoriesPane } from "~/components/builder/categories-panel";
import { useBuilderData } from "~/components/builder/data";
import { QuestionInspector } from "~/components/builder/inspector";
import { useQuestionActions } from "~/components/builder/question-actions";
import { QuestionListPane, useQuestionErrors } from "~/components/builder/question-list";
import { Rail, RailButton, RailLink } from "~/components/builder/rail";
import { useBuilder } from "~/components/builder/store";
import { TypePickerPane } from "~/components/builder/type-picker";
import type { BuilderSaveResult } from "~/components/builder/use-save";
import { categorySchema, questionSchema } from "~/lib/scorecard/schema";
import { sanitizeRichText } from "~/server/sanitize.server";
import { updateDraft } from "~/server/scorecards.server";
import type { Route } from "./+types/questions";

const saveQuestionsSchema = z.object({
  intent: z.literal("save-questions"),
  questions: z.array(questionSchema),
  categories: z.array(categorySchema),
});

export async function action({ request, params }: Route.ActionArgs) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return data<BuilderSaveResult>({ ok: false, errors: ["Invalid request."] }, { status: 400 });
  }
  const parsed = saveQuestionsSchema.safeParse(body);
  if (!parsed.success) {
    const errors = parsed.error.issues.slice(0, 10).map((issue) => {
      const [root, index, ...rest] = issue.path;
      const where =
        root === "questions" && typeof index === "number"
          ? `Question ${index + 1}${rest.length ? ` (${rest.join(".")})` : ""}`
          : root === "categories" && typeof index === "number"
            ? `Category ${index + 1}`
            : issue.path.join(".") || "Request";
      return `${where}: ${issue.message}`;
    });
    return data<BuilderSaveResult>({ ok: false, errors }, { status: 400 });
  }

  const questions = parsed.data.questions.map((q) => (q.type === "info" ? { ...q, body: sanitizeRichText(q.body) } : q));
  try {
    await updateDraft(params.id, { questions, categories: parsed.data.categories });
  } catch (error) {
    console.error("save-questions failed", error);
    return data<BuilderSaveResult>({ ok: false, errors: ["The draft could not be saved. Please try again."] }, { status: 500 });
  }
  return data<BuilderSaveResult>({ ok: true });
}

export function meta() {
  return [{ title: "Questions · OpenScore" }];
}

export default function QuestionBuilder() {
  const { id, theme, draftDefinition } = useBuilderData();
  const base = `/scorecards/${id}`;
  const panel = useBuilder((s) => s.panel);
  const setPanel = useBuilder((s) => s.setPanel);
  const device = useBuilder((s) => s.device);
  const questions = useBuilder((s) => s.doc.questions);
  const selectedId = useBuilder((s) => s.selectedQuestionId);
  const actions = useQuestionActions();
  const errors = useQuestionErrors();
  const selected = questions.find((q) => q.id === selectedId) ?? null;

  return (
    <>
      <Rail label="Question builder tools">
        <RailButton icon={Plus} label="Add question" active={panel === "add"} onClick={() => setPanel("add")} />
        <RailButton icon={ListOrdered} label="Questions" active={panel === "questions"} onClick={() => setPanel("questions")} />
        <RailButton icon={Layers} label="Categories" active={panel === "categories"} onClick={() => setPanel("categories")} />
        <RailLink icon={Palette} label="Theme" to={`${base}/theme`} />
        <RailLink icon={SlidersHorizontal} label="Page Settings" to={`${base}/settings/general`} />
      </Rail>

      <div className="w-[255px] shrink-0 border-r border-gray-200 bg-white">
        {panel === "add" ? (
          <TypePickerPane onPick={actions.add} onClose={() => setPanel("questions")} />
        ) : panel === "categories" ? (
          <CategoriesPane />
        ) : (
          <QuestionListPane scorecardId={id} tiers={draftDefinition.tiers} />
        )}
      </div>

      {selected ? (
        <>
          <CanvasViewport device={device}>
            <QuestionCanvas question={selected} theme={theme} />
          </CanvasViewport>
          <QuestionInspector key={selected.id} question={selected} errors={errors.get(selected.id) ?? []} />
        </>
      ) : (
        <CanvasEmptyState onAdd={() => setPanel("add")} />
      )}
    </>
  );
}
