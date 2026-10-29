import { useCallback, useEffect, useRef, useState } from "react";
import { useFetcher } from "react-router";
import { isSliceDirty, useBuilderApi, type BuilderDoc, type BuilderSlice } from "./store";

/** Response of the builder save actions (questions.tsx / results.tsx). */
export type BuilderSaveResult = { ok: true } | { ok: false; errors: string[] };

/**
 * Saves every dirty slice of the builder document to the route that owns it:
 * questions + categories → /build/questions, resultPage → /build/results.
 * Each slice uses its own fetcher so both can be saved at once.
 */
export function useBuilderSave(scorecardId: string) {
  const api = useBuilderApi();
  const qf = useFetcher<BuilderSaveResult>({ key: `builder-save-questions:${scorecardId}` });
  const rf = useFetcher<BuilderSaveResult>({ key: `builder-save-results:${scorecardId}` });
  const pending = useRef<Partial<Record<BuilderSlice, BuilderDoc>>>({});
  const [errors, setErrors] = useState<string[]>([]);
  const saving = qf.state !== "idle" || rf.state !== "idle";

  const save = useCallback(() => {
    if (qf.state !== "idle" || rf.state !== "idle") return;
    const s = api.getState();
    setErrors([]);
    const base = `/scorecards/${scorecardId}/build`;
    if (isSliceDirty(s, "questions")) {
      pending.current.questions = s.doc;
      void qf.submit(
        { intent: "save-questions", questions: s.doc.questions, categories: s.doc.categories },
        { method: "post", encType: "application/json", action: `${base}/questions` },
      );
    }
    if (isSliceDirty(s, "results")) {
      pending.current.results = s.doc;
      void rf.submit(
        { intent: "save-results", resultPage: s.doc.resultPage },
        { method: "post", encType: "application/json", action: `${base}/results` },
      );
    }
  }, [api, qf, rf, scorecardId]);

  const settle = useCallback(
    (slice: BuilderSlice, data: BuilderSaveResult | undefined) => {
      const snapshot = pending.current[slice];
      if (!snapshot) return;
      pending.current[slice] = undefined;
      if (data?.ok) {
        api.getState().markSaved(slice, snapshot);
      } else {
        setErrors((e) => [...e, ...(data && !data.ok ? data.errors : ["Something went wrong while saving. Please try again."])]);
      }
    },
    [api],
  );

  useEffect(() => {
    if (qf.state === "idle") settle("questions", qf.data);
  }, [qf.state, qf.data, settle]);

  useEffect(() => {
    if (rf.state === "idle") settle("results", rf.data);
  }, [rf.state, rf.data, settle]);

  return { save, saving, errors, dismissErrors: () => setErrors([]) };
}
