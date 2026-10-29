import { formatAnswer } from "~/lib/scorecard/format";
import type { Answers, Definition, Question } from "~/lib/scorecard/schema";
import type { CsvValue } from "./csv";

/** A response plus the definition it was answered against (its pinned version or draft snapshot). */
export interface ExportResponse {
  id: string;
  startedAt: Date;
  completedAt: Date | null;
  isTest: boolean;
  lead: Record<string, string | boolean>;
  consent: { mode: string; given: boolean; at: string | null } | null;
  overallPercent: number | null;
  tierId: string | null;
  categoryScores: { categoryId: string; name: string; percent: number }[] | null;
  answers: Answers;
  definition: Definition;
}

/**
 * Rows (header first) for the responses CSV export. Columns follow the latest
 * definition; lead keys, categories and questions that only exist in older
 * versions are appended after it so no data is dropped.
 */
export function buildResponsesCsvRows(latest: Definition, responses: ExportResponse[]): CsvValue[][] {
  // Lead fields: enabled fields of the latest definition, then any extra keys seen.
  const leadCols: { key: string; label: string }[] = latest.leadForm.fields
    .filter((f) => f.enabled)
    .map((f) => ({ key: f.key, label: f.label || f.key }));
  const leadKeys = new Set(leadCols.map((c) => c.key));
  for (const r of responses) {
    for (const key of Object.keys(r.lead ?? {})) {
      if (leadKeys.has(key)) continue;
      leadKeys.add(key);
      const label = r.definition.leadForm.fields.find((f) => f.key === key)?.label;
      leadCols.push({ key, label: label || key });
    }
  }

  // Categories: latest first, then extras from stored category scores.
  const catCols = latest.categories.map((c) => ({ id: c.id, name: c.name }));
  const catIds = new Set(catCols.map((c) => c.id));
  for (const r of responses) {
    for (const c of r.categoryScores ?? []) {
      if (catIds.has(c.categoryId)) continue;
      catIds.add(c.categoryId);
      catCols.push({ id: c.categoryId, name: c.name });
    }
  }

  // Questions (excluding info screens): latest first, then any from older definitions.
  const questionCols: Question[] = latest.questions.filter((q) => q.type !== "info");
  const qIds = new Set(questionCols.map((q) => q.id));
  for (const r of responses) {
    for (const q of r.definition.questions) {
      if (q.type === "info" || qIds.has(q.id)) continue;
      qIds.add(q.id);
      questionCols.push(q);
    }
  }

  const header: CsvValue[] = [
    "id",
    "started_at",
    "completed_at",
    "is_test",
    ...leadCols.map((c) => c.label),
    "consent",
    "overall_percent",
    "tier",
    ...catCols.map((c) => `${c.name || "Category"} %`),
    ...questionCols.map((q, i) => q.text.trim() || `Question ${i + 1}`),
  ];

  const rows = responses.map((r): CsvValue[] => {
    const tier = r.definition.tiers.find((t) => t.id === r.tierId)?.name ?? "";
    const ownQuestions = new Map(r.definition.questions.map((q) => [q.id, q]));
    return [
      r.id,
      r.startedAt,
      r.completedAt,
      r.isTest,
      ...leadCols.map((c) => r.lead?.[c.key] ?? ""),
      r.consent ? (r.consent.given ? "yes" : "no") : "",
      r.overallPercent,
      tier,
      ...catCols.map((c) => r.categoryScores?.find((s) => s.categoryId === c.id)?.percent ?? null),
      ...questionCols.map((q) => formatAnswer(ownQuestions.get(q.id) ?? q, r.answers?.[q.id])),
    ];
  });

  return [header, ...rows];
}
