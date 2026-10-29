import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** "a few seconds ago", "3 minutes ago", "2 days ago". */
export function timeAgo(date: Date | string, now = new Date()): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const seconds = Math.round((now.getTime() - d.getTime()) / 1000);
  if (seconds < 45) return "a few seconds ago";
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const steps: [Intl.RelativeTimeFormatUnit, number][] = [
    ["minute", 60],
    ["hour", 60],
    ["day", 24],
    ["month", 30],
    ["year", 12],
  ];
  let value = seconds;
  let unit: Intl.RelativeTimeFormatUnit = "second";
  for (const [next, factor] of steps) {
    if (Math.abs(value) < factor) break;
    value = Math.round(value / factor);
    unit = next;
  }
  return rtf.format(-value, unit);
}

export function formatDateTime(date: Date | string): string {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(
    typeof date === "string" ? new Date(date) : date,
  );
}
