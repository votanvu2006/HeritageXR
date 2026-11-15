import { questions } from "./quizQuestions.ts";
import type { ExhibitId } from "./InteractiveScene";

export const quizProgressKey = "heritagexr-demo-quiz-progress-v2";
const legacyPointsKey = "heritagexr-demo-points-v1";
const legacyEarnedKey = "heritagexr-demo-earned-quiz-v1";
const allQuestions = Object.values(questions).flat();

export type QuizProgress = {
  version: 2;
  points: number;
  answers: Record<string, number>;
};

function validPoints(value: unknown): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : 0;
}

export function readQuizProgress(): QuizProgress {
  const empty: QuizProgress = { version: 2, points: 0, answers: {} };
  if (typeof window === "undefined") return empty;
  try {
    const saved: unknown = JSON.parse(
      window.localStorage.getItem(quizProgressKey) ?? "null",
    );
    if (
      saved &&
      typeof saved === "object" &&
      "version" in saved &&
      saved.version === 2 &&
      "points" in saved &&
      "answers" in saved &&
      saved.answers &&
      typeof saved.answers === "object"
    ) {
      const answers: Record<string, number> = {};
      for (const question of allQuestions) {
        const answer: unknown = (saved.answers as Record<string, unknown>)[
          question.id
        ];
        if (
          typeof answer === "number" &&
          Number.isInteger(answer) &&
          answer >= 0 &&
          answer < question.options.length
        )
          answers[question.id] = answer;
      }
      return { version: 2, points: validPoints(saved.points), answers };
    }
  } catch {
    // Recover the existing demo balance if a previous progress value is invalid.
  }
  try {
    const points = validPoints(
      Number(window.localStorage.getItem(legacyPointsKey) ?? "0"),
    );
    let earned: unknown = [];
    try {
      earned = JSON.parse(window.localStorage.getItem(legacyEarnedKey) ?? "[]");
    } catch {
      /* Preserve the balance even if the old answer list is corrupt. */
    }
    const answers: Record<string, number> = {};
    for (const question of allQuestions) {
      if (Array.isArray(earned) && earned.includes(question.id))
        answers[question.id] = question.answer;
    }
    return { version: 2, points, answers };
  } catch {
    return empty;
  }
}

function saveProgress(progress: QuizProgress): void {
  // Balance and first answers commit together, so a reload cannot award twice.
  window.localStorage.setItem(quizProgressKey, JSON.stringify(progress));
}

function withProgressLock<T>(update: () => T): Promise<T> {
  if (typeof navigator !== "undefined" && navigator.locks) {
    return navigator.locks.request(quizProgressKey, update);
  }
  return Promise.resolve().then(update);
}

export function answerQuizQuestion(
  exhibitId: ExhibitId,
  questionId: string,
  answer: number,
): Promise<QuizProgress> {
  return withProgressLock(() => {
    const question = questions[exhibitId].find(
      (item) => item.id === questionId,
    );
    if (
      !question ||
      !Number.isInteger(answer) ||
      answer < 0 ||
      answer >= question.options.length
    )
      throw new Error("Invalid quiz answer");
    const current = readQuizProgress();
    if (current.answers[question.id] !== undefined) return current;
    const next: QuizProgress = {
      ...current,
      points: current.points + (answer === question.answer ? 10 : 0),
      answers: { ...current.answers, [question.id]: answer },
    };
    saveProgress(next);
    return next;
  });
}

export function redeemQuizReward(): Promise<{
  progress: QuizProgress;
  redeemed: boolean;
}> {
  return withProgressLock(() => {
    const current = readQuizProgress();
    if (current.points < 30) return { progress: current, redeemed: false };
    const progress = { ...current, points: current.points - 30 };
    saveProgress(progress);
    return { progress, redeemed: true };
  });
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
  return readQuizProgress().points;
}
