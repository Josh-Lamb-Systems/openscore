import { LayoutGrid, List, MoreHorizontal, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { data, Form, Link, redirect, useFetcher, useNavigation, useSearchParams } from "react-router";
import { PageContainer } from "~/components/app/nav";
import { Button } from "~/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "~/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Field, Input } from "~/components/ui/input";
import { Card, EmptyState, StatusPill } from "~/components/ui/misc";
import { cn, timeAgo } from "~/lib/utils";
import { userContext } from "~/server/auth.server";
import {
  createScorecard,
  deleteScorecard,
  duplicateScorecard,
  listScorecards,
} from "~/server/scorecards.server";
import type { Route } from "./+types/scorecards";

export function meta() {
  return [{ title: "Scorecards · OpenScore" }];
}

export async function loader() {
  return { scorecards: await listScorecards() };
}

export async function action({ request, context }: Route.ActionArgs) {
  const user = context.get(userContext)!;
  const form = await request.formData();
  const intent = form.get("intent");

  if (intent === "create") {
    const name = String(form.get("name") ?? "").trim();
    if (!name) return data({ error: "Give your scorecard a name." }, { status: 400 });
    const sc = await createScorecard(name, user.id);
    throw redirect(`/scorecards/${sc.id}`);
  }
  const id = String(form.get("id") ?? "");
  if (intent === "duplicate") {
    await duplicateScorecard(id, user.id);
    return { error: null };
  }
  if (intent === "delete") {
    await deleteScorecard(id);
    return { error: null };
  }
  return data({ error: "Unknown action" }, { status: 400 });
}

type Item = Route.ComponentProps["loaderData"]["scorecards"][number];

function Thumbnail({ item }: { item: Item }) {
  return (
    <div className="flex h-40 gap-3 overflow-hidden border-b border-gray-200 bg-gradient-to-br from-gray-50 to-brand-50 p-4">
      <div className="flex-1">
        <div className="mb-3 h-2 w-12 rounded bg-gray-300" />
        <p className="line-clamp-2 text-base font-semibold leading-snug text-ink">{item.title}</p>
        <p className="mt-1 line-clamp-2 text-xs text-gray-600">{item.subtitle}</p>
      </div>
      <div className="mt-6 w-24 shrink-0 space-y-1.5 rounded-md bg-ink p-2">
        <div className="h-2 rounded bg-white/80" />
        <div className="h-2 rounded bg-white/80" />
        <div className="h-2 rounded bg-white/80" />
        <div className="h-2.5 rounded bg-brand-500" />
      </div>
    </div>
  );
}

function ItemMenu({ item }: { item: Item }) {
  const fetcher = useFetcher();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="rounded p-1 text-gray-700 hover:bg-gray-100" aria-label={`Actions for ${item.name}`}>
        <MoreHorizontal className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem asChild>
          <Link to={`/scorecards/${item.id}/build/questions`}>Edit questions</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to={`/scorecards/${item.id}/settings/general`}>Settings</Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => fetcher.submit({ intent: "duplicate", id: item.id }, { method: "post" })}>
          Duplicate
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          destructive
          onSelect={() => {
            if (confirm(`Delete "${item.name}" and all of its responses? This cannot be undone.`)) {
              fetcher.submit({ intent: "delete", id: item.id }, { method: "post" });
            }
          }}
        >
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function CreateDialog({ open, onOpenChange, error }: { open: boolean; onOpenChange: (o: boolean) => void; error?: string | null }) {
  const busy = useNavigation().state === "submitting";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Create Scorecard"
        description={
          <>
            Give your scorecard a punchy name that intrigues people.
            <br />
            “The Influence Scorecard”, “The Genius Test”, “Your Profit Scorecard”
          </>
        }
        className="max-w-2xl"
      >
        <Form method="post">
          <DialogBody>
            <Field label="SCORECARD NAME" htmlFor="name" error={error}>
              <Input id="name" name="name" defaultValue="New Scorecard" required autoFocus onFocus={(e) => e.target.select()} />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" name="intent" value="create" disabled={busy}>
              Create Scorecard
            </Button>
          </DialogFooter>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default function Scorecards({ loaderData, actionData }: Route.ComponentProps) {
  const [params, setParams] = useSearchParams();
  const [open, setOpen] = useState(params.get("create") === "1");
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");

  useEffect(() => {
    if (params.get("create") === "1") setOpen(true);
  }, [params]);

  const onOpenChange = (o: boolean) => {
    setOpen(o);
    if (!o && params.has("create")) setParams({}, { replace: true });
  };

  const items = loaderData.scorecards.filter((s) => s.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <PageContainer>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Your Scorecards</h1>
        <Button onClick={() => setOpen(true)}>Create Scorecard</Button>
      </div>
      <CreateDialog open={open} onOpenChange={onOpenChange} error={actionData?.error} />

      <Card>
        <div className="flex items-center gap-4 border-b border-gray-200 px-5 py-3">
          <label className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-gray-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
              className="w-48 pl-8"
              aria-label="Search scorecards"
            />
          </label>
          <span className="text-sm text-gray-700">
            {items.length} scorecard{items.length === 1 ? "" : "s"}
          </span>
          <div className="ml-auto flex gap-1">
            <Button variant="ghost" size="icon-sm" aria-label="List view" onClick={() => setView("list")} className={cn(view === "list" && "text-brand-700")}>
              <List />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label="Grid view" onClick={() => setView("grid")} className={cn(view === "grid" && "text-brand-700")}>
              <LayoutGrid />
            </Button>
          </div>
        </div>
        <div className="bg-gray-50 px-5 py-3 text-lg font-medium">Scorecards</div>

        {items.length === 0 ? (
          <EmptyState
            title={loaderData.scorecards.length === 0 ? "No scorecards yet" : "No scorecards match your search"}
            description={loaderData.scorecards.length === 0 ? "Create your first scorecard to start generating leads." : undefined}
            action={loaderData.scorecards.length === 0 && <Button onClick={() => setOpen(true)}>Create Scorecard</Button>}
          />
        ) : view === "grid" ? (
          <div className="grid gap-5 p-5 sm:grid-cols-2">
            {items.map((item) => (
              <div key={item.id} className="overflow-hidden rounded-lg border border-gray-200 bg-white hover:shadow-md">
                <Link to={`/scorecards/${item.id}/home`} className="block">
                  <Thumbnail item={item} />
                  <div className="px-4 pt-3">
                    <p className="font-medium text-ink">{item.name}</p>
                    <p className="text-sm text-gray-600" suppressHydrationWarning>{timeAgo(item.updatedAt)}</p>
                    <p className="mt-3 text-[11px] font-medium uppercase tracking-wider text-gray-600">{item.leads} leads</p>
                  </div>
                </Link>
                <div className="flex items-center justify-between px-4 pb-3 pt-3">
                  <StatusPill tone={item.status === "live" ? "live" : "draft"}>{item.status === "live" ? "Live" : "Draft mode"}</StatusPill>
                  <ItemMenu item={item} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {items.map((item) => (
              <li key={item.id} className="flex items-center gap-4 px-5 py-3">
                <Link to={`/scorecards/${item.id}/home`} className="flex-1 font-medium hover:underline">
                  {item.name}
                </Link>
                <span className="w-24 text-sm text-gray-600">{item.leads} leads</span>
                <span className="w-36 text-sm text-gray-600" suppressHydrationWarning>{timeAgo(item.updatedAt)}</span>
                <StatusPill tone={item.status === "live" ? "live" : "draft"}>{item.status === "live" ? "Live" : "Draft"}</StatusPill>
                <ItemMenu item={item} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </PageContainer>
  );
}
