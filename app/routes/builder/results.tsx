import { ChartPie, ListOrdered, Palette, Trophy } from "lucide-react";
import { data } from "react-router";
import { z } from "zod";
import { CanvasViewport } from "~/components/builder/canvas";
import { useBuilderData } from "~/components/builder/data";
import { Rail, RailButton, RailLink } from "~/components/builder/rail";
import { ResultCanvas, ResultSettingsPane, sortTiers, TierContentInspector } from "~/components/builder/results-builder";
import { useBuilder } from "~/components/builder/store";
import type { BuilderSaveResult } from "~/components/builder/use-save";
import { resultPageSchema, type Definition, type ResultPage } from "~/lib/scorecard/schema";
import { sanitizeRichText } from "~/server/sanitize.server";
import { updateDraft } from "~/server/scorecards.server";
import type { Route } from "./+types/results";

const saveResultsSchema = z.object({
  intent: z.literal("save-results"),
  resultPage: resultPageSchema,
});

function sanitizeResultPage(rp: ResultPage): ResultPage {
  return {
    ...rp,
    tierContent: Object.fromEntries(
      Object.entries(rp.tierContent).map(([tierId, c]) => [tierId, { ...c, body: sanitizeRichText(c.body) }]),
    ),
    categoryContent: Object.fromEntries(
      Object.entries(rp.categoryContent).map(([categoryId, byTier]) => [
        categoryId,
        Object.fromEntries(Object.entries(byTier).map(([tierId, html]) => [tierId, sanitizeRichText(html)])),
      ]),
    ),
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return data<BuilderSaveResult>({ ok: false, errors: ["Invalid request."] }, { status: 400 });
  }
  const parsed = saveResultsSchema.safeParse(body);
  if (!parsed.success) {
    const errors = parsed.error.issues
      .slice(0, 10)
      .map((issue) => `${issue.path.filter((p) => p !== "resultPage").join(".") || "Result page"}: ${issue.message}`);
    return data<BuilderSaveResult>({ ok: false, errors }, { status: 400 });
  }
  try {
    await updateDraft(params.id, { resultPage: sanitizeResultPage(parsed.data.resultPage) });
  } catch (error) {
    console.error("save-results failed", error);
    return data<BuilderSaveResult>({ ok: false, errors: ["The draft could not be saved. Please try again."] }, { status: 500 });
  }
  return data<BuilderSaveResult>({ ok: true });
}

export function meta() {
  return [{ title: "Result Page · OpenScore" }];
}

export default function ResultsBuilder() {
  const { id, theme, draftDefinition } = useBuilderData();
  const base = `/scorecards/${id}`;
  const device = useBuilder((s) => s.device);
  const doc = useBuilder((s) => s.doc);
  const selectedTierId = useBuilder((s) => s.selectedTierId);

  const tiers = sortTiers(draftDefinition.tiers);
  const tier = tiers.find((t) => t.id === selectedTierId) ?? tiers[0] ?? null;
  // Tiers are edited on their own settings page; everything else comes from the live builder state.
  const definition: Definition = {
    ...draftDefinition,
    questions: doc.questions,
    categories: doc.categories,
    resultPage: doc.resultPage,
  };

  return (
    <>
      <Rail label="Result page tools">
        <RailLink icon={ListOrdered} label="Questions" to={`${base}/build/questions`} />
        <RailButton icon={ChartPie} label="Result Page" active onClick={() => {}} />
        <RailLink icon={Trophy} label="Score Tiers" to={`${base}/settings/tiers`} />
        <RailLink icon={Palette} label="Theme" to={`${base}/theme`} />
      </Rail>
      <div className="w-[255px] shrink-0 border-r border-gray-200 bg-white">
        <ResultSettingsPane scorecardId={id} tiers={tiers} />
      </div>
      <CanvasViewport device={device}>
        <ResultCanvas definition={definition} theme={theme} tier={tier} />
      </CanvasViewport>
      <TierContentInspector tier={tier} />
    </>
  );
}
