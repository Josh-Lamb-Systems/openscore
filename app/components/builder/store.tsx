import { createContext, useContext } from "react";
import { createStore, useStore, type StoreApi } from "zustand";
import type { Category, Question, ResultPage } from "~/lib/scorecard/schema";

/**
 * Builder state shared by the full-screen builder header (save, undo/redo,
 * device toggle) and the question/result page builders below it.
 *
 * The editable document holds only the parts of the draft definition the
 * builders own. Updates are immutable, so "dirty" is a cheap reference check
 * against the last saved snapshot, and undoing back to the saved state is
 * clean again.
 */

export interface BuilderDoc {
  questions: Question[];
  categories: Category[];
  resultPage: ResultPage;
}

/** Each slice is saved by its own route action. */
export type BuilderSlice = "questions" | "results";

export type DeviceMode = "desktop" | "mobile";
export type QuestionPanel = "questions" | "add" | "categories";

const HISTORY_LIMIT = 200;
/** Consecutive updates with the same coalesce key within this window share one undo step. */
const COALESCE_MS = 1200;

export interface BuilderState {
  doc: BuilderDoc;
  saved: BuilderDoc;
  past: BuilderDoc[];
  future: BuilderDoc[];
  lastEdit: { key: string; at: number } | null;

  device: DeviceMode;
  panel: QuestionPanel;
  selectedQuestionId: string | null;
  selectedTierId: string | null;

  /**
   * Applies an immutable update to the document and records an undo step.
   * Pass `coalesce` (e.g. "text:q_123") so typing produces one undo step.
   */
  update: (recipe: (doc: BuilderDoc) => BuilderDoc, opts?: { coalesce?: string }) => void;
  undo: () => void;
  redo: () => void;
  markSaved: (slice: BuilderSlice, snapshot: BuilderDoc) => void;

  setDevice: (device: DeviceMode) => void;
  setPanel: (panel: QuestionPanel) => void;
  selectQuestion: (id: string | null) => void;
  selectTier: (id: string | null) => void;
}

export function createBuilderStore(initial: BuilderDoc, opts: { selectedTierId?: string | null } = {}) {
  return createStore<BuilderState>()((set, get) => ({
    doc: initial,
    saved: initial,
    past: [],
    future: [],
    lastEdit: null,

    device: "desktop",
    panel: "questions",
    selectedQuestionId: initial.questions[0]?.id ?? null,
    selectedTierId: opts.selectedTierId ?? null,

    update: (recipe, { coalesce } = {}) => {
      const { doc, past, lastEdit } = get();
      const next = recipe(doc);
      if (next === doc) return;
      const now = Date.now();
      const merge = !!coalesce && lastEdit?.key === coalesce && now - lastEdit.at < COALESCE_MS && past.length > 0;
      set({
        doc: next,
        past: merge ? past : [...past, doc].slice(-HISTORY_LIMIT),
        future: [],
        lastEdit: coalesce ? { key: coalesce, at: now } : null,
      });
    },

    undo: () => {
      const { doc, past, future } = get();
      const prev = past[past.length - 1];
      if (!prev) return;
      set({ doc: prev, past: past.slice(0, -1), future: [doc, ...future], lastEdit: null });
      get().selectQuestion(get().selectedQuestionId);
    },

    redo: () => {
      const { doc, past, future } = get();
      const next = future[0];
      if (!next) return;
      set({ doc: next, past: [...past, doc], future: future.slice(1), lastEdit: null });
      get().selectQuestion(get().selectedQuestionId);
    },

    markSaved: (slice, snapshot) => {
      const saved = get().saved;
      set({
        saved:
          slice === "questions"
            ? { ...saved, questions: snapshot.questions, categories: snapshot.categories }
            : { ...saved, resultPage: snapshot.resultPage },
        // A new edit after saving should start its own undo step.
        lastEdit: null,
      });
    },

    setDevice: (device) => set({ device }),
    setPanel: (panel) => set({ panel }),
    selectQuestion: (id) => {
      const { questions } = get().doc;
      // Keep the selection valid (e.g. after undoing an "add question").
      const valid = id && questions.some((q) => q.id === id) ? id : (questions[0]?.id ?? null);
      if (valid !== get().selectedQuestionId) set({ selectedQuestionId: valid });
    },
    selectTier: (id) => set({ selectedTierId: id }),
  }));
}

export type BuilderStore = StoreApi<BuilderState>;

const BuilderStoreContext = createContext<BuilderStore | null>(null);
export const BuilderStoreProvider = BuilderStoreContext.Provider;

export function useBuilderApi(): BuilderStore {
  const store = useContext(BuilderStoreContext);
  if (!store) throw new Error("useBuilder must be used inside <BuilderStoreProvider>");
  return store;
}

export function useBuilder<T>(selector: (s: BuilderState) => T): T {
  return useStore(useBuilderApi(), selector);
}

export function isSliceDirty(s: Pick<BuilderState, "doc" | "saved">, slice: BuilderSlice): boolean {
  return slice === "questions"
    ? s.doc.questions !== s.saved.questions || s.doc.categories !== s.saved.categories
    : s.doc.resultPage !== s.saved.resultPage;
}

export function isDirty(s: Pick<BuilderState, "doc" | "saved">): boolean {
  return isSliceDirty(s, "questions") || isSliceDirty(s, "results");
}

// ---------------------------------------------------------------------------
// Document helpers (pure)
// ---------------------------------------------------------------------------

export function replaceQuestion(doc: BuilderDoc, id: string, fn: (q: Question) => Question): BuilderDoc {
  let changed = false;
  const questions = doc.questions.map((q) => {
    if (q.id !== id) return q;
    const next = fn(q);
    if (next !== q) changed = true;
    return next;
  });
  return changed ? { ...doc, questions } : doc;
}

/** Hook returning a patcher for one question, typed by its current shape. */
export function useQuestionPatch() {
  const update = useBuilder((s) => s.update);
  return <Q extends Question>(q: Q, patch: Partial<Q>, coalesce?: string) =>
    update(
      (doc) => replaceQuestion(doc, q.id, (cur) => ({ ...cur, ...patch }) as Question),
      coalesce ? { coalesce: `${q.id}:${coalesce}` } : undefined,
    );
}
