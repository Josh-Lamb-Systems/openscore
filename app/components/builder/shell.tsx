import { AlertCircle, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useBlocker, useLocation } from "react-router";
import { Button } from "~/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "~/components/ui/dialog";
import type { Definition } from "~/lib/scorecard/schema";
import { BuilderHeader } from "./header";
import { BuilderStoreProvider, createBuilderStore, isDirty, useBuilder, useBuilderApi } from "./store";
import { useBuilderSave } from "./use-save";

/**
 * Full-screen builder chrome: owns the builder store, the header, save,
 * keyboard shortcuts and the unsaved-changes guard. Children are the
 * question or result page builder.
 */
export function BuilderShell({
  scorecardId,
  name,
  status,
  definition,
  children,
}: {
  scorecardId: string;
  name: string;
  status: "draft" | "live";
  definition: Definition;
  children: React.ReactNode;
}) {
  // One store per mounted builder. Later loader revalidations (after saving)
  // must not overwrite in-progress edits, so the store is only seeded once.
  const [store] = useState(() =>
    createBuilderStore(
      { questions: definition.questions, categories: definition.categories, resultPage: definition.resultPage },
      { selectedTierId: definition.tiers[0]?.id ?? null },
    ),
  );
  return (
    <BuilderStoreProvider value={store}>
      <ShellInner scorecardId={scorecardId} name={name} status={status} tierCount={definition.tiers.length}>
        {children}
      </ShellInner>
    </BuilderStoreProvider>
  );
}

function ShellInner({
  scorecardId,
  name,
  status,
  tierCount,
  children,
}: {
  scorecardId: string;
  name: string;
  status: "draft" | "live";
  tierCount: number;
  children: React.ReactNode;
}) {
  const api = useBuilderApi();
  const location = useLocation();
  const section = location.pathname.endsWith("/results") ? "results" : "questions";
  const { save, saving, errors, dismissErrors } = useBuilderSave(scorecardId);
  const dirty = useBuilder(isDirty);

  useKeyboardShortcuts(save);

  // Warn before closing the tab / reloading with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  // Block in-app navigation out of the builder (switching between the
  // question and result builders keeps edits in memory, so that's allowed).
  const buildPrefix = `/scorecards/${scorecardId}/build`;
  const blocker = useBlocker(
    ({ nextLocation }) => isDirty(api.getState()) && !nextLocation.pathname.startsWith(buildPrefix),
  );
  const [leaveAfterSave, setLeaveAfterSave] = useState(false);

  useEffect(() => {
    if (!leaveAfterSave || saving) return;
    if (errors.length > 0) {
      setLeaveAfterSave(false);
      if (blocker.state === "blocked") blocker.reset();
    } else if (!dirty && blocker.state === "blocked") {
      setLeaveAfterSave(false);
      blocker.proceed();
    }
  }, [leaveAfterSave, saving, errors.length, dirty, blocker]);

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-white">
      <BuilderHeader
        scorecardId={scorecardId}
        name={name}
        status={status}
        section={section}
        tierCount={tierCount}
        onSave={save}
        saving={saving}
      />
      {errors.length > 0 && (
        <div role="alert" className="flex items-start gap-3 border-b border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-800">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <div className="flex-1">
            <p className="font-medium">Your changes couldn't be saved.</p>
            <ul className="mt-0.5 list-disc pl-5">
              {errors.slice(0, 6).map((e, i) => (
                <li key={i}>{e}</li>
              ))}
              {errors.length > 6 && <li>…and {errors.length - 6} more</li>}
            </ul>
          </div>
          <button type="button" onClick={dismissErrors} aria-label="Dismiss" className="rounded p-1 hover:bg-red-100">
            <X className="size-4" />
          </button>
        </div>
      )}
      <div className="flex min-h-0 flex-1">{children}</div>

      <Dialog open={blocker.state === "blocked"} onOpenChange={(o) => !o && blocker.state === "blocked" && blocker.reset()}>
        <DialogContent title="Unsaved changes">
          <DialogBody>
            <p className="text-center text-sm text-gray-700">
              You have changes that haven't been saved. Save them before leaving the builder?
            </p>
          </DialogBody>
          <DialogFooter className="justify-between">
            <Button variant="ghost" onClick={() => blocker.state === "blocked" && blocker.reset()}>
              Stay
            </Button>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => blocker.state === "blocked" && blocker.proceed()}>
                Leave without saving
              </Button>
              <Button
                disabled={saving}
                onClick={() => {
                  setLeaveAfterSave(true);
                  save();
                }}
              >
                {saving ? "Saving…" : "Save and leave"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Ctrl/⌘+S saves; Ctrl/⌘+Z undoes; Shift+Ctrl/⌘+Z or Ctrl/⌘+Y redoes. */
function useKeyboardShortcuts(save: () => void) {
  const api = useBuilderApi();
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key === "s") {
        e.preventDefault();
        if (isDirty(api.getState())) save();
        return;
      }
      if (key !== "z" && key !== "y") return;
      // Rich text editors keep their own fine-grained history.
      const target = e.target as HTMLElement | null;
      if (target?.closest?.(".ProseMirror")) return;
      e.preventDefault();
      if (key === "y" || e.shiftKey) api.getState().redo();
      else api.getState().undo();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [api, save]);
}
