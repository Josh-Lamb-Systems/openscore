import type { SetupStepId } from "~/lib/scorecard/setup";
import { requireScorecard, updateScorecard } from "./scorecards.server";

/** Ticks a manual setup-checklist step (e.g. after the user saves the tiers page). */
export async function markSetupStepDone(scorecardId: string, step: SetupStepId): Promise<void> {
  const sc = await requireScorecard(scorecardId);
  const steps = sc.settings.completedSteps ?? [];
  if (steps.includes(step)) return;
  await updateScorecard(sc.id, { settings: { ...sc.settings, completedSteps: [...steps, step] } });
}
