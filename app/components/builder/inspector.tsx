import { CircleAlert } from "lucide-react";
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import type { Question } from "~/lib/scorecard/schema";
import { AnswersTab } from "./answers-tab";
import { QuestionTab } from "./question-tab";

const ANSWER_ERRORS = /^(Add at least two answers|Every answer needs|Every image answer needs)/;

/** Right-hand inspector (~255px+) with QUESTION / ANSWERS tabs. */
export function QuestionInspector({ question, errors }: { question: Question; errors: string[] }) {
  const [tab, setTab] = useState("question");
  const answerErrors = errors.filter((e) => ANSWER_ERRORS.test(e));
  const questionErrors = errors.filter((e) => !ANSWER_ERRORS.test(e));

  return (
    <aside aria-label="Question settings" className="flex w-[280px] shrink-0 flex-col border-l border-gray-200 bg-white">
      <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
        <TabsList className="shrink-0 px-4 pt-4">
          <TabsTrigger value="question" className="flex items-center gap-1">
            Question
            {questionErrors.length > 0 && <CircleAlert aria-label="Has problems" className="size-3.5 text-red-600" />}
          </TabsTrigger>
          <TabsTrigger value="answers" className="flex items-center gap-1">
            Answers
            {answerErrors.length > 0 && <CircleAlert aria-label="Has problems" className="size-3.5 text-red-600" />}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="question" className="min-h-0 flex-1 overflow-y-auto">
          <QuestionTab question={question} errors={questionErrors} />
        </TabsContent>
        <TabsContent value="answers" className="min-h-0 flex-1 overflow-y-auto">
          <AnswersTab question={question} errors={answerErrors} />
        </TabsContent>
      </Tabs>
    </aside>
  );
}
