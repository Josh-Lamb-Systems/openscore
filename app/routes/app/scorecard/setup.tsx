import {
  ChevronDown,
  ClipboardList,
  ExternalLink,
  Eye,
  Layers,
  ListOrdered,
  Megaphone,
  Paintbrush,
  PieChart,
  Rocket,
} from "lucide-react";
import { Accordion } from "radix-ui";
import { Link, useFetcher } from "react-router";
import { ResultError } from "~/components/admin/feedback";
import { CircleCheck } from "~/components/admin/form-bits";
import { ScorecardThumbnail } from "~/components/admin/scorecard-thumbnail";
import { PageContainer } from "~/components/app/nav";
import { Button } from "~/components/ui/button";
import { Label, Select } from "~/components/ui/input";
import { Alert, Card, StatusPill } from "~/components/ui/misc";
import type { ActionResult } from "~/lib/admin/action-result";
import { scorecardTitle } from "~/lib/admin/meta";
import type { SetupStepId } from "~/lib/scorecard/setup";
import { validateLeadForm, validateTiers } from "~/lib/scorecard/validate";
import { cn } from "~/lib/utils";
import { fail, ok, str } from "~/server/admin-actions.server";
import { db, schema } from "~/server/db.server";
import { getBrandKit, getScorecardTheme, requireScorecard, updateScorecard } from "~/server/scorecards.server";
import type { Route } from "./+types/setup";
import { useScorecard } from "./layout";

export function meta({ matches }: Route.MetaArgs) {
  return scorecardTitle("Setup", matches);
}

export async function loader({ params }: Route.LoaderArgs) {
  const sc = await requireScorecard(params.id);
  const d = sc.draftDefinition;
  const [theme, kits] = await Promise.all([
    getScorecardTheme(sc),
    db
      .select({ id: schema.brandKits.id, name: schema.brandKits.name })
      .from(schema.brandKits)
      .orderBy(schema.brandKits.name),
  ]);
  return {
    theme,
    kits,
    brandKitId: sc.brandKitId,
    start: { title: d.startScreen.title, subtitle: d.startScreen.subtitle, bullets: d.startScreen.bullets },
    issues: {
      tiers: validateTiers(d.tiers).map((i) => i.message),
      leadForm: validateLeadForm(d.leadForm).map((i) => i.message),
    } as Partial<Record<SetupStepId, string[]>>,
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  const sc = await requireScorecard(params.id);
  const form = await request.formData();
  const intent = str(form, "intent");

  if (intent === "toggleStep") {
    const step = str(form, "step");
    const done = str(form, "done") === "true";
    const current = new Set(sc.settings.completedSteps ?? []);
    if (done) current.add(step);
    else current.delete(step);
    await updateScorecard(sc.id, { settings: { ...sc.settings, completedSteps: [...current] } });
    return ok(intent);
  }

  if (intent === "setBrandKit") {
    const kitId = str(form, "brandKitId") || null;
    if (kitId && !(await getBrandKit(kitId))) return fail(intent, "That brand kit no longer exists.");
    await updateScorecard(sc.id, { brandKitId: kitId });
    return ok(intent, "Theme updated");
  }

  return fail(intent, "Unknown action.");
}

const ICONS: Record<SetupStepId, React.ComponentType<{ className?: string }>> = {
  branding: Paintbrush,
  questions: ListOrdered,
  tiers: Layers,
  results: PieChart,
  leadForm: ClipboardList,
  test: Eye,
  publish: Rocket,
  share: Megaphone,
};

const CTA: Record<SetupStepId, string> = {
  branding: "Go to theme settings",
  questions: "Go to question builder",
  tiers: "Go to score tiers",
  results: "Go to result page builder",
  leadForm: "Go to lead form settings",
  test: "Preview scorecard",
  publish: "Go to publish",
  share: "Go to share & embed",
};

type Step = ReturnType<typeof useScorecard>["progress"]["steps"][number];

function StepCard({
  step,
  base,
  issues,
  children,
}: {
  step: Step;
  base: string;
  issues: string[];
  children?: React.ReactNode;
}) {
  const fetcher = useFetcher<ActionResult>();
  const pending = fetcher.formData?.get("intent") === "toggleStep" ? fetcher.formData.get("done") === "true" : null;
  const done = pending ?? step.done;
  const blocked = issues.length > 0;
  const locked = (step.auto && step.done) || blocked;
  const Icon = ICONS[step.id];
  const href = step.path === "preview" ? `${base}/preview` : `${base}/${step.path}`;

  return (
    <Accordion.Item value={step.id} asChild>
      <Card className="overflow-hidden data-[state=open]:shadow-md">
        <Accordion.Header className="flex items-center gap-3 px-5 py-4">
          <button
            type="button"
            role="checkbox"
            aria-checked={done}
            aria-label={`Mark "${step.title}" as ${done ? "not done" : "done"}`}
            title={
              step.auto && step.done
                ? "Completed automatically"
                : blocked
                  ? "Fix the issues on this step first"
                  : done
                    ? "Mark as not done"
                    : "Mark as done"
            }
            disabled={locked}
            onClick={() =>
              fetcher.submit({ intent: "toggleStep", step: step.id, done: String(!done) }, { method: "post" })
            }
            className="rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed"
          >
            <CircleCheck checked={done} className={cn(!locked && !done && "hover:border-brand-500")} />
          </button>
          <Accordion.Trigger className="group flex flex-1 items-center gap-3 text-left">
            <Icon className="size-4 text-gray-500" />
            <span className={cn("flex-1 text-lg font-semibold text-ink", done && "text-gray-500")}>{step.title}</span>
            {blocked && <StatusPill tone="danger">Needs attention</StatusPill>}
            {step.auto && step.done && <span className="text-xs text-gray-500">Done automatically</span>}
            <ChevronDown className="size-4 text-gray-500 transition-transform group-data-[state=open]:rotate-180" />
          </Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Content className="px-5 pb-5 pl-14">
          <p className="max-w-2xl text-[15px] leading-relaxed text-gray-700">{step.description}</p>
          {blocked && (
            <Alert tone="warning" className="mt-4">
              <ul className="list-disc space-y-0.5 pl-4">
                {issues.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            </Alert>
          )}
          {children}
          <div className="mt-4">
            <Button asChild>
              {step.path === "preview" ? (
                <a href={href} target="_blank" rel="noreferrer">
                  {CTA[step.id]} <ExternalLink />
                </a>
              ) : (
                <Link to={href}>{CTA[step.id]}</Link>
              )}
            </Button>
          </div>
          <ResultError result={fetcher.data} className="mt-3" />
        </Accordion.Content>
      </Card>
    </Accordion.Item>
  );
}

function ThemeSource({ kits, brandKitId }: { kits: { id: string; name: string }[]; brandKitId: string | null }) {
  const fetcher = useFetcher<ActionResult>();
  const value = (fetcher.formData?.get("brandKitId") as string | undefined) ?? brandKitId ?? "";
  return (
    <div className="mt-4 max-w-xs space-y-1.5">
      <Label htmlFor="theme-source">Theme source</Label>
      <Select
        id="theme-source"
        value={value}
        onChange={(e) => fetcher.submit({ intent: "setBrandKit", brandKitId: e.target.value }, { method: "post" })}
      >
        <option value="">Default theme</option>
        {kits.map((k) => (
          <option key={k.id} value={k.id}>
            Brand kit: {k.name}
          </option>
        ))}
      </Select>
      {kits.length === 0 && (
        <p className="text-xs text-gray-500">
          <Link to="/brand-kits" className="text-brand-700 hover:underline">
            Create a brand kit
          </Link>{" "}
          to reuse your branding across scorecards.
        </p>
      )}
    </div>
  );
}

export default function Setup({ loaderData }: Route.ComponentProps) {
  const { scorecard, status, publicUrl, progress } = useScorecard();
  const base = `/scorecards/${scorecard.id}`;
  const firstOpen = progress.steps.find((s) => !s.done)?.id ?? progress.steps[0].id;

  return (
    <PageContainer className="max-w-4xl">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Scorecard Setup</h1>
      <p className="mt-1 text-gray-600">Build, launch, and optimise this scorecard to start generating leads.</p>

      <Card className="mt-8 flex items-center gap-6 p-6">
        <ScorecardThumbnail
          theme={loaderData.theme}
          title={loaderData.start.title}
          subtitle={loaderData.start.subtitle}
          bullets={loaderData.start.bullets}
        />
        <div className="min-w-0 flex-1">
          <StatusPill tone={status === "live" ? "live" : "draft"}>
            {status === "live" ? "Live" : "Draft mode"}
          </StatusPill>
          <p className="mt-2 text-lg font-semibold text-ink">{scorecard.name}</p>
          <a
            href={publicUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-2 flex max-w-md items-center justify-between gap-3 rounded-md border border-gray-200 px-3 py-2 text-sm text-brand-700 hover:bg-gray-50"
          >
            <span className="truncate">{publicUrl}</span>
            <ExternalLink className="size-4 shrink-0" />
          </a>
          {status !== "live" && (
            <p className="mt-1.5 text-xs text-gray-500">
              This link goes live when you publish. Until then, use Preview to test it.
            </p>
          )}
        </div>
      </Card>

      <Card className="mt-4 px-6 py-5">
        <div className="flex items-center justify-between text-[15px]">
          <span className="text-gray-800">
            Progress: {progress.completed} of {progress.total} steps complete
          </span>
          <span className="font-semibold">{progress.percent}%</span>
        </div>
        <div
          className="mt-3 h-2 rounded-full bg-gray-200"
          role="progressbar"
          aria-valuenow={progress.percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Setup progress"
        >
          <div
            className={cn(
              "h-2 rounded-full transition-all",
              progress.percent === 100 ? "bg-brand-600" : "bg-amber-500",
            )}
            style={{ width: `${progress.percent}%` }}
          />
        </div>
      </Card>

      <p className="mb-3 mt-8 text-[11px] font-semibold uppercase tracking-wider text-brand-700">Setup</p>
      <Accordion.Root type="single" collapsible defaultValue={firstOpen} className="space-y-3">
        {progress.steps.map((step) => (
          <StepCard key={step.id} step={step} base={base} issues={loaderData.issues[step.id] ?? []}>
            {step.id === "branding" && <ThemeSource kits={loaderData.kits} brandKitId={loaderData.brandKitId} />}
          </StepCard>
        ))}
      </Accordion.Root>
      <p className="mt-6 text-sm text-gray-500">
        Optional:{" "}
        <Link to={`${base}/integrate`} className="text-brand-700 hover:underline">
          connect a webhook
        </Link>{" "}
        to send leads and results to your other tools.
      </p>
    </PageContainer>
  );
}
