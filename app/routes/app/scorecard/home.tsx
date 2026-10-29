import { AlertTriangle, ArrowRight, ExternalLink } from "lucide-react";
import { data, Form, Link, useFetcher, useSubmit } from "react-router";
import { TierPill } from "~/components/admin/form-bits";
import { ScorecardThumbnail } from "~/components/admin/scorecard-thumbnail";
import { DateTime, useHydrated } from "~/components/admin/date-time";
import { PageContainer } from "~/components/app/nav";
import { Button } from "~/components/ui/button";
import { Select } from "~/components/ui/input";
import { Alert, Card, EmptyState, StatusPill } from "~/components/ui/misc";
import type { ActionResult } from "~/lib/admin/action-result";
import { firstName, greeting } from "~/lib/admin/greeting";
import { scorecardTitle } from "~/lib/admin/meta";
import type { ValidationIssue } from "~/lib/scorecard/validate";
import { str } from "~/server/admin-actions.server";
import { countResponses, overviewStats, recentResponses } from "~/server/admin-responses.server";
import { userContext } from "~/server/auth.server";
import {
  discardDraft,
  getScorecardTheme,
  publishScorecard,
  requireScorecard,
  unpublishScorecard,
} from "~/server/scorecards.server";
import type { Route } from "./+types/home";
import { useAppData } from "../layout";
import { useScorecard } from "./layout";

export function meta({ matches }: Route.MetaArgs) {
  return scorecardTitle("Home", matches);
}

const RANGES = [
  { value: "7", label: "Last 7 days", days: 7 },
  { value: "30", label: "Last 30 days", days: 30 },
  { value: "90", label: "Last 90 days", days: 90 },
  { value: "all", label: "All time", days: null },
] as const;

export async function loader({ request, params }: Route.LoaderArgs) {
  const sc = await requireScorecard(params.id);
  const rangeParam = new URL(request.url).searchParams.get("range");
  const range = RANGES.find((r) => r.value === rangeParam) ?? RANGES[1];
  const [theme, stats, recent, testCount] = await Promise.all([
    getScorecardTheme(sc),
    overviewStats(sc.id, range.days),
    recentResponses(sc.id, 5),
    countResponses(sc.id, true),
  ]);
  const d = sc.draftDefinition;
  return {
    theme,
    start: { title: d.startScreen.title, subtitle: d.startScreen.subtitle, bullets: d.startScreen.bullets },
    range: range.value,
    serverHour: new Date().getHours(),
    stats,
    recent,
    testCount,
  };
}

type PublishResult = ActionResult & { issues?: ValidationIssue[] };

export async function action({ request, params, context }: Route.ActionArgs) {
  const user = context.get(userContext)!;
  const sc = await requireScorecard(params.id);
  const form = await request.formData();
  const intent = str(form, "intent");

  if (intent === "publish") {
    const res = await publishScorecard(sc.id, user.id);
    if (!res.ok) {
      return data<PublishResult>(
        {
          ok: false,
          intent,
          error: `Fix ${res.issues.length === 1 ? "this issue" : `these ${res.issues.length} issues`} before publishing:`,
          issues: res.issues,
        },
        { status: 400 },
      );
    }
    return { ok: true, intent, message: `Published version ${res.version}` } as PublishResult;
  }
  if (intent === "unpublish") {
    await unpublishScorecard(sc.id);
    return { ok: true, intent, message: "Unpublished" } as PublishResult;
  }
  if (intent === "discard") {
    await discardDraft(sc.id);
    return { ok: true, intent, message: "Draft reset to the live version" } as PublishResult;
  }
  return data<PublishResult>({ ok: false, intent, error: "Unknown action." }, { status: 400 });
}

/** Where to fix a publish validation issue. */
function issueLink(path: string): { to: string; label: string } | null {
  if (path.startsWith("questions") || path.startsWith("categories"))
    return { to: "build/questions", label: "Questions" };
  if (path.startsWith("tiers")) return { to: "settings/tiers", label: "Score tiers" };
  if (path.startsWith("leadForm")) return { to: "settings/lead-form", label: "Lead form" };
  if (path.startsWith("startScreen")) return { to: "settings/general", label: "General settings" };
  if (path.startsWith("resultPage")) return { to: "build/results", label: "Result page" };
  return null;
}

function Greeting({ name, serverHour }: { name: string; serverHour: number }) {
  // SSR and hydration use the server's clock; the browser then switches to local time.
  const hydrated = useHydrated();
  const hour = hydrated ? new Date().getHours() : serverHour;
  return (
    <h1 className="text-2xl font-semibold tracking-tight text-ink">
      {greeting(hour)}, {firstName(name)}
    </h1>
  );
}

function PublishPanel() {
  const { scorecard, status, liveVersion, hasUnpublishedChanges } = useScorecard();
  const fetcher = useFetcher<PublishResult>();
  const busy = fetcher.state !== "idle";
  const pendingIntent = fetcher.formData?.get("intent");
  const result = fetcher.state === "idle" ? fetcher.data : undefined;
  const base = `/scorecards/${scorecard.id}`;

  const submit = (intent: string, confirmText?: string) => {
    if (confirmText && !confirm(confirmText)) return;
    fetcher.submit({ intent }, { method: "post" });
  };

  return (
    <div className="mt-3 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {status === "draft" ? (
          <Button onClick={() => submit("publish")} disabled={busy}>
            {pendingIntent === "publish" ? "Publishing…" : "Publish"}
          </Button>
        ) : (
          <>
            <Button onClick={() => submit("publish")} disabled={busy || !hasUnpublishedChanges}>
              {pendingIntent === "publish" ? "Publishing…" : "Publish changes"}
            </Button>
            {hasUnpublishedChanges && (
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() =>
                  submit("discard", "Discard all unpublished changes and reset the draft to the live version?")
                }
              >
                Discard unpublished changes
              </Button>
            )}
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() =>
                submit(
                  "unpublish",
                  'Unpublish this scorecard? The public link will show a "not available" page until you publish again.',
                )
              }
            >
              Unpublish
            </Button>
          </>
        )}
      </div>
      {status === "live" && liveVersion && (
        <p className="text-sm text-gray-600">
          Version {liveVersion.version} is live · published <DateTime value={liveVersion.publishedAt} />
          {hasUnpublishedChanges && (
            <span className="ml-2 inline-flex items-center gap-1 text-amber-700">
              <AlertTriangle className="size-3.5" /> You have unpublished changes
            </span>
          )}
        </p>
      )}
      {result?.ok && <Alert tone="success">{result.message}</Alert>}
      {result && !result.ok && (
        <Alert tone="error">
          <p className="font-medium">{result.error}</p>
          {result.issues && (
            <ul className="mt-2 space-y-1">
              {result.issues.map((issue, i) => {
                const link = issueLink(issue.path);
                return (
                  <li key={i} className="flex items-start justify-between gap-4">
                    <span>• {issue.message}</span>
                    {link && (
                      <Link to={`${base}/${link.to}`} className="shrink-0 font-medium text-red-900 underline">
                        {link.label}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Alert>
      )}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <Card className="p-5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold tabular-nums text-ink">{value}</p>
      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
    </Card>
  );
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { user } = useAppData();
  const { scorecard, status, publicUrl } = useScorecard();
  const { stats, recent, range, testCount } = loaderData;
  const submit = useSubmit();
  const base = `/scorecards/${scorecard.id}`;

  return (
    <PageContainer className="max-w-4xl">
      <Greeting name={user.name} serverHour={loaderData.serverHour} />
      <hr className="mb-6 mt-4 border-gray-200" />

      <Card className="flex items-start gap-6 p-6">
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
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <a
              href={publicUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex max-w-md items-center gap-2 rounded-md border border-gray-200 px-3 py-1.5 text-sm text-brand-700 hover:bg-gray-50"
            >
              <span className="truncate">{publicUrl}</span>
              <ExternalLink className="size-4 shrink-0" />
            </a>
            <Button variant="ghost" size="sm" asChild>
              <a href={`${base}/preview`} target="_blank" rel="noreferrer">
                Preview
              </a>
            </Button>
          </div>
          <PublishPanel />
        </div>
      </Card>

      <div className="mb-4 mt-10 flex items-center justify-between">
        <h2 className="font-semibold text-ink">Overview</h2>
        <Form method="get" onChange={(e) => submit(e.currentTarget, { preventScrollReset: true, replace: true })}>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <span className="font-medium">Date:</span>
            <Select name="range" defaultValue={range} className="h-8 w-40" aria-label="Date range">
              {RANGES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </Select>
          </label>
        </Form>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Responses started" value={stats.started} />
        <Stat label="Leads captured" value={stats.leads} />
        <Stat label="Completed" value={stats.completed} />
        <Stat
          label="Completion rate"
          value={stats.completionRate == null ? "–" : `${stats.completionRate}%`}
          hint="Completed ÷ started"
        />
      </div>
      <p className="mt-2 text-xs text-gray-500">
        Live data only.{" "}
        {testCount > 0 && (
          <>
            {testCount} test response{testCount === 1 ? "" : "s"} from draft mode {testCount === 1 ? "is" : "are"}{" "}
            excluded.{" "}
            <Link to={`${base}/responses?data=test`} className="text-brand-700 hover:underline">
              View test responses
            </Link>
          </>
        )}
      </p>

      <Card className="mt-6">
        <div className="flex items-center justify-between px-6 py-4">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Recent responses</h2>
          <Link
            to={`${base}/responses`}
            className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline"
          >
            View all responses <ArrowRight className="size-4" />
          </Link>
        </div>
        {recent.length === 0 ? (
          <EmptyState
            className="border-t border-gray-200 py-10"
            title="No responses yet"
            description={
              status === "live"
                ? "Share your scorecard to start collecting leads."
                : "Publish your scorecard and share the link to start collecting leads."
            }
          />
        ) : (
          <table className="w-full text-sm">
            <thead className="border-y border-gray-200 bg-gray-50 text-left text-[11px] uppercase tracking-wider text-gray-500">
              <tr>
                <th className="px-6 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Email</th>
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-6 py-2 text-right font-medium">Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {recent.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-6 py-2.5">
                    <Link to={`${base}/responses/${r.id}`} className="font-medium text-ink hover:underline">
                      {r.name || "Anonymous"}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 text-gray-700">{r.email ?? "–"}</td>
                  <td className="px-3 py-2.5 text-gray-700">
                    <DateTime value={r.startedAt} />
                  </td>
                  <td className="px-6 py-2.5 text-right">
                    {r.overallPercent == null ? (
                      <span className="text-gray-500">In progress</span>
                    ) : (
                      <span className="inline-flex items-center gap-2">
                        <span className="font-medium tabular-nums">{r.overallPercent}%</span>
                        {r.tier && <TierPill name={r.tier.name} color={r.tier.color} />}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </PageContainer>
  );
}
