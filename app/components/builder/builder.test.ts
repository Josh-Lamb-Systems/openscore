import { describe, expect, it } from "vitest";
import { createDefaultDefinition, createQuestion } from "~/lib/scorecard/defaults";
import { convertQuestion, duplicateQuestion } from "./convert";
import { createBuilderStore, isDirty, isSliceDirty, replaceQuestion, type BuilderDoc } from "./store";

function initialDoc(): BuilderDoc {
  const def = createDefaultDefinition("Test");
  return { questions: [createQuestion("yes_no")], categories: [], resultPage: def.resultPage };
}

describe("builder store", () => {
  it("tracks dirty state by reference and is clean again after undo", () => {
    const store = createBuilderStore(initialDoc());
    const id = store.getState().doc.questions[0].id;
    expect(isDirty(store.getState())).toBe(false);

    store.getState().update((d) => replaceQuestion(d, id, (q) => ({ ...q, text: "Hello" })));
    expect(isSliceDirty(store.getState(), "questions")).toBe(true);
    expect(isSliceDirty(store.getState(), "results")).toBe(false);

    store.getState().undo();
    expect(isDirty(store.getState())).toBe(false);
    store.getState().redo();
    expect(store.getState().doc.questions[0].text).toBe("Hello");
  });

  it("coalesces consecutive edits with the same key into one undo step", () => {
    const store = createBuilderStore(initialDoc());
    const id = store.getState().doc.questions[0].id;
    for (const text of ["H", "He", "Hel"]) {
      store.getState().update((d) => replaceQuestion(d, id, (q) => ({ ...q, text })), { coalesce: "text" });
    }
    expect(store.getState().past).toHaveLength(1);
    store.getState().undo();
    expect(store.getState().doc.questions[0].text).toBe("");
  });

  it("marks only the saved slice clean", () => {
    const store = createBuilderStore(initialDoc());
    const id = store.getState().doc.questions[0].id;
    store.getState().update((d) => ({
      ...replaceQuestion(d, id, (q) => ({ ...q, text: "Q" })),
      resultPage: { ...d.resultPage, headline: "Hi" },
    }));
    store.getState().markSaved("questions", store.getState().doc);
    expect(isSliceDirty(store.getState(), "questions")).toBe(false);
    expect(isSliceDirty(store.getState(), "results")).toBe(true);
  });
});

describe("convertQuestion", () => {
  it("keeps identity and common fields", () => {
    const q = { ...createQuestion("yes_no"), text: "Ready?", required: false, categoryId: "cat_1" };
    const next = convertQuestion(q, "linear_scale");
    expect(next).toMatchObject({ id: q.id, text: "Ready?", required: false, categoryId: "cat_1", type: "linear_scale" });
  });

  it("carries options between free-form choice types", () => {
    const q = createQuestion("choice_buttons");
    const next = convertQuestion(q, "choice_checkbox");
    expect(next.type === "choice_checkbox" && next.options.map((o) => o.id)).toEqual(
      q.type === "choice_buttons" && q.options.map((o) => o.id),
    );
  });

  it("duplicates with fresh ids", () => {
    const q = createQuestion("choice_radio");
    const copy = duplicateQuestion(q);
    expect(copy.id).not.toBe(q.id);
    if (copy.type === "choice_radio" && q.type === "choice_radio") {
      expect(copy.options[0].id).not.toBe(q.options[0].id);
      expect(copy.options[0].label).toBe(q.options[0].label);
    }
  });
});
