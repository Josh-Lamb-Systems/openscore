import { CirclePlus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { newId } from "~/lib/scorecard/defaults";
import type { Category } from "~/lib/scorecard/schema";
import { isScoredQuestion } from "~/lib/scorecard/schema";
import { useBuilder, useBuilderApi } from "./store";

/** Adds a category and returns its id. */
export function useAddCategory() {
  const api = useBuilderApi();
  return (name: string): string => {
    const category: Category = { id: newId("cat"), name, description: "" };
    api.getState().update((doc) => ({ ...doc, categories: [...doc.categories, category] }));
    return category.id;
  };
}

/** List pane for managing categories: add, rename, delete (unassigns questions). */
export function CategoriesPane() {
  const categories = useBuilder((s) => s.doc.categories);
  const questions = useBuilder((s) => s.doc.questions);
  const update = useBuilder((s) => s.update);
  const addCategory = useAddCategory();
  const [focusId, setFocusId] = useState<string | null>(null);

  const counts = new Map<string, number>();
  for (const q of questions) {
    if (q.categoryId) counts.set(q.categoryId, (counts.get(q.categoryId) ?? 0) + 1);
  }
  const uncategorised = questions.filter((q) => !q.categoryId && isScoredQuestion(q)).length;

  const rename = (id: string, name: string) =>
    update(
      (doc) => ({ ...doc, categories: doc.categories.map((c) => (c.id === id ? { ...c, name } : c)) }),
      { coalesce: `category:${id}` },
    );

  const remove = (id: string) =>
    update((doc) => ({
      ...doc,
      categories: doc.categories.filter((c) => c.id !== id),
      questions: doc.questions.map((q) => (q.categoryId === id ? { ...q, categoryId: null } : q)),
    }));

  return (
    <div className="h-full overflow-y-auto px-3 py-4">
      <h2 className="mb-1 px-1 text-lg text-ink">Categories</h2>
      <p className="mb-4 px-1 text-xs text-gray-600">
        Group questions to score each area separately on the result page.
      </p>
      {categories.length === 0 ? (
        <div className="rounded-md bg-gray-50 px-4 py-5 text-center text-sm text-gray-800">No categories yet</div>
      ) : (
        <ul className="space-y-2">
          {categories.map((c) => (
            <CategoryRow
              key={c.id}
              category={c}
              count={counts.get(c.id) ?? 0}
              autoFocus={focusId === c.id}
              onRename={(name) => rename(c.id, name)}
              onDelete={() => remove(c.id)}
            />
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={() => setFocusId(addCategory(`Category ${categories.length + 1}`))}
        className="mt-3 flex items-center gap-1.5 px-1 text-sm font-medium text-brand-700 hover:text-brand-800 hover:underline"
      >
        <CirclePlus className="size-4" /> Add category
      </button>
      {questions.length > 0 && (
        <p className="mt-6 px-1 text-xs text-gray-500">
          {uncategorised === 0
            ? "Every scored question has a category."
            : `${uncategorised} scored question${uncategorised === 1 ? "" : "s"} without a category (counted in the overall score only).`}
        </p>
      )}
    </div>
  );
}

function CategoryRow({
  category,
  count,
  autoFocus,
  onRename,
  onDelete,
}: {
  category: Category;
  count: number;
  autoFocus: boolean;
  onRename: (name: string) => void;
  onDelete: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (autoFocus) ref.current?.select();
  }, [autoFocus]);
  return (
    <li className="rounded-md border border-gray-200 bg-white p-2">
      <div className="flex items-center gap-1">
        <input
          ref={ref}
          value={category.name}
          onChange={(e) => onRename(e.target.value)}
          aria-label="Category name"
          placeholder="Category name"
          aria-invalid={!category.name.trim() || undefined}
          className="h-8 min-w-0 flex-1 rounded border border-transparent px-2 text-sm text-ink hover:border-gray-200 focus:border-brand-500 focus:outline-none aria-invalid:border-red-400"
        />
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Delete category ${category.name}`}
          title={count > 0 ? `Delete (unassigns ${count} question${count === 1 ? "" : "s"})` : "Delete"}
          className="grid size-7 shrink-0 place-items-center rounded text-gray-500 hover:bg-red-50 hover:text-red-600"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
      <p className="px-2 text-xs text-gray-500">
        {count} question{count === 1 ? "" : "s"}
      </p>
    </li>
  );
}
