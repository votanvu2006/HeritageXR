import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import {
  answerQuizQuestion,
  readQuizProgress,
  quizResult,
  redeemQuizReward,
  startQuizVisit,
} from "../src/quizProgress.ts";
import { questions } from "../src/quizQuestions.ts";

beforeEach(startQuizVisit);

test("a visit starts at zero without consulting old browser points or completion", () => {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      get localStorage() {
        throw new Error("Previous visit storage must not be read");
      },
    },
  });
  assert.deepEqual(readQuizProgress(), { points: 0, answers: {} });
  for (const id of ["drum", "jar", "dagger"] as const)
    assert.equal(quizResult(id, readQuizProgress()).completed, false);
});

test("one correct and two wrong answers complete one quiz at ten points without replay", async () => {
  for (const [index, question] of questions.drum.entries())
    await answerQuizQuestion(
      "drum",
      question.id,
      index === 0
        ? question.answer
        : (question.answer + 1) % question.options.length,
    );
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

test("finishing drum leaves all three jar questions available and scores accumulate in the visit", async () => {
  for (const question of questions.drum)
    await answerQuizQuestion("drum", question.id, question.answer);
  assert.equal(quizResult("jar", readQuizProgress()).answered, 0);
  assert.equal(quizResult("dagger", readQuizProgress()).answered, 0);
  for (const question of questions.jar)
    await answerQuizQuestion("jar", question.id, question.answer);
  assert.equal(readQuizProgress().points, 60);
  assert.equal(quizResult("jar", readQuizProgress()).completed, true);
  assert.equal(quizResult("drum", readQuizProgress()).completed, true);
  assert.equal(quizResult("dagger", readQuizProgress()).completed, false);
});

test("a wrong answer stays final when returning to the quiz during the same visit", async () => {
  const question = questions.jar[0];
  const wrong = (question.answer + 1) % question.options.length;
  await answerQuizQuestion("jar", question.id, wrong);
  await answerQuizQuestion("jar", question.id, question.answer);
  assert.equal(readQuizProgress().answers[question.id], wrong);
  assert.equal(readQuizProgress().points, 0);
});

test("a new visit resets the balance and all three attempts together", async () => {
  for (const id of ["drum", "jar", "dagger"] as const)
    for (const question of questions[id])
      await answerQuizQuestion(id, question.id, question.answer);
  assert.equal(readQuizProgress().points, 90);
  startQuizVisit();
  assert.deepEqual(readQuizProgress(), { points: 0, answers: {} });
  for (const id of ["drum", "jar", "dagger"] as const)
    assert.equal(quizResult(id, readQuizProgress()).completed, false);
  await answerQuizQuestion(
    "drum",
    questions.drum[0].id,
    questions.drum[0].answer,
  );
  assert.equal(readQuizProgress().points, 10);
});

test("a zero-score attempt completes independently of the other exhibits", async () => {
  for (const question of questions.drum)
    await answerQuizQuestion(
      "drum",
      question.id,
      (question.answer + 1) % question.options.length,
    );
  assert.equal(quizResult("drum", readQuizProgress()).completed, true);
  assert.equal(quizResult("jar", readQuizProgress()).completed, false);
  assert.equal(readQuizProgress().points, 0);
});

test("spending points never reopens a completed attempt during the visit", async () => {
  for (const question of questions.jar)
    await answerQuizQuestion("jar", question.id, question.answer);
  assert.equal((await redeemQuizReward()).redeemed, true);
  for (const question of questions.jar)
    await answerQuizQuestion("jar", question.id, question.answer);
  assert.equal(readQuizProgress().points, 0);
  assert.equal(quizResult("jar", readQuizProgress()).completed, true);
  assert.equal((await redeemQuizReward()).redeemed, false);
});

test("duplicate submissions award once and invalid answers leave progress unchanged", async () => {
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
