import { useMemo } from "react";
import { createQuestion } from "~/lib/scorecard/defaults";
import type { QuestionType } from "~/lib/scorecard/schema";
import { duplicateQuestion } from "./convert";
import { useBuilderApi } from "./store";

/** Structural question edits (add, duplicate, delete, reorder) that also manage the selection. */
export function useQuestionActions() {
  const api = useBuilderApi();
  return useMemo(() => {
    const move = (fromId: string, toId: string) =>
      api.getState().update((doc) => {
        const from = doc.questions.findIndex((x) => x.id === fromId);
        const to = doc.questions.findIndex((x) => x.id === toId);
        if (from < 0 || to < 0 || from === to) return doc;
        const questions = [...doc.questions];
        const [moved] = questions.splice(from, 1);
        questions.splice(to, 0, moved);
        return { ...doc, questions };
      });

    return {
      /** Adds a question of `type` after the selected one (or at the end) and selects it. */
      add(type: QuestionType) {
        const { selectedQuestionId, update } = api.getState();
        const q = createQuestion(type);
        update((doc) => {
          const idx = doc.questions.findIndex((x) => x.id === selectedQuestionId);
          const questions = [...doc.questions];
          questions.splice(idx < 0 ? questions.length : idx + 1, 0, q);
          return { ...doc, questions };
        });
        api.setState({ selectedQuestionId: q.id, panel: "questions" });
      },

      duplicate(id: string) {
        const { update } = api.getState();
        let copyId: string | null = null;
        update((doc) => {
          const idx = doc.questions.findIndex((x) => x.id === id);
          if (idx < 0) return doc;
          const copy = duplicateQuestion(doc.questions[idx]);
          copyId = copy.id;
          const questions = [...doc.questions];
          questions.splice(idx + 1, 0, copy);
          return { ...doc, questions };
        });
        if (copyId) api.setState({ selectedQuestionId: copyId });
      },

      remove(id: string) {
        const { update, selectedQuestionId, doc } = api.getState();
        const idx = doc.questions.findIndex((x) => x.id === id);
        if (idx < 0) return;
        const neighbour = doc.questions[idx + 1] ?? doc.questions[idx - 1] ?? null;
        update((d) => ({ ...d, questions: d.questions.filter((x) => x.id !== id) }));
        if (selectedQuestionId === id) api.setState({ selectedQuestionId: neighbour?.id ?? null });
      },

      /** Moves a question up (-1) or down (+1); keyboard-accessible alternative to dragging. */
      shift(id: string, delta: -1 | 1) {
        const { questions } = api.getState().doc;
        const idx = questions.findIndex((x) => x.id === id);
        const target = questions[idx + delta];
        if (idx >= 0 && target) move(id, target.id);
      },

      move,
    };
  }, [api]);
}
