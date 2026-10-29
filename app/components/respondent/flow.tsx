import { ChevronLeft, LoaderCircle } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import type { CompleteResult, ResumeResult, StartResult } from "~/lib/respond-api";
import { respondentStrings as t } from "~/lib/respondent-strings";
import { firstIncompleteIndex, progressPercent } from "~/lib/scorecard/flow";
import { validateLead } from "~/lib/scorecard/lead";
import type { Answer, Answers, Definition } from "~/lib/scorecard/schema";
import { validateAnswer } from "~/lib/scorecard/validate";
import type { BrandTokens } from "~/lib/theme";
import { clearSession, readSession, respond, writeSession } from "./api-client";
import { postEmbedStep } from "./embed";
import { ProgressBar, ThemedButton } from "./frame";
import { LeadForm, type LeadFormValues } from "./lead-form";
import { QuestionView } from "./question-view";
import { RespondentShell } from "./shell";
import { StartScreen } from "./start-screen";

type Step = "start" | "questions" | "lead" | "finishing";

/** How `start` identifies the scorecard: a live slug + version, or a draft preview. */
export type StartTarget = { slug: string; versionId: string } | { scorecardId: string; preview: true };

export interface ScorecardFlowProps {
  definition: Definition;
  theme: BrandTokens;
  target: StartTarget;
  /** localStorage key for resuming; unique per scorecard + version (or draft revision). */
  storageKey: string;
  embed?: boolean;
  banner?: React.ReactNode;
}

const AUTO_ADVANCE_MS = 180;

/**
 * The public respondent flow (docs/SPEC.md §7): start screen (with the lead form
 * when it comes first) → one question per screen → lead gate (when it comes
 * last) → result page. Progress is saved server-side per answer.
 */
export function ScorecardFlow({ definition, theme, target, storageKey, embed = false, banner }: ScorecardFlowProps) {
  const navigate = useNavigate();
  const { questions, leadForm } = definition;
  const leadBefore = leadForm.enabled && leadForm.position === "before";
  const leadAfter = leadForm.enabled && leadForm.position === "after";

  const [step, setStep] = useState<Step>("start");
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [questionError, setQuestionError] = useState<string | null>(null);
  const [leadValues, setLeadValues] = useState<LeadFormValues>({});
  const [consent, setConsent] = useState(false);
  const [leadErrors, setLeadErrors] = useState<Record<string, string>>({});
  const [leadCaptured, setLeadCaptured] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resuming, setResuming] = useState(false);

  const session = useRef<{ responseId: string; resultToken: string } | null>(null);
  /** Mirrors `answers` synchronously so completion (run from timeouts) sees the latest answer. */
  const answersRef = useRef<Answers>({});
  const saveQueue = useRef<Promise<unknown>>(Promise.resolve());
  const advancing = useRef(false);
  const mainRef = useRef<HTMLElement>(null);
  const mounted = useRef(false);

  // ---- Resume a stored session on load -------------------------------------
  useEffect(() => {
    const stored = readSession(storageKey);
    if (!stored) return;
    setResuming(true);
    void respond<ResumeResult>({ intent: "resume", responseId: stored.responseId, resultToken: stored.resultToken }).then(
      (res) => {
        setResuming(false);
        if (!res.ok || !("completed" in res) || res.completed) {
          clearSession(storageKey);
          return;
        }
        session.current = { responseId: stored.responseId, resultToken: stored.resultToken };
        answersRef.current = res.answers;
        setAnswers(res.answers);
        setLeadCaptured(res.leadCaptured);
        setLeadValues(res.lead);
        if (leadBefore && !res.leadCaptured) return; // still on the start screen
        const next = firstIncompleteIndex(definition, res.answers);
        if (next >= questions.length && leadAfter && !res.leadCaptured) {
          setStep("lead");
        } else if (questions.length > 0) {
          setIndex(Math.max(0, Math.min(stored.index ?? 0, next, questions.length - 1)));
          setStep("questions");
        }
      },
    );
    // Only on mount: the definition/storage key are fixed for this page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Persist position; move focus + scroll on screen changes --------------
  useEffect(() => {
    if (session.current && (step === "questions" || step === "lead")) {
      writeSession(storageKey, { ...session.current, step, index });
    }
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    mainRef.current?.focus({ preventScroll: true });
    if (embed) postEmbedStep();
    else window.scrollTo({ top: 0 });
  }, [step, index, storageKey, embed]);

  const ensureSession = useCallback(async (): Promise<boolean> => {
    if (session.current) return true;
    const res = await respond<StartResult>({
      intent: "start",
      ...target,
      referrer: typeof document !== "undefined" ? document.referrer : undefined,
    });
    if (!res.ok || !("responseId" in res)) {
      setError(res.ok ? t.somethingWentWrong : res.error);
      return false;
    }
    session.current = { responseId: res.responseId, resultToken: res.resultToken };
    writeSession(storageKey, { ...session.current, step: "questions", index: 0 });
    return true;
  }, [target, storageKey]);

  const goToFirstQuestion = (from = 0) => {
    if (questions.length === 0) return void finish(leadCaptured);
    setIndex(Math.min(from, questions.length - 1));
    setStep("questions");
  };

  // ---- Completion ------------------------------------------------------------
  const complete = async () => {
    const s = session.current;
    if (!s) return;
    setStep("finishing");
    setError(null);
    await saveQueue.current;
    const res = await respond<CompleteResult>({ intent: "complete", ...s, answers: answersRef.current });
    if (res.ok && "resultPath" in res) {
      clearSession(storageKey);
      navigate(embed ? `${res.resultPath}?embed=1` : res.resultPath);
      return;
    }
    if (!res.ok && res.resultPath) {
      clearSession(storageKey);
      navigate(embed ? `${res.resultPath}?embed=1` : res.resultPath);
      return;
    }
    const errors = res.ok ? {} : (res.errors ?? {});
    if (errors.lead) {
      setStep(leadBefore ? "start" : "lead");
      return;
    }
    const bad = questions.findIndex((q) => errors[q.id]);
    if (bad >= 0) {
      setIndex(bad);
      setQuestionError(errors[questions[bad].id]);
      setStep("questions");
      return;
    }
    setError(res.ok ? t.somethingWentWrong : res.error);
  };

  const finish = (captured: boolean) => {
    if (leadAfter && !captured) setStep("lead");
    else void complete();
  };

  // ---- Start screen / lead form -------------------------------------------
  const onStart = async () => {
    setBusy(true);
    setError(null);
    const ok = await ensureSession();
    setBusy(false);
    if (ok) goToFirstQuestion();
  };

  const onLeadSubmit = async () => {
    const local = validateLead(leadForm, { values: leadValues, consent });
    if (!local.ok) {
      setLeadErrors(local.errors);
      return;
    }
    setLeadErrors({});
    setError(null);
    setBusy(true);
    if (!(await ensureSession())) return setBusy(false);
    const res = await respond({ intent: "lead", ...session.current!, values: leadValues, consent });
    setBusy(false);
    if (!res.ok) {
      if (res.resultPath) return void navigate(embed ? `${res.resultPath}?embed=1` : res.resultPath);
      if (res.errors) setLeadErrors(res.errors);
      setError(res.errors ? null : res.error);
      return;
    }
    setLeadCaptured(true);
    if (leadBefore) goToFirstQuestion(firstIncompleteIndex(definition, answersRef.current));
    else void complete();
  };

  // ---- Questions -------------------------------------------------------------
  const question = questions[index];

  const setAnswer = (answer: Answer | undefined) => {
    setQuestionError(null);
    const next = { ...answersRef.current };
    if (answer === undefined) delete next[question.id];
    else next[question.id] = answer;
    answersRef.current = next;
    setAnswers(next);
  };

  const onNext = (answer: Answer | undefined) => {
    if (advancing.current || !question) return;
    if (question.type !== "info") {
      const err = validateAnswer(question, answer);
      if (err) {
        setQuestionError(err);
        return;
      }
      setAnswer(answer);
      const s = session.current;
      if (s) {
        const questionId = question.id;
        saveQueue.current = saveQueue.current.then(() =>
          respond({ intent: "answer", ...s, questionId, answer: answer ?? null }),
        );
      }
    }
    advancing.current = true;
    const autoAdvance =
      question.type === "yes_no" ||
      question.type === "choice_buttons" ||
      question.type === "divided_scale" ||
      (question.type === "image_buttons" && !question.multiSelect);
    window.setTimeout(
      () => {
        advancing.current = false;
        setQuestionError(null);
        if (index + 1 < questions.length) setIndex(index + 1);
        else finish(leadCaptured);
      },
      autoAdvance ? AUTO_ADVANCE_MS : 0,
    );
  };

  const onBack = () => {
    setQuestionError(null);
    setError(null);
    if (step === "lead") {
      setIndex(Math.max(0, questions.length - 1));
      setStep(questions.length > 0 ? "questions" : "start");
    } else if (index > 0) setIndex(index - 1);
    else if (!leadCaptured || !leadBefore) setStep("start");
  };

  // ---- Render ----------------------------------------------------------------
  const leadFormEl = (position: "before" | "after") => (
    <LeadForm
      form={leadForm}
      values={leadValues}
      onChange={(v) => {
        setLeadValues(v);
        if (Object.keys(leadErrors).length) setLeadErrors({});
      }}
      consent={consent}
      onConsentChange={setConsent}
      errors={leadErrors}
      formError={error}
      submitting={busy}
      title={position === "before" ? leadForm.title : undefined}
      submitLabel={
        position === "after" && (!leadForm.submitLabel || leadForm.submitLabel === t.start)
          ? t.submit
          : leadForm.submitLabel || t.start
      }
      onSubmit={onLeadSubmit}
    />
  );

  const canGoBack = step === "lead" ? questions.length > 0 : index > 0 || !(leadBefore && leadCaptured);
  const footer =
    step === "questions" || step === "lead" ? (
      <footer className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 bg-[color-mix(in_srgb,var(--os-text)_4%,var(--os-surface))] px-4 py-4 sm:px-8">
        <div>
          {canGoBack && (
            <button
              type="button"
              onClick={onBack}
              className="inline-flex min-h-11 items-center gap-1 rounded-[var(--os-radius)] px-3 text-base font-medium opacity-80 hover:opacity-100 focus-visible:outline-2 focus-visible:outline-[var(--os-primary)]"
            >
              <ChevronLeft aria-hidden className="size-5" />
              {t.back}
            </button>
          )}
        </div>
        <ProgressBar percent={step === "lead" ? 100 : progressPercent(questions, index)} />
        <div />
      </footer>
    ) : null;

  let content: React.ReactNode;
  if (resuming) {
    content = <Spinner label="" />;
  } else if (step === "start") {
    content = (
      <StartScreen
        startScreen={definition.startScreen}
        leadForm={leadBefore ? leadFormEl("before") : undefined}
        onStart={onStart}
        starting={busy}
        error={error}
      />
    );
  } else if (step === "questions" && question) {
    content = (
      <div className="w-full max-w-3xl" key={question.id}>
        <QuestionView
          question={question}
          value={answers[question.id]}
          onChange={setAnswer}
          onNext={onNext}
          error={questionError}
          shuffleSeed={session.current?.responseId}
        />
      </div>
    );
  } else if (step === "lead") {
    content = (
      <div className="w-full max-w-xl">
        <h2 className="mb-6 text-3xl font-medium leading-tight md:text-4xl">
          {leadForm.title && leadForm.title !== "Enter your details below to start the scorecard" ? leadForm.title : t.leadAfterTitle}
        </h2>
        {leadFormEl("after")}
      </div>
    );
  } else {
    content = error ? (
      <div className="mx-auto max-w-md text-center" role="alert">
        <p className="text-lg font-medium">{error}</p>
        <ThemedButton className="mt-6" onClick={() => void complete()}>
          {t.tryAgain}
        </ThemedButton>
      </div>
    ) : (
      <Spinner label={t.loading} />
    );
  }

  return (
    <RespondentShell theme={theme} embed={embed} banner={banner} footer={footer} mainRef={mainRef}>
      {content}
    </RespondentShell>
  );
}

function Spinner({ label }: { label: string }) {
  return (
    <div className="mx-auto flex flex-col items-center gap-4 text-center" role="status" aria-live="polite">
      <LoaderCircle aria-hidden className="size-10 animate-spin text-[var(--os-primary)]" />
      {label && <p className="text-lg opacity-80">{label}</p>}
    </div>
  );
}
