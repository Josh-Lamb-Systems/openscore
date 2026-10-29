import { ChevronLeft, ChevronRight, Download, Search, Smile, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Form, Link, useFetcher, useNavigation, useSubmit } from "react-router";
import { ResultError } from "~/components/admin/feedback";
import { Checkbox, TierPill } from "~/components/admin/form-bits";
import { DateTime } from "~/components/admin/date-time";
import { PageContainer } from "~/components/app/nav";
import { Button } from "~/components/ui/button";
import { Input, Select } from "~/components/ui/input";
import { Card, EmptyState, StatusPill } from "~/components/ui/misc";
import type { ActionResult } from "~/lib/admin/action-result";
import { scorecardTitle } from "~/lib/admin/meta";
import {
  filtersToSearch,
  parseResponseFilters,
  RESPONSES_PAGE_SIZE,
  type ResponseFilters,
} from "~/lib/admin/responses-filter";
import { cn } from "~/lib/utils";
import { fail, jsonField, ok, str } from "~/server/admin-actions.server";
import { deleteResponses, listResponses } from "~/server/admin-responses.server";
import { requireScorecard } from "~/server/scorecards.server";
import type { Route } from "./+types/responses";
import { useScorecard } from "./layout";

export function meta({ matches }: Route.MetaArgs) {
  return scorecardTitle("Responses", matches);
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const sc = await requireScorecard(params.id);
  const filters = parseResponseFilters(new URL(request.url).searchParams, sc.liveVersionId ? "live" : "test");
  const list = await listResponses(sc.id, filters);
  return { filters: { ...filters, page: list.page }, ...list };
}

export async function action({ request, params }: Route.ActionArgs) {
  const sc = await requireScorecard(params.id);
  const form = await request.formData();
  const intent = str(form, "intent");
  if (intent === "delete") {
    const ids = jsonField(form, "ids");
    if (!Array.isArray(ids) || ids.some((id) => typeof id !== "string")) return fail(intent, "Nothing selected.");
    const n = await deleteResponses(sc.id, ids as string[]);
    return ok(intent, `Deleted ${n} response${n === 1 ? "" : "s"}`);
  }
  return fail(intent, "Unknown action.");
}

function Toolbar({ filters, total }: { filters: ResponseFilters; total: number }) {
  const submit = useSubmit();
  const formRef = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const go = (delay = 0) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (formRef.current) submit(formRef.current, { replace: true, preventScrollReset: true });
    }, delay);
  };

  return (
    <Form
      ref={formRef}
      method="get"
      className="flex flex-wrap items-center gap-3 px-5 py-3"
      onChange={(e) => go((e.target as HTMLElement).tagName === "INPUT" ? 350 : 0)}
    >
      <label className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-gray-400" />
        <Input
          type="search"
          name="q"
          defaultValue={filters.q}
          placeholder="Search name or email"
          className="w-60 pl-8"
          aria-label="Search responses"
        />
      </label>
      <span className="text-sm text-gray-700">
        {total} result{total === 1 ? "" : "s"}
      </span>
      <div className="ml-auto flex items-center gap-2">
        <Select name="data" defaultValue={filters.data} className="h-8 w-36" aria-label="Data">
          <option value="live">Live data</option>
          <option value="test">Test data</option>
          <option value="all">All data</option>
        </Select>
        <Select name="status" defaultValue={filters.status} className="h-8 w-36" aria-label="Status">
          <option value="all">Any status</option>
          <option value="completed">Completed</option>
          <option value="incomplete">Incomplete</option>
        </Select>
      </div>
    </Form>
  );
}

export default function Responses({ loaderData }: Route.ComponentProps) {
  const { scorecard, status } = useScorecard();
  const { items, total, page, pageCount, filters } = loaderData;
  const base = `/scorecards/${scorecard.id}`;
  const navigation = useNavigation();
  const loading = navigation.state === "loading" && navigation.location?.pathname === `${base}/responses`;
  const fetcher = useFetcher<ActionResult>();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const listKey = items.map((i) => i.id).join(",");
  useEffect(() => setSelected(new Set()), [listKey]);

  const allSelected = items.length > 0 && items.every((i) => selected.has(i.id));
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(items.map((i) => i.id)));
  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const deleting = fetcher.state !== "idle";
  const deleteSelected = () => {
    const n = selected.size;
    if (!confirm(`Delete ${n} response${n === 1 ? "" : "s"}? This cannot be undone.`)) return;
    fetcher.submit({ intent: "delete", ids: JSON.stringify([...selected]) }, { method: "post" });
  };

  const exportHref = `${base}/responses.csv${filtersToSearch({ ...filters, page: 1 })}`;
  const pageHref = (p: number) => `${base}/responses${filtersToSearch({ ...filters, page: p })}`;
  const filtered = !!filters.q || filters.status !== "all";
  const from = total === 0 ? 0 : (page - 1) * RESPONSES_PAGE_SIZE + 1;
  const to = Math.min(total, page * RESPONSES_PAGE_SIZE);

  return (
    <PageContainer className="max-w-6xl">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          Responses
          {filters.data === "test" && (
            <span className="ml-2 text-lg font-semibold text-amber-600">Draft Mode Data</span>
          )}
          {filters.data === "all" && (
            <span className="ml-2 text-lg font-semibold text-gray-500">Live &amp; Test Data</span>
          )}
        </h1>
        <Button asChild variant={total === 0 ? "secondary" : "primary"}>
          <a href={exportHref} download aria-disabled={total === 0}>
            Export CSV <Download />
          </a>
        </Button>
      </div>

      {status === "draft" && filters.data === "live" && (
        <p className="-mt-3 mb-4 text-sm text-gray-600">
          This scorecard isn't live yet. Responses you make in preview are{" "}
          <Link to={`${base}/responses?data=test`} className="text-brand-700 hover:underline">
            test data
          </Link>
          .
        </p>
      )}

      <Card className={cn("overflow-hidden transition-opacity", loading && "opacity-60")}>
        <Toolbar key={`${filters.q}|${filters.data}|${filters.status}`} filters={filters} total={total} />

        {selected.size > 0 && (
          <div className="flex items-center gap-3 border-t border-gray-200 bg-brand-50 px-5 py-2 text-sm">
            <span className="font-medium text-brand-800">{selected.size} selected</span>
            <Button variant="danger" size="sm" onClick={deleteSelected} disabled={deleting}>
              <Trash2 /> {deleting ? "Deleting…" : "Delete"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
          </div>
        )}
        <ResultError result={fetcher.data} className="mx-5 mb-3" />

        <table className="w-full text-sm">
          <thead className="border-y border-gray-200 bg-gray-50 text-left text-[11px] uppercase tracking-wider text-gray-500">
            <tr>
              <th className="w-12 px-5 py-2.5">
                <Checkbox
                  checked={allSelected}
                  onChange={toggleAll}
                  disabled={items.length === 0}
                  aria-label="Select all on this page"
                />
              </th>
              <th className="px-3 py-2.5 font-medium">Name</th>
              <th className="px-3 py-2.5 font-medium">Email</th>
              <th className="px-3 py-2.5 font-medium">Date</th>
              <th className="px-3 py-2.5 font-medium">Score</th>
              <th className="px-5 py-2.5 text-right font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((r) => {
              const href = `${base}/responses/${r.id}`;
              return (
                <tr key={r.id} className={cn("hover:bg-gray-50", selected.has(r.id) && "bg-brand-50/50")}>
                  <td className="px-5 py-3">
                    <Checkbox
                      checked={selected.has(r.id)}
                      onChange={() => toggle(r.id)}
                      aria-label={`Select ${r.name || r.email || "response"}`}
                    />
                  </td>
                  <td className="px-3 py-3">
                    <Link to={href} className="font-medium text-ink hover:text-brand-700 hover:underline">
                      {r.name || <span className="text-gray-500">Anonymous</span>}
                    </Link>
                  </td>
                  <td className="px-3 py-3 text-gray-700">{r.email ?? "–"}</td>
                  <td className="px-3 py-3 whitespace-nowrap text-gray-700">
                    <DateTime value={r.startedAt} />
                  </td>
                  <td className="px-3 py-3">
                    {r.overallPercent == null ? (
                      <span className="text-gray-400">–</span>
                    ) : (
                      <span className="inline-flex items-center gap-2">
                        <span className="w-10 font-medium tabular-nums">{r.overallPercent}%</span>
                        {r.tier && <TierPill name={r.tier.name} color={r.tier.color} />}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <span className="inline-flex items-center gap-1.5">
                      {r.isTest && filters.data !== "test" && <StatusPill tone="draft">Test</StatusPill>}
                      {r.completedAt ? (
                        <StatusPill tone="live">Completed</StatusPill>
                      ) : (
                        <StatusPill tone="neutral">Incomplete</StatusPill>
                      )}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {items.length === 0 &&
          (filtered ? (
            <EmptyState
              className="py-16"
              title="No responses match your filters"
              action={
                <Button variant="secondary" asChild>
                  <Link to={`${base}/responses${filtersToSearch({ data: filters.data })}`}>Clear filters</Link>
                </Button>
              }
            />
          ) : (
            <div className="py-20 text-center text-[17px] text-ink">
              <p>You don't have any {filters.data === "test" ? "test responses" : "responses"} yet.</p>
              <p className="inline-flex items-center gap-1.5">
                Don't worry, it won't be long until you do <Smile className="size-5" />
              </p>
            </div>
          ))}

        {total > RESPONSES_PAGE_SIZE && (
          <div className="flex items-center justify-between border-t border-gray-200 px-5 py-3 text-sm text-gray-700">
            <span>
              Showing {from}–{to} of {total}
            </span>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" asChild>
                <Link
                  to={pageHref(page - 1)}
                  aria-disabled={page <= 1}
                  className={cn(page <= 1 && "pointer-events-none opacity-50")}
                  preventScrollReset
                >
                  <ChevronLeft /> Previous
                </Link>
              </Button>
              <span className="px-1">
                Page {page} of {pageCount}
              </span>
              <Button variant="secondary" size="sm" asChild>
                <Link
                  to={pageHref(page + 1)}
                  aria-disabled={page >= pageCount}
                  className={cn(page >= pageCount && "pointer-events-none opacity-50")}
                  preventScrollReset
                >
                  Next <ChevronRight />
                </Link>
              </Button>
            </div>
          </div>
        )}
      </Card>
    </PageContainer>
  );
}
