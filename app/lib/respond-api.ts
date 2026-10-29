import { z } from "zod";
import { answerSchema, type Answers } from "~/lib/scorecard/schema";

/**
 * Wire protocol of `POST /api/respond` (JSON), shared by the public flow
 * (client) and the resource route (server).
 *
 * Every intent except `start` is authorised by `responseId` + `resultToken`.
 */

const auth = {
  responseId: z.string().min(1).max(64),
  resultToken: z.string().min(1).max(128),
};

export const respondRequestSchema = z.discriminatedUnion("intent", [
  z.object({
    intent: z.literal("start"),
    /** Live: the scorecard slug + the version the page was rendered with. */
    slug: z.string().max(200).optional(),
    versionId: z.string().max(64).optional(),
    /** Preview (signed-in only): the scorecard id; answers the current draft. */
    scorecardId: z.string().max(64).optional(),
    preview: z.boolean().optional(),
    referrer: z.string().max(2000).optional(),
  }),
  z.object({ intent: z.literal("resume"), ...auth }),
  z.object({
    intent: z.literal("lead"),
    ...auth,
    values: z.record(z.string().max(100), z.union([z.string().max(2000), z.boolean(), z.number()])),
    consent: z.boolean().optional(),
  }),
  z.object({
    intent: z.literal("answer"),
    ...auth,
    questionId: z.string().min(1).max(64),
    /** null clears the answer (skipped optional question). */
    answer: answerSchema.nullable(),
  }),
  z.object({
    intent: z.literal("complete"),
    ...auth,
    /** Optional final sync of every answer the client holds (merged before scoring). */
    answers: z.record(z.string().max(64), answerSchema).optional(),
  }),
]);

export type RespondRequest = z.infer<typeof respondRequestSchema>;

export type RespondError = {
  ok: false;
  error: string;
  /** Field/question errors (lead field key or question id → message). */
  errors?: Record<string, string>;
  /** Set when the response is already complete (client can jump to the result). */
  resultPath?: string;
};

export type StartResult = { ok: true; responseId: string; resultToken: string };
export type ResumeResult = {
  ok: true;
  answers: Answers;
  lead: Record<string, string | boolean>;
  leadCaptured: boolean;
  completed: boolean;
  resultPath: string;
};
export type LeadResult = { ok: true };
export type AnswerResult = { ok: true };
export type CompleteResult = { ok: true; resultPath: string };

export type RespondResult = StartResult | ResumeResult | LeadResult | AnswerResult | CompleteResult | RespondError;

/** Relative URL of a public result page. */
export function resultPath(slug: string, resultToken: string): string {
  return `/s/${encodeURIComponent(slug)}/r/${encodeURIComponent(resultToken)}`;
}
