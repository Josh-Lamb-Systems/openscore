import { Plus, Trash2, Wand2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useFetcher } from "react-router";
import { useFlash } from "~/components/admin/feedback";
import { SaveBar, SettingsPage, SettingsSection } from "~/components/admin/form-bits";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Alert } from "~/components/ui/misc";
import type { ActionResult } from "~/lib/admin/action-result";
import { normalizeHex } from "~/lib/admin/brand-tokens";
import { scorecardTitle } from "~/lib/admin/meta";
import { addTierBySplitting, autoDistributeTiers, nextTierColor, removeTierMerging } from "~/lib/admin/tiers";
import { newId } from "~/lib/scorecard/defaults";
import { tierSchema, type Tier } from "~/lib/scorecard/schema";
import { validateTiers } from "~/lib/scorecard/validate";
import { cn } from "~/lib/utils";
import { fail, jsonField, ok, str } from "~/server/admin-actions.server";
import { markSetupStepDone } from "~/server/admin-setup.server";
import { requireScorecard, updateDraft } from "~/server/scorecards.server";
import type { Route } from "./+types/settings.tiers";

export function meta({ matches }: Route.MetaArgs) {
  return scorecardTitle("Score tiers", matches);
}

export async function loader({ params }: Route.LoaderArgs) {
  const sc = await requireScorecard(params.id);
  return { id: sc.id, tiers: sc.draftDefinition.tiers };
}

export async function action({ request, params }: Route.ActionArgs) {
  const sc = await requireScorecard(params.id);
  const form = await request.formData();
  const intent = str(form, "intent");
  if (intent !== "save") return fail(intent, "Unknown action.");
  const parsed = tierSchema.array().safeParse(jsonField(form, "tiers"));
  if (!parsed.success) return fail(intent, "Tier ranges must be whole numbers between 0 and 100.");
  const tiers = parsed.data.map((t) => ({ ...t, name: t.name.trim(), color: normalizeHex(t.color) ?? "#0D9488" }));
  const issues = validateTiers(tiers);
  if (issues.length) return fail(intent, issues[0].message);
  await updateDraft(sc.id, { tiers });
  await markSetupStepDone(sc.id, "tiers");
  return ok(intent, "Tiers saved");
}

function TierBar({ tiers, issueIds }: { tiers: Tier[]; issueIds: Set<string> }) {
  return (
    <div>
      <div className="relative h-10 overflow-hidden rounded-md bg-[repeating-linear-gradient(45deg,#fee2e2_0_6px,#fff_6px_12px)] ring-1 ring-gray-200">
        {tiers.map((t) => {
          const min = Math.max(0, Math.min(100, t.min));
          const max = Math.max(0, Math.min(100, t.max));
          if (max < min) return null;
          return (
            <div
              key={t.id}
              className={cn(
                "absolute inset-y-0 flex items-center justify-center overflow-hidden border-r border-white/70 px-1 text-xs font-medium text-white",
                issueIds.has(t.id) && "opacity-80",
              )}
              style={{
                left: `${(min / 101) * 100}%`,
                width: `${((max - min + 1) / 101) * 100}%`,
                backgroundColor: t.color,
              }}
              title={`${t.name}: ${t.min}–${t.max}%`}
            >
              <span className="truncate drop-shadow-sm">{t.name}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-[11px] tabular-nums text-gray-500">
        {[0, 25, 50, 75, 100].map((n) => (
          <span key={n}>{n}%</span>
        ))}
      </div>
    </div>
  );
}

function TiersEditor({ loaderData }: { loaderData: Route.ComponentProps["loaderData"] }) {
  const fetcher = useFetcher<ActionResult>();
  const [tiers, setTiers] = useState<Tier[]>(loaderData.tiers);
  const saved = useFlash(fetcher.state, fetcher.data);
  useEffect(() => {
    if (saved) setTiers(loaderData.tiers);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved]);

  const issues = useMemo(() => validateTiers(tiers), [tiers]);
  const issueIds = new Set(issues.map((i) => i.path.split(".")[1]).filter(Boolean));
  const dirty = JSON.stringify(tiers) !== JSON.stringify(loaderData.tiers);
  const busy = fetcher.state !== "idle";
  const result = fetcher.state === "idle" ? fetcher.data : undefined;
  const update = (id: string, patch: Partial<Tier>) =>
    setTiers((ts) => ts.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  const num = (v: string) => (v === "" ? 0 : Math.round(Number(v)));

  const addTier = () =>
    setTiers((ts) =>
      addTierBySplitting(ts, (min, max) => ({
        id: newId("tier"),
        name: "New tier",
        min,
        max,
        color: nextTierColor(ts),
      })),
    );

  return (
    <SettingsPage
      title="Score Tiers"
      description="Tiers group respondents by their overall score. Each tier gets its own result page content, and categories use the same ranges."
      actions={
        <Button
          variant="secondary"
          onClick={() => setTiers((ts) => autoDistributeTiers(ts))}
          disabled={tiers.length === 0}
        >
          <Wand2 /> Auto-distribute
        </Button>
      }
    >
      <SettingsSection
        title="Ranges"
        description="Tiers must cover 0–100% with no gaps or overlaps. Ranges are inclusive."
      >
        <TierBar tiers={tiers} issueIds={issueIds} />
        <div className="mt-6 overflow-hidden rounded-lg border border-gray-200 bg-white">
          <div className="grid grid-cols-[48px_minmax(0,1fr)_200px_44px] items-center gap-3 px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-gray-500">
            <span>Colour</span>
            <span>Name</span>
            <span>Range (%)</span>
            <span />
          </div>
          {tiers.map((t, i) => (
            <div
              key={t.id}
              className={cn(
                "grid grid-cols-[48px_minmax(0,1fr)_200px_44px] items-center gap-3 border-t border-gray-200 px-4 py-2.5",
                issueIds.has(t.id) && "bg-red-50/60",
              )}
            >
              <label className="relative grid size-9 cursor-pointer place-items-center rounded-md border border-gray-300">
                <span className="size-5 rounded" style={{ backgroundColor: t.color }} />
                <input
                  type="color"
                  value={(normalizeHex(t.color) ?? "#0D9488").toLowerCase()}
                  onChange={(e) => update(t.id, { color: e.target.value.toUpperCase() })}
                  className="absolute inset-0 cursor-pointer opacity-0"
                  aria-label={`Colour for ${t.name || `tier ${i + 1}`}`}
                />
              </label>
              <Input
                value={t.name}
                onChange={(e) => update(t.id, { name: e.target.value })}
                aria-label={`Tier ${i + 1} name`}
                aria-invalid={!t.name.trim()}
              />
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={t.min}
                  onChange={(e) => update(t.id, { min: num(e.target.value) })}
                  className="text-right tabular-nums"
                  aria-label={`Tier ${i + 1} minimum`}
                />
                <span className="text-gray-400">–</span>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={t.max}
                  onChange={(e) => update(t.id, { max: num(e.target.value) })}
                  className="text-right tabular-nums"
                  aria-label={`Tier ${i + 1} maximum`}
                />
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={tiers.length <= 1}
                onClick={() => setTiers((ts) => removeTierMerging(ts, t.id))}
                aria-label={`Remove ${t.name || `tier ${i + 1}`}`}
                className="hover:text-red-600"
              >
                <Trash2 />
              </Button>
            </div>
          ))}
        </div>
        <Button variant="link" className="mt-3 px-3" onClick={addTier}>
          <Plus /> Add tier
        </Button>
      </SettingsSection>

      {issues.length > 0 ? (
        <Alert tone="warning">
          <ul className="list-disc space-y-0.5 pl-4">
            {issues.map((i, n) => (
              <li key={n}>{i.message}</li>
            ))}
          </ul>
        </Alert>
      ) : (
        <p className="text-sm text-gray-600">
          Write what each tier sees in the{" "}
          <Link to={`/scorecards/${loaderData.id}/build/results`} className="text-brand-700 hover:underline">
            Result Page builder
          </Link>
          . Changes go live the next time you publish.
        </p>
      )}

      <SaveBar
        dirty={dirty}
        busy={busy}
        onSave={() => fetcher.submit({ intent: "save", tiers: JSON.stringify(tiers) }, { method: "post" })}
        onDiscard={() => setTiers(loaderData.tiers)}
        saved={saved}
        disabled={issues.length > 0}
        error={result && !result.ok ? result.error : undefined}
      />
    </SettingsPage>
  );
}

export default function TiersSettings({ loaderData }: Route.ComponentProps) {
  return <TiersEditor key={loaderData.id} loaderData={loaderData} />;
}
