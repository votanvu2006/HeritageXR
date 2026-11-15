import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import {
  answerQuizQuestion,
  readQuizProgress,
  quizProgressKey,
  quizResult,
  redeemQuizReward,
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
  storage = new MemoryStorage();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { localStorage: storage },
  });
});

test("one correct and two wrong answers complete the quiz at ten points; replay cannot improve it", async () => {
  for (const [index, question] of questions.drum.entries()) {
    await answerQuizQuestion(
      "drum",
      question.id,
      index === 0
        ? question.answer
        : (question.answer + 1) % question.options.length,
    );
  }
  const first = readQuizProgress();
  assert.deepEqual(quizResult("drum", first), {
    answered: 3,
    correct: 1,
    earnedPoints: 10,
    completed: true,
  });
  for (const question of questions.drum)
    await answerQuizQuestion("drum", question.id, question.answer);
  assert.deepEqual(readQuizProgress(), first);
});

test("a wrong first answer survives reopening and cannot be replaced with a correct one", async () => {
  const question = questions.jar[0];
  const wrong = (question.answer + 1) % question.options.length;
  await answerQuizQuestion("jar", question.id, wrong);
  const reopened = JSON.parse(storage.getItem(quizProgressKey)!);
  assert.equal(reopened.answers[question.id], wrong);
  await answerQuizQuestion("jar", question.id, question.answer);
  assert.equal(readQuizProgress().answers[question.id], wrong);
  assert.equal(readQuizProgress().points, 0);
  assert.equal(quizResult("jar", readQuizProgress()).completed, false);
});

test("zero-score completion is still final, while another exhibit has its own attempt", async () => {
  for (const question of questions.drum)
    await answerQuizQuestion(
      "drum",
      question.id,
      (question.answer + 1) % question.options.length,
    );
  assert.equal(quizResult("drum", readQuizProgress()).completed, true);
  assert.equal(quizResult("jar", readQuizProgress()).completed, false);
  await answerQuizQuestion("jar", questions.jar[0].id, questions.jar[0].answer);
  assert.equal(readQuizProgress().points, 10);
});

test("old earned questions and the existing balance migrate without a second award", async () => {
  storage.setItem("heritagexr-demo-points-v1", "10");
  storage.setItem(
    "heritagexr-demo-earned-quiz-v1",
    JSON.stringify([questions.drum[0].id]),
  );
  assert.equal(readQuizProgress().points, 10);
  await answerQuizQuestion(
    "drum",
    questions.drum[0].id,
    questions.drum[0].answer,
  );
  assert.equal(readQuizProgress().points, 10);
  for (const question of questions.drum.slice(1))
    await answerQuizQuestion(
      "drum",
      question.id,
      (question.answer + 1) % question.options.length,
    );
  assert.equal(quizResult("drum", readQuizProgress()).earnedPoints, 10);
  assert.equal(quizResult("drum", readQuizProgress()).completed, true);
});

test("redeeming a reward does not reopen the completed quiz or regenerate spent points", async () => {
  for (const question of questions.jar)
    await answerQuizQuestion("jar", question.id, question.answer);
  const redeemed = await redeemQuizReward();
  assert.equal(redeemed.redeemed, true);
  assert.equal(redeemed.progress.points, 0);
  for (const question of questions.jar)
    await answerQuizQuestion("jar", question.id, question.answer);
  assert.equal(readQuizProgress().points, 0);
  assert.equal(quizResult("jar", readQuizProgress()).completed, true);
  assert.equal((await redeemQuizReward()).redeemed, false);
});

test("duplicate submissions award only once, while different questions accumulate", async () => {
  const first = questions.dagger[0];
  await Promise.all(
    Array.from({ length: 5 }, () =>
      answerQuizQuestion("dagger", first.id, first.answer),
    ),
  );
  assert.equal(readQuizProgress().points, 10);
  await Promise.all(
    questions.dagger
      .slice(1)
      .map((question) =>
        answerQuizQuestion("dagger", question.id, question.answer),
      ),
  );
  assert.equal(readQuizProgress().points, 30);
  assert.equal(quizResult("dagger", readQuizProgress()).completed, true);
});

test("a failed save commits neither an answer nor its points", async () => {
  storage.failWrites = true;
  await assert.rejects(
    answerQuizQuestion("drum", questions.drum[0].id, questions.drum[0].answer),
  );
  assert.equal(readQuizProgress().points, 0);
  assert.deepEqual(readQuizProgress().answers, {});
});

test("malformed saved progress recovers the old balance and rejects invalid answer values", () => {
  storage.setItem("heritagexr-demo-points-v1", "20");
  storage.setItem(quizProgressKey, "broken json");
  assert.equal(readQuizProgress().points, 20);
  storage.setItem(
    quizProgressKey,
    JSON.stringify({
      version: 2,
      points: 20,
      answers: { [questions.drum[0].id]: 999, unknown: 0 },
    }),
  );
  assert.equal(readQuizProgress().points, 20);
  assert.deepEqual(readQuizProgress().answers, {});
});
