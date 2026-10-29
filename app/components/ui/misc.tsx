import { cn } from "~/lib/utils";

/** Status pill: DRAFT MODE (amber), LIVE (green), HOME PAGE etc. */
export function StatusPill({
  tone,
  className,
  children,
}: {
  tone: "draft" | "live" | "neutral" | "danger";
  className?: string;
  children: React.ReactNode;
}) {
  const tones = {
    draft: "bg-amber-50 text-amber-600",
    live: "bg-green-50 text-green-700",
    neutral: "bg-gray-100 text-gray-600",
    danger: "bg-red-50 text-red-600",
  };
  const dots = { draft: "bg-amber-500", live: "bg-green-600", neutral: "bg-gray-400", danger: "bg-red-500" };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        tones[tone],
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", dots[tone])} />
      {children}
    </span>
  );
}

/** Violet "New" badge used in navigation. */
export function NewBadge() {
  return <span className="rounded bg-violet-600 px-1.5 py-0.5 text-[10px] font-medium text-white">New</span>;
}

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-lg border border-gray-200 bg-white", className)} {...props} />;
}

export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-6 flex items-start justify-between gap-4", className)}>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        {description && <p className="mt-1 text-gray-600">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-14 text-center", className)}>
      <p className="font-medium text-gray-900">{title}</p>
      {description && <p className="mt-1 max-w-md text-sm text-gray-600">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Inline banner for form errors / success. */
export function Alert({
  tone = "error",
  className,
  children,
}: {
  tone?: "error" | "success" | "info" | "warning";
  className?: string;
  children: React.ReactNode;
}) {
  const tones = {
    error: "border-red-200 bg-red-50 text-red-800",
    success: "border-green-200 bg-green-50 text-green-800",
    info: "border-brand-200 bg-brand-50 text-brand-800",
    warning: "border-amber-200 bg-amber-50 text-amber-800",
  };
  return <div className={cn("rounded-md border px-4 py-3 text-sm", tones[tone], className)}>{children}</div>;
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold text-ink", className)}>
      <span className="grid size-8 place-items-center rounded-lg bg-ink text-sm font-bold text-brand-200">
        <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
          <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="3" />
          <path d="M12 4a8 8 0 0 1 8 8" fill="none" stroke="#14b8a6" strokeWidth="3" strokeLinecap="round" />
        </svg>
      </span>
    </span>
  );
}
