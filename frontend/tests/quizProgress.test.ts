import { beforeEach, afterEach, mock, test } from "node:test";
import assert from "node:assert/strict";
import {
  answerQuizQuestion,
  readQuizProgress,
  quizProgressKey,
  quizDay,
  quizResult,
  redeemQuizReward,
  startQuizVisit,
} from "../src/quizProgress.ts";
import { questions } from "../src/quizQuestions.ts";

class MemoryStorage {
  values = new Map<string, string>();
  failWrites = false;
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    if (this.failWrites) throw new Error("Storage unavailable");
    this.values.set(key, value);
  }
}
let storage: MemoryStorage;
beforeEach(() => {
  // Exercise the fallback here; browser checks cover Web Locks across tabs.
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: {} });
  mock.timers.enable({
    apis: ["Date"],
    now: Date.parse("2026-11-02T03:00:00Z"),
  });
  storage = new MemoryStorage();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { localStorage: storage },
  });
  startQuizVisit();
});
afterEach(() => mock.timers.reset());

test("the museum day changes at midnight in Vietnam, independently of UTC", () => {
  assert.equal(quizDay(new Date("2026-11-02T16:59:59Z")), "2026-11-02");
  assert.equal(quizDay(new Date("2026-11-02T17:00:00Z")), "2026-11-03");
  assert.equal(
    readQuizProgress().expiresAt,
    Date.parse("2026-11-02T17:00:00Z"),
  );
});

test("closing and reopening during the same day preserves the balance and answers", async () => {
  const question = questions.drum[0];
  await answerQuizQuestion("drum", question.id, question.answer);
  startQuizVisit();
  assert.equal(readQuizProgress().points, 10);
  assert.equal(readQuizProgress().answers[question.id], question.answer);
  await answerQuizQuestion("drum", question.id, question.answer);
  assert.equal(readQuizProgress().points, 10);
});

test("one correct and two wrong answers finish at ten points for the whole day", async () => {
  for (const [index, question] of questions.drum.entries())
    await answerQuizQuestion(
      "drum",
      question.id,
      index === 0
        ? question.answer
        : (question.answer + 1) % question.options.length,
    );
  startQuizVisit();
  assert.deepEqual(quizResult("drum", readQuizProgress()), {
    answered: 3,
    correct: 1,
    earnedPoints: 10,
    completed: true,
  });
  for (const question of questions.drum)
    await answerQuizQuestion("drum", question.id, question.answer);
  assert.equal(readQuizProgress().points, 10);
});

test("finishing drum leaves jar and dagger questions available with a shared daily balance", async () => {
  for (const question of questions.drum)
    await answerQuizQuestion("drum", question.id, question.answer);
  assert.equal(quizResult("jar", readQuizProgress()).answered, 0);
  assert.equal(quizResult("dagger", readQuizProgress()).answered, 0);
  for (const question of questions.jar)
    await answerQuizQuestion("jar", question.id, question.answer);
  assert.equal(readQuizProgress().points, 60);
  assert.equal(quizResult("drum", readQuizProgress()).completed, true);
  assert.equal(quizResult("jar", readQuizProgress()).completed, true);
  assert.equal(quizResult("dagger", readQuizProgress()).completed, false);
});

test("midnight expires every point and attempt, even without restarting the application", async () => {
  for (const id of ["drum", "jar", "dagger"] as const)
    for (const question of questions[id])
      await answerQuizQuestion(id, question.id, question.answer);
  assert.equal(readQuizProgress().points, 90);
  mock.timers.setTime(Date.parse("2026-11-02T16:59:59Z"));
  assert.equal(readQuizProgress().points, 90);
  mock.timers.setTime(Date.parse("2026-11-02T17:00:00Z"));
  assert.equal(readQuizProgress().points, 0);
  assert.deepEqual(readQuizProgress().answers, {});
  for (const id of ["drum", "jar", "dagger"] as const)
    assert.equal(quizResult(id, readQuizProgress()).completed, false);
  assert.equal((await redeemQuizReward()).redeemed, false);
  await answerQuizQuestion(
    "drum",
    questions.drum[0].id,
    questions.drum[0].answer,
  );
  assert.equal(readQuizProgress().points, 10);
  startQuizVisit();
  assert.equal(readQuizProgress().points, 10);
});

test("opening on a later day never imports an expired or undated old balance", async () => {
  await answerQuizQuestion("jar", questions.jar[0].id, questions.jar[0].answer);
  storage.setItem("heritagexr-demo-points-v1", "90");
  storage.setItem(
    "heritagexr-demo-quiz-progress-v2",
    JSON.stringify({ version: 2, points: 90, answers: {} }),
  );
  mock.timers.setTime(Date.parse("2026-11-04T03:00:00Z"));
  startQuizVisit();
  assert.equal(readQuizProgress().points, 0);
  assert.deepEqual(readQuizProgress().answers, {});
});

test("spending points never reopens completed quizzes during the day", async () => {
  for (const question of questions.jar)
    await answerQuizQuestion("jar", question.id, question.answer);
  assert.equal((await redeemQuizReward()).redeemed, true);
  startQuizVisit();
  for (const question of questions.jar)
    await answerQuizQuestion("jar", question.id, question.answer);
  assert.equal(readQuizProgress().points, 0);
  assert.equal(quizResult("jar", readQuizProgress()).completed, true);
  assert.equal((await redeemQuizReward()).redeemed, false);
});

test("a zero-score attempt remains completed, while another exhibit is available", async () => {
  for (const question of questions.drum)
    await answerQuizQuestion(
      "drum",
      question.id,
      (question.answer + 1) % question.options.length,
    );
  startQuizVisit();
  assert.equal(quizResult("drum", readQuizProgress()).completed, true);
  assert.equal(quizResult("jar", readQuizProgress()).completed, false);
  assert.equal(readQuizProgress().points, 0);
});

test("duplicate submissions award once and invalid answers leave the balance unchanged", async () => {
  const first = questions.dagger[0];
  await Promise.all(
    Array.from({ length: 5 }, () =>
      answerQuizQuestion("dagger", first.id, first.answer),
    ),
  );
  const progress = readQuizProgress();
  assert.equal(progress.points, 10);
  await assert.rejects(answerQuizQuestion("jar", first.id, first.answer));
  await assert.rejects(answerQuizQuestion("dagger", first.id, 99));
  assert.deepEqual(readQuizProgress(), progress);
});

test("a submission waiting across midnight cannot award its old-day answer on the new day", async () => {
  const question = questions.jar[0];
  mock.timers.setTime(Date.parse("2026-11-02T16:59:59Z"));
  const pending = answerQuizQuestion("jar", question.id, question.answer);
  mock.timers.setTime(Date.parse("2026-11-02T17:00:00Z"));
  await pending;
  assert.equal(readQuizProgress().points, 0);
  assert.deepEqual(readQuizProgress().answers, {});
});

test("a failed save commits neither an answer nor its reward", async () => {
  storage.failWrites = true;
  await assert.rejects(
    answerQuizQuestion("drum", questions.drum[0].id, questions.drum[0].answer),
  );
  assert.equal(readQuizProgress().points, 0);
  assert.deepEqual(readQuizProgress().answers, {});
});

test("malformed daily data is safe and cannot extend expiry with a saved timestamp", async () => {
  storage.setItem(quizProgressKey, "broken json");
  startQuizVisit();
  assert.equal(readQuizProgress().points, 0);
  storage.setItem(
    quizProgressKey,
    JSON.stringify({
      version: 3,
      day: "2026-11-01",
      points: 90,
      answers: {},
      expiresAt: Date.parse("2099-01-01"),
    }),
  );
  startQuizVisit();
  assert.equal(readQuizProgress().points, 0);
});
