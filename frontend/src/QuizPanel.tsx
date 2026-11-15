import { useState, useSyncExternalStore } from "react";
import type { ExhibitId } from "./InteractiveScene";
import { exhibitNames, questions } from "./quizQuestions";
import {
  answerQuizQuestion,
  quizResult,
  readQuizProgress,
  redeemQuizReward,
  subscribeQuizProgress,
} from "./quizProgress";
import "./QuizPanel.css";

type QuizPanelProps = {
  exhibitId: ExhibitId;
};

export function QuizPanel({ exhibitId }: QuizPanelProps) {
  const exhibitQuestions = questions[exhibitId];
  const progress = useSyncExternalStore(
    subscribeQuizProgress,
    readQuizProgress,
  );
  const points = progress.points;
  const expiryDate = new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(progress.expiresAt));
  const [questionIndex, setQuestionIndex] = useState(() =>
    Math.max(
      0,
      exhibitQuestions.findIndex(
        (question) => progress.answers[question.id] === undefined,
      ),
    ),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [rewardCode, setRewardCode] = useState("");
  const result = quizResult(exhibitId, progress);
  const question = exhibitQuestions[questionIndex];
  const selectedAnswer = progress.answers[question.id] ?? null;
  const isCorrect = selectedAnswer === question.answer;

  const handleAnswer = async (answerIndex: number) => {
    if (selectedAnswer !== null || isSaving || result.completed) return;
    setIsSaving(true);
    setSaveError("");
    try {
      await answerQuizQuestion(exhibitId, question.id, answerIndex);
    } catch {
      setSaveError("Chưa ghi nhận được câu trả lời. Bạn hãy thử lại.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleNext = () => {
    if (selectedAnswer === null || isSaving) return;
    const remaining = exhibitQuestions.findIndex(
      (item) => progress.answers[item.id] === undefined,
    );
    if (remaining !== -1) setQuestionIndex(remaining);
  };

  const handleRedeem = async () => {
    if (isSaving) return;
    setIsSaving(true);
    setSaveError("");
    try {
      const { redeemed } = await redeemQuizReward();
      if (redeemed)
        setRewardCode(
          `HX-DEMO-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
        );
    } catch {
      setSaveError("Chưa ghi nhận được lượt đổi quà. Bạn hãy thử lại.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section
      className="quiz-panel"
      aria-label={`Đố vui về ${exhibitNames[exhibitId]}`}
      aria-busy={isSaving}
    >
      <div className="quiz-panel-heading">
        <div>
          <span className="section-label">THỬ THÁCH KIẾN THỨC</span>
          <h2>
            {result.completed
              ? "Đã hoàn thành đố vui"
              : "Bạn nhớ được bao nhiêu?"}
          </h2>
        </div>
        <span className="quiz-points-chip">✦ {points} điểm</span>
      </div>

      {result.completed ? (
        <div className="quiz-completed" role="status">
          <h3>
            Kết quả của bạn: {result.correct}/{exhibitQuestions.length} câu đúng
          </h3>
          <p>
            Bạn nhận được <strong>{result.earnedPoints} điểm</strong> từ lượt
            chơi này.
          </p>
          <p>
            Bạn đã hoàn thành lượt chơi của {exhibitNames[exhibitId]}. Mỗi hiện
            vật được tham gia đố vui một lần trong ngày.
          </p>
        </div>
      ) : (
        <>
          <p className="quiz-progress">
            CÂU {String(questionIndex + 1).padStart(2, "0")} /{" "}
            {String(exhibitQuestions.length).padStart(2, "0")}
          </p>
          <h3 className="quiz-question">{question.question}</h3>
          <div className="quiz-options">
            {question.options.map((option, index) => {
              const isAnswer =
                selectedAnswer !== null && index === question.answer;
              const isWrong =
                selectedAnswer === index && index !== question.answer;
              return (
                <button
                  className={`quiz-option ${isAnswer ? "is-correct" : ""} ${isWrong ? "is-wrong" : ""}`}
                  key={option}
                  type="button"
                  disabled={selectedAnswer !== null || isSaving}
                  onClick={() => void handleAnswer(index)}
                >
                  <span>{String.fromCharCode(65 + index)}</span>
                  {option}
                </button>
              );
            })}
          </div>
          {selectedAnswer !== null && (
            <>
              <div
                className={`quiz-feedback ${isCorrect ? "is-correct" : "is-wrong"}`}
                role="status"
              >
                <strong>
                  {isCorrect
                    ? "Chính xác! Câu này được tính 10 điểm."
                    : "Chưa đúng rồi."}
                </strong>
                <p>{question.explanation}</p>
                <a
                  className="quiz-source"
                  href={question.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Nguồn: {question.sourceTitle} ↗
                </a>
              </div>
              <button
                className="quiz-next-button"
                type="button"
                disabled={isSaving}
                onClick={handleNext}
              >
                Câu tiếp theo →
              </button>
            </>
          )}
        </>
      )}
      {saveError && <p role="alert">{saveError}</p>}

      <div className="quiz-reward-box">
        <div>
          <strong>Đổi quà tại bảo tàng</strong>
          <p>Đạt 30 điểm để mở mã quà minh họa trong bản demo.</p>
        </div>
        <button
          type="button"
          disabled={progress.points < 30 || isSaving}
          onClick={() => void handleRedeem()}
        >
          Đổi 30 điểm
        </button>
        {rewardCode && (
          <p className="quiz-reward-code" role="status">
            Mã demo: <strong>{rewardCode}</strong>
          </p>
        )}
      </div>
      <p className="quiz-demo-note">
        Điểm và lượt chơi hết hạn lúc 00:00 ngày {expiryDate} (giờ Việt Nam). Mã
        quà chỉ dùng để minh họa.
      </p>
    </section>
  );
}
