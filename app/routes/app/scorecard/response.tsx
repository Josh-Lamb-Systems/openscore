import { ArrowLeft, ExternalLink, Trash2 } from "lucide-react";
import { data, Link, redirect, useFetcher } from "react-router";
import { TierPill } from "~/components/admin/form-bits";
import { DateTime } from "~/components/admin/date-time";
import { PageContainer } from "~/components/app/nav";
import { Button } from "~/components/ui/button";
import { Card, StatusPill } from "~/components/ui/misc";
import { scorecardTitle } from "~/lib/admin/meta";
import { formatAnswer } from "~/lib/scorecard/format";
import { isScoredQuestion } from "~/lib/scorecard/schema";
import { scoreResponse } from "~/lib/scoring/score";
import { str } from "~/server/admin-actions.server";
import { deleteResponses, leadName } from "~/server/admin-responses.server";
import { definitionForResponse, getResponse, resultUrl } from "~/server/responses.server";
import { requireScorecard } from "~/server/scorecards.server";
import type { Route } from "./+types/response";
import { useScorecard } from "./layout";

export function meta({ matches, loaderData }: Route.MetaArgs) {
  return scorecardTitle(loaderData?.title ?? "Response", matches);
}

export async function loader({ params }: Route.LoaderArgs) {
  const sc = await requireScorecard(params.id);
  const r = await getResponse(params.responseId);
  if (!r || r.scorecardId !== sc.id) throw data("Response not found", { status: 404 });
  const { definition, version } = await definitionForResponse(r);
  const score = scoreResponse(definition, r.answers ?? {});
  const tierOf = (id: string | null) => {
    const t = id ? definition.tiers.find((x) => x.id === id) : null;
    return t ? { name: t.name, color: t.color } : null;
  };
  const categoryName = (id: string | null) => definition.categories.find((c) => c.id === id)?.name ?? null;

  const fieldKeys = new Set(definition.leadForm.fields.map((f) => f.key));
  const lead = [
    ...definition.leadForm.fields
      .filter((f) => r.lead[f.key] !== undefined || f.enabled)
      .map((f) => ({ key: f.key, label: f.label, value: r.lead[f.key] })),
    ...Object.keys(r.lead)
      .filter((k) => !fieldKeys.has(k))
      .map((k) => ({ key: k, label: k, value: r.lead[k] })),
  ].map((f) => ({ ...f, value: typeof f.value === "boolean" ? (f.value ? "Yes" : "No") : (f.value ?? "") }));

  let n = 0;
  const answers = definition.questions
    .filter((q) => q.type !== "info")
    .map((q) => ({
      id: q.id,
      number: ++n,
      text: q.text,
      category: categoryName(q.categoryId),
      scored: isScoredQuestion(q),
      answered: r.answers[q.id] !== undefined,
      answer: formatAnswer(q, r.answers[q.id]),
      points: score.questions[q.id]?.points ?? null,
      maxPoints: score.questions[q.id]?.maxPoints ?? null,
    }));

  const name = leadName(r.lead);
  return {
    title: name || r.email || "Response",
    response: {
      id: r.id,
      name,
      email: r.email,
      isTest: r.isTest,
      startedAt: r.startedAt,
      leadCapturedAt: r.leadCapturedAt,
      completedAt: r.completedAt,
      consent: r.consent,
      overallPercent: r.overallPercent,
      points: r.points,
      tier: tierOf(r.tierId),
      categories: (r.categoryScores ?? []).map((c) => ({ ...c, tier: tierOf(c.tierId) })),
      userAgent: r.userAgent,
      referrer: r.referrer,
    },
    version,
    lead,
    consentEnabled: definition.leadForm.consent.mode !== "implied" || !!r.consent,
    answers,
    resultUrl: r.completedAt ? resultUrl(sc.slug, r.resultToken) : null,
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  const sc = await requireScorecard(params.id);
  const form = await request.formData();
  if (str(form, "intent") === "delete") {
    await deleteResponses(sc.id, [params.responseId]);
    const back = new URL(request.url).searchParams.get("back");
    throw redirect(back?.startsWith(`/scorecards/${sc.id}/responses`) ? back : `/scorecards/${sc.id}/responses`);
  }
  throw data("Unknown action", { status: 400 });
}

const CONSENT_LABELS = {
  implied: "Implied consent",
  explicit_optional: "Explicit consent (optional)",
  explicit_required: "Explicit consent (required)",
} as const;

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2 text-sm">
      <dt className="text-gray-600">{label}</dt>
      <dd className="min-w-0 break-words text-right text-ink">{children}</dd>
    </div>
  );
}

export default function ResponseDetail({ loaderData }: Route.ComponentProps) {
  const { scorecard } = useScorecard();
  const { response: r, lead, answers, version, resultUrl } = loaderData;
  const base = `/scorecards/${scorecard.id}`;
  const fetcher = useFetcher();
  const deleting = fetcher.state !== "idle";

  return (
    <PageContainer className="max-w-6xl">
      <Link
        to={`${base}/responses${r.isTest ? "?data=test" : ""}`}
        className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-ink"
      >
        <ArrowLeft className="size-4" /> All responses
      </Link>
      <div className="mb-6 mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            {r.name || r.email || "Anonymous response"}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-gray-600">
            {r.completedAt ? (
              <StatusPill tone="live">Completed</StatusPill>
            ) : (
              <StatusPill tone="neutral">Incomplete</StatusPill>
            )}
            {r.isTest && <StatusPill tone="draft">Test data</StatusPill>}
            {r.email && r.name && <span>{r.email}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {resultUrl && (
            <Button variant="secondary" asChild>
              <a href={resultUrl} target="_blank" rel="noreferrer">
                View result page <ExternalLink />
              </a>
            </Button>
          )}
          <Button
            variant="ghost"
            className="text-red-600 hover:bg-red-50"
            disabled={deleting}
            onClick={() => {
              if (confirm("Delete this response? This cannot be undone.")) {
                fetcher.submit({ intent: "delete" }, { method: "post" });
              }
            }}
          >
            <Trash2 /> {deleting ? "Deleting…" : "Delete"}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="self-start">
          <h2 className="border-b border-gray-200 px-6 py-4 font-semibold text-ink">Answers</h2>
          {answers.length === 0 ? (
            <p className="px-6 py-8 text-sm text-gray-500">This scorecard had no questions.</p>
          ) : (
            <ol className="divide-y divide-gray-100">
              {answers.map((a) => (
                <li key={a.id} className="flex gap-4 px-6 py-4">
                  <span className="mt-0.5 w-6 shrink-0 text-sm tabular-nums text-gray-400">{a.number}.</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-medium text-ink">
                      {a.text || <span className="text-gray-400">Untitled question</span>}
                    </p>
                    {a.category && <p className="mt-0.5 text-xs uppercase tracking-wide text-gray-500">{a.category}</p>}
                    <p className="mt-1.5 whitespace-pre-wrap text-[15px] text-gray-800">
                      {a.answered && a.answer ? a.answer : <span className="italic text-gray-400">Not answered</span>}
                    </p>
                  </div>
                  <span className="shrink-0 text-right text-sm tabular-nums text-gray-600">
                    {a.scored && a.maxPoints != null ? (
                      <>
                        <span className="font-medium text-ink">{a.points}</span> / {a.maxPoints} pts
                      </>
                    ) : (
                      <span className="text-gray-400">Not scored</span>
                    )}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Card>

        <div className="space-y-6">
          <Card className="p-6">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Overall score</p>
            {r.overallPercent == null ? (
              <p className="mt-2 text-gray-600">Not scored yet; the respondent hasn't finished.</p>
            ) : (
              <>
                <div className="mt-2 flex items-center gap-3">
                  <span className="text-4xl font-semibold tabular-nums text-ink">{r.overallPercent}%</span>
                  {r.tier && <TierPill name={r.tier.name} color={r.tier.color} />}
                </div>
                {r.points && (
                  <p className="mt-1 text-sm text-gray-600">
                    {r.points.points} of {r.points.maxPoints} points
                  </p>
                )}
              </>
            )}
            {r.categories.length > 0 && (
              <div className="mt-5 space-y-3 border-t border-gray-200 pt-4">
                {r.categories.map((c) => (
                  <div key={c.categoryId}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-800">{c.name}</span>
                      <span className="font-medium tabular-nums">{c.percent}%</span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-gray-100">
                      <div
                        className="h-1.5 rounded-full"
                        style={{ width: `${c.percent}%`, backgroundColor: c.tier?.color ?? "var(--color-brand-600)" }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="px-6 py-4">
            <h2 className="mb-1 font-semibold text-ink">Lead details</h2>
            <dl className="divide-y divide-gray-100">
              {lead.length === 0 && <p className="py-2 text-sm text-gray-500">No lead details captured.</p>}
              {lead.map((f) => (
                <Row key={f.key} label={f.label}>
                  {f.value === "" ? <span className="text-gray-400">–</span> : f.value}
                </Row>
              ))}
              {r.consent && (
                <Row label="Consent">
                  {r.consent.mode === "implied" ? (
                    "Implied"
                  ) : (
                    <>
                      {r.consent.given ? "Given" : "Not given"}
                      <span className="block text-xs text-gray-500">{CONSENT_LABELS[r.consent.mode]}</span>
                    </>
                  )}
                </Row>
              )}
            </dl>
          </Card>

          <Card className="px-6 py-4">
            <h2 className="mb-1 font-semibold text-ink">Details</h2>
            <dl className="divide-y divide-gray-100">
              <Row label="Started">
                <DateTime value={r.startedAt} />
              </Row>
              <Row label="Lead captured">{r.leadCapturedAt ? <DateTime value={r.leadCapturedAt} /> : "–"}</Row>
              <Row label="Completed">{r.completedAt ? <DateTime value={r.completedAt} /> : "–"}</Row>
              <Row label="Version">{version != null ? `Version ${version}` : "Draft (test)"}</Row>
              {r.referrer && <Row label="Referrer">{r.referrer}</Row>}
              {r.userAgent && (
                <Row label="Browser">
                  <span className="line-clamp-2 text-xs text-gray-600" title={r.userAgent}>
                    {r.userAgent}
                  </span>
                </Row>
              )}
            </dl>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}
