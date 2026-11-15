import { questions } from "./quizQuestions.ts";
import type { ExhibitId } from "./InteractiveScene";

export type QuizProgress = {
  points: number;
  answers: Readonly<Record<string, number>>;
};

// A visit lasts for this document only. Route/tab changes inside the app retain
// progress; a reload or a newly opened page starts again without browser storage.
let currentProgress: QuizProgress = { points: 0, answers: {} };

export function startQuizVisit(): void {
  currentProgress = { points: 0, answers: {} };
}

export function readQuizProgress(): QuizProgress {
  return currentProgress;
}

export async function answerQuizQuestion(
  exhibitId: ExhibitId,
  questionId: string,
  answer: number,
): Promise<QuizProgress> {
  const question = questions[exhibitId].find((item) => item.id === questionId);
  if (
    !question ||
    !Number.isInteger(answer) ||
    answer < 0 ||
    answer >= question.options.length
  ) {
    throw new Error("Invalid quiz answer");
  }
  // Commit synchronously before resolving, so duplicate taps cannot award twice.
  if (currentProgress.answers[question.id] !== undefined)
    return currentProgress;
  currentProgress = {
    points: currentProgress.points + (answer === question.answer ? 10 : 0),
    answers: { ...currentProgress.answers, [question.id]: answer },
  };
  return currentProgress;
}

export async function redeemQuizReward(): Promise<{
  progress: QuizProgress;
  redeemed: boolean;
}> {
  if (currentProgress.points < 30)
    return { progress: currentProgress, redeemed: false };
  currentProgress = { ...currentProgress, points: currentProgress.points - 30 };
  return { progress: currentProgress, redeemed: true };
}

export function quizResult(exhibitId: ExhibitId, progress: QuizProgress) {
  const exhibitQuestions = questions[exhibitId];
  const answered = exhibitQuestions.filter(
    (question) => progress.answers[question.id] !== undefined,
  ).length;
  const correct = exhibitQuestions.filter(
    (question) => progress.answers[question.id] === question.answer,
  ).length;
  return {
    answered,
    correct,
    earnedPoints: correct * 10,
    completed: answered === exhibitQuestions.length,
  };
}

export function readDemoPoints(): number {
  return currentProgress.points;
}
