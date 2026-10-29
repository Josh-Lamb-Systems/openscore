import {
  ArrowRight,
  ChartPie,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  ListOrdered,
  Loader2,
  MessageCircle,
  Monitor,
  Play,
  Redo2,
  Settings,
  Smartphone,
  Undo2,
} from "lucide-react";
import { Popover } from "radix-ui";
import { useState } from "react";
import { Link } from "react-router";
import { Button } from "~/components/ui/button";
import { StatusPill } from "~/components/ui/misc";
import { cn } from "~/lib/utils";
import { isDirty, useBuilder, type DeviceMode } from "./store";

export type BuilderSection = "questions" | "results";

export function BuilderHeader({
  scorecardId,
  name,
  status,
  section,
  tierCount,
  onSave,
  saving,
}: {
  scorecardId: string;
  name: string;
  status: "draft" | "live";
  section: BuilderSection;
  tierCount: number;
  onSave: () => void;
  saving: boolean;
}) {
  const base = `/scorecards/${scorecardId}`;
  const dirty = useBuilder(isDirty);
  const canUndo = useBuilder((s) => s.past.length > 0);
  const canRedo = useBuilder((s) => s.future.length > 0);
  const undo = useBuilder((s) => s.undo);
  const redo = useBuilder((s) => s.redo);
  const device = useBuilder((s) => s.device);
  const setDevice = useBuilder((s) => s.setDevice);
  const questionCount = useBuilder((s) => s.doc.questions.length);
  const categoryCount = useBuilder((s) => s.doc.categories.length);

  return (
    <header className="grid h-14 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-4 border-b border-gray-200 bg-white px-4">
      <div className="flex min-w-0 items-center gap-3">
        <Link
          to={`${base}/home`}
          aria-label="Back to scorecard"
          className="grid size-8 shrink-0 place-items-center rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
        >
          <ChevronLeft className="size-4" />
        </Link>
        <span className="truncate text-[15px] text-ink">{name}</span>
        <StatusPill tone={status === "live" ? "live" : "draft"}>{status === "live" ? "Live" : "Draft"}</StatusPill>
      </div>

      <ContentSwitcher
        base={base}
        section={section}
        questionCount={questionCount}
        categoryCount={categoryCount}
        tierCount={tierCount}
      />

      <div className="flex items-center justify-end gap-2">
        <DeviceToggle device={device} onChange={setDevice} />
        <a
          href={`${base}/preview`}
          target="_blank"
          rel="noreferrer"
          aria-label="Preview saved draft in a new tab"
          title={dirty ? "Preview (save first to see your latest changes)" : "Preview"}
          className="grid size-8 place-items-center rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
        >
          <Play className="size-4" />
        </a>
        <Link
          to={`${base}/settings/general`}
          aria-label="Scorecard settings"
          title="Settings"
          className="grid size-8 place-items-center rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
        >
          <Settings className="size-4" />
        </Link>
        <div className="flex h-8 items-center rounded-md border border-gray-300">
          <button
            type="button"
            onClick={undo}
            disabled={!canUndo}
            aria-label="Undo"
            title="Undo (Ctrl/⌘ Z)"
            className="grid h-full w-8 place-items-center rounded-l-md text-gray-700 hover:bg-gray-50 disabled:text-gray-300 disabled:hover:bg-transparent"
          >
            <Undo2 className="size-4" />
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={!canRedo}
            aria-label="Redo"
            title="Redo (Shift Ctrl/⌘ Z)"
            className="grid h-full w-8 place-items-center rounded-r-md text-gray-700 hover:bg-gray-50 disabled:text-gray-300 disabled:hover:bg-transparent"
          >
            <Redo2 className="size-4" />
          </button>
        </div>
        <Button size="sm" onClick={onSave} disabled={!dirty || saving} className="min-w-20">
          {saving ? (
            <>
              <Loader2 className="animate-spin" /> Saving…
            </>
          ) : (
            <>
              Save <ArrowRight />
            </>
          )}
        </Button>
        <span className="mx-1 h-6 w-px bg-gray-200" aria-hidden />
        <HelpButton />
      </div>
    </header>
  );
}

function DeviceToggle({ device, onChange }: { device: DeviceMode; onChange: (d: DeviceMode) => void }) {
  const items: { value: DeviceMode; label: string; icon: typeof Monitor }[] = [
    { value: "desktop", label: "Desktop preview", icon: Monitor },
    { value: "mobile", label: "Mobile preview", icon: Smartphone },
  ];
  return (
    <div className="flex h-8 items-center rounded-md border border-gray-300 p-0.5" role="group" aria-label="Preview device">
      {items.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          aria-label={label}
          title={label}
          aria-pressed={device === value}
          onClick={() => onChange(value)}
          className={cn(
            "grid h-full w-7 place-items-center rounded text-gray-500 hover:text-ink",
            device === value && "bg-gray-100 text-ink",
          )}
        >
          <Icon className="size-4" />
        </button>
      ))}
    </div>
  );
}

function ContentSwitcher({
  base,
  section,
  questionCount,
  categoryCount,
  tierCount,
}: {
  base: string;
  section: BuilderSection;
  questionCount: number;
  categoryCount: number;
  tierCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState<BuilderSection>(section);
  const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

  const sections = {
    questions: {
      label: "Questions",
      icon: MessageCircle,
      card: { title: "Question Flow", meta: `${plural(questionCount, "question")} · ${plural(categoryCount, "category", "categories")}`, to: `${base}/build/questions`, icon: ListOrdered },
    },
    results: {
      label: "Result Page",
      icon: ChartPie,
      card: { title: "Result Page", meta: plural(tierCount, "score tier"), to: `${base}/build/results`, icon: ChartPie },
    },
  } as const;
  const current = sections[section];
  const shown = sections[hover];

  return (
    <Popover.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setHover(section);
      }}
    >
      <Popover.Trigger
        className="flex h-9 items-center gap-2 rounded-md border border-gray-200 px-3 text-sm hover:bg-gray-50 data-[state=open]:bg-gray-50"
        aria-label="Switch builder content"
      >
        <current.icon className="size-4 text-gray-500" />
        <span className="text-gray-500">{current.label}</span>
        <ChevronRight className="size-3.5 text-gray-400" />
        <span className="font-medium text-ink">{current.card.title}</span>
        <ChevronDown className={cn("size-4 text-gray-500 transition-transform", open && "rotate-180")} />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          sideOffset={6}
          align="center"
          className="z-50 flex w-[640px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl"
        >
          <div className="w-52 shrink-0 border-r border-gray-200 bg-gray-50/60 p-3">
            <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Content</p>
            {(Object.keys(sections) as BuilderSection[]).map((key) => {
              const s = sections[key];
              return (
                <Link
                  key={key}
                  to={s.card.to}
                  onMouseEnter={() => setHover(key)}
                  onFocus={() => setHover(key)}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-2 py-2 text-sm font-medium text-gray-800 hover:bg-white",
                    hover === key && "bg-white shadow-sm",
                  )}
                >
                  <s.icon className="size-4 text-gray-500" />
                  {s.label}
                </Link>
              );
            })}
          </div>
          <div className="min-h-56 flex-1 p-5">
            <p className="mb-3 text-base font-semibold text-ink">{shown.label}</p>
            <Link
              to={shown.card.to}
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-4 rounded-lg border border-gray-200 bg-gray-50 p-3 hover:border-brand-500",
                hover === section && "border-brand-500/60",
              )}
            >
              <span className="grid h-14 w-20 place-items-center rounded-md border border-gray-200 bg-white text-gray-400">
                <shown.card.icon className="size-6" />
              </span>
              <span>
                <span className="block text-sm font-medium text-ink">{shown.card.title}</span>
                <span className="mt-0.5 block text-xs text-gray-500">{shown.card.meta}</span>
              </span>
            </Link>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function HelpButton() {
  const shortcuts: [string, string][] = [
    ["Save", "Ctrl/⌘ S"],
    ["Undo", "Ctrl/⌘ Z"],
    ["Redo", "Shift Ctrl/⌘ Z"],
  ];
  return (
    <Popover.Root>
      <Popover.Trigger
        aria-label="Help"
        className="grid size-8 place-items-center rounded-full text-gray-700 hover:bg-gray-100"
      >
        <CircleHelp className="size-5" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content sideOffset={6} align="end" className="z-50 w-72 rounded-lg border border-gray-200 bg-white p-4 text-sm shadow-lg">
          <p className="font-semibold text-ink">Builder tips</p>
          <p className="mt-1 text-gray-600">
            Changes are kept in this tab until you save. Preview opens the saved draft in a new tab.
          </p>
          <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Keyboard shortcuts</p>
          <dl className="mt-2 space-y-1.5">
            {shortcuts.map(([label, keys]) => (
              <div key={label} className="flex justify-between">
                <dt className="text-gray-700">{label}</dt>
                <dd>
                  <kbd className="rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 font-sans text-xs text-gray-700">{keys}</kbd>
                </dd>
              </div>
            ))}
          </dl>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
