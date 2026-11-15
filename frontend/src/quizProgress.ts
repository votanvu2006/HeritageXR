import { questions } from "./quizQuestions.ts";
import type { ExhibitId } from "./InteractiveScene";

export const quizProgressKey = "heritagexr-demo-quiz-daily-v3";
const allQuestions = Object.values(questions).flat();
const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Ho_Chi_Minh",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export type QuizProgress = {
  day: string;
  expiresAt: number;
  points: number;
  answers: Readonly<Record<string, number>>;
};

export function quizDay(now = new Date()): string {
  const parts = dayFormatter.formatToParts(now);
  const value = (type: string) =>
    parts.find((part) => part.type === type)!.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

let cachedProgress: QuizProgress | undefined;
let cachedSerialized: string | null | undefined;
const listeners = new Set<() => void>();
let expiryTimer: number | undefined;

export function readQuizProgress(): QuizProgress {
  const day = quizDay();
  let serialized: string | null = null;
  try {
    serialized =
      typeof window === "undefined"
        ? null
        : window.localStorage.getItem(quizProgressKey);
  } catch {
    /* Reading is still safe when browser storage is unavailable. */
  }
  if (cachedProgress?.day === day && serialized === cachedSerialized)
    return cachedProgress;
  // Vietnam has UTC+7 year-round. Never trust a saved expiry to extend the day.
  const expiresAt = Date.parse(`${day}T00:00:00+07:00`) + 24 * 60 * 60 * 1000;
  const empty: QuizProgress = { day, expiresAt, points: 0, answers: {} };
  cachedProgress = empty;
  cachedSerialized = serialized;
  try {
    const saved: unknown = JSON.parse(serialized ?? "null");
    if (
      saved &&
      typeof saved === "object" &&
      "version" in saved &&
      saved.version === 3 &&
      "day" in saved &&
      saved.day === day &&
      "points" in saved &&
      typeof saved.points === "number" &&
      Number.isSafeInteger(saved.points) &&
      saved.points >= 0 &&
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
      cachedProgress = { day, expiresAt, points: saved.points, answers };
    }
  } catch {
    /* Undated, malformed or expired progress starts a fresh day. */
  }
  return cachedProgress;
}

export function startQuizVisit(): void {
  cachedProgress = undefined;
  cachedSerialized = undefined;
  readQuizProgress();
}

function scheduleExpiry(): void {
  if (typeof window === "undefined" || listeners.size === 0) return;
  window.clearTimeout(expiryTimer);
  if (listeners.size > 0) {
    expiryTimer = window.setTimeout(
      refreshProgress,
      Math.max(1, readQuizProgress().expiresAt - Date.now()),
    );
  }
}

function refreshProgress(): void {
  readQuizProgress();
  for (const listener of listeners) listener();
  scheduleExpiry();
}

function handleStorage(event: StorageEvent): void {
  if (event.key === quizProgressKey || event.key === null) refreshProgress();
}

export function subscribeQuizProgress(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1 && typeof window !== "undefined") {
    window.addEventListener("storage", handleStorage);
    window.addEventListener("focus", refreshProgress);
    window.addEventListener("pageshow", refreshProgress);
    document.addEventListener("visibilitychange", refreshProgress);
    scheduleExpiry();
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && typeof window !== "undefined") {
      window.clearTimeout(expiryTimer);
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("focus", refreshProgress);
      window.removeEventListener("pageshow", refreshProgress);
      document.removeEventListener("visibilitychange", refreshProgress);
    }
  };
}

function saveProgress(progress: QuizProgress): void {
  const serialized = JSON.stringify({ version: 3, ...progress });
  // Commit first answers and balance together before notifying the React views.
  window.localStorage.setItem(quizProgressKey, serialized);
  cachedSerialized = serialized;
  cachedProgress = progress;
  refreshProgress();
}

function withProgressLock<T>(update: () => T): Promise<T> {
  if (typeof navigator !== "undefined" && navigator.locks)
    return navigator.locks.request(quizProgressKey, update);
  return Promise.resolve().then(update);
}

export function answerQuizQuestion(
  exhibitId: ExhibitId,
  questionId: string,
  answer: number,
): Promise<QuizProgress> {
  const requestedDay = quizDay();
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
    if (
      current.day !== requestedDay ||
      current.answers[question.id] !== undefined
    )
      return current;
    const next = {
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
  const requestedDay = quizDay();
  return withProgressLock(() => {
    const current = readQuizProgress();
    if (current.day !== requestedDay || current.points < 30)
      return { progress: current, redeemed: false };
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
