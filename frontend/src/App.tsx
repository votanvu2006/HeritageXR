import { lazy, Suspense, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { InteractiveScene, type ExhibitId } from "./InteractiveScene";
import { InteractiveStructureScene } from "./InteractiveStructureScene";
import { exhibitInformation } from "./exhibitInformation";
import { exhibitStories } from "./exhibitStories";
import { CraftingVideo } from "./CraftingVideo";
import { NarratedVideo } from "./NarratedVideo";
import { QuizPanel } from "./QuizPanel";
import { readQuizProgress, subscribeQuizProgress } from "./quizProgress";
import type { ExhibitChatContext } from "./Chatbot";
import { PhuChatbot } from "./components/PhuChatbot";
import { CameraPassthrough } from "./CameraPassthrough";
import "./App.css";
import "./HeritageExperience.css";
import "./SpatialGlass.css";
import "./VisitorRefinement.css";

const RagSandbox = lazy(() => import("./components/RagSandbox"));

type ExperienceScreen =
  | "scan"
  | "object"
  | "information"
  | "story"
  | "crafting"
  | "quiz";

type ObjectSection = "information" | "story" | "crafting" | "quiz";

const exhibits: {
  id: ExhibitId;
  number: string;
  name: string;
  collection: string;
}[] = [
  {
    id: "drum",
    number: "01",
    name: "Trống đồng Ngọc Lũ",
    collection: "Bộ sưu tập Đông Sơn",
  },
  {
    id: "jar",
    number: "02",
    name: "Thạp đồng Đào Thịnh",
    collection: "Bộ sưu tập Đông Sơn",
  },
  {
    id: "dagger",
    number: "03",
    name: "Dao găm đồng Đông Sơn",
    collection: "Bộ sưu tập Đông Sơn",
  },
];

const objectSections: {
  id: ObjectSection;
  label: string;
}[] = [
  { id: "information", label: "Thông tin" },
  { id: "story", label: "Câu chuyện" },
  { id: "crafting", label: "Chế tác" },
  { id: "quiz", label: "Đố vui" },
];

const contentFlow: ObjectSection[] = [
  "information",
  "story",
  "crafting",
  "quiz",
];

function SectionIcon({ section }: { section: ObjectSection }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {section === "information" && <><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7h.01" /></>}
    {section === "story" && <><path d="M12 5v15M3 4.5c3-1 6-.5 9 1.5 3-2 6-2.5 9-1.5v14c-3-1-6-.5-9 1.5-3-2-6-2.5-9-1.5z" /></>}
    {section === "crafting" && <><path d="m14 4 6 6-3 3-6-6zM12 10 4 18a2 2 0 0 0 3 3l8-8M13 5l3-3 6 6-3 3" /></>}
    {section === "quiz" && <><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 2-2.5 2-2.5 4M12 17h.01" /></>}
  </svg>;
}

function ExhibitSectionNav({ active, onSelect }: { active: ExperienceScreen; onSelect: (section: ObjectSection) => void }) {
  return <nav className="object-action-dock glass-surface" aria-label="Chọn nội dung hiện vật">
    <div className="object-action-list">{objectSections.map((section) => <button className={`object-action-button${active === section.id ? " is-active" : ""}`} key={section.id} type="button" aria-current={active === section.id ? "page" : undefined} onClick={() => onSelect(section.id)}>
      <span className="object-action-icon"><SectionIcon section={section.id} /></span><span>{section.label}</span>
    </button>)}</div>
  </nav>;
}

function MuseumApp() {
  const [selectedId, setSelectedId] = useState<ExhibitId | null>(null);
  const [screen, setScreen] = useState<ExperienceScreen>("scan");
  const quizProgress = useSyncExternalStore(subscribeQuizProgress, readQuizProgress);
  const points = quizProgress.points;
  const isContentOpen = screen !== "scan" && screen !== "object";
  const contentPanelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    contentPanelRef.current?.scrollTo({ top: 0 });
  }, [screen, selectedId]);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [storyVideoUnavailable, setStoryVideoUnavailable] = useState(false);

  const selectedExhibit = selectedId
    ? exhibits.find((exhibit) => exhibit.id === selectedId) ?? exhibits[0]
    : null;

  const selectedInformation = selectedId
    ? exhibitInformation[selectedId]
    : null;

  const selectedStory = selectedId ? exhibitStories[selectedId] : null;

  const chatContext: ExhibitChatContext | null =
    selectedExhibit && selectedInformation && selectedStory
      ? {
          id: selectedExhibit.id,
          name: selectedExhibit.name,
          collection: selectedExhibit.collection,
          period: selectedInformation.period,
          material: selectedInformation.material,
          overview: selectedInformation.overview,
          facts: selectedInformation.facts,
          note: selectedInformation.note ?? "",
          sourceTitle: selectedInformation.sourceTitle,
          sourceUrl: selectedInformation.sourceUrl,
          storyTitle: selectedStory.title,
          storyIntroduction: selectedStory.introduction,
        }
      : null;

  const handleSelectExhibit = (id: ExhibitId) => {
    setSelectedId(id);
    setScreen("object");
    setStoryVideoUnavailable(false);
    setIsAssistantOpen(false);
  };

  const handleBackToScan = () => {
    setScreen("scan");
    setSelectedId(null);
    setIsAssistantOpen(false);
  };

  const handleBackToObject = () => {
    setScreen("object");
    setIsAssistantOpen(false);
  };

  const openObjectSection = (section: ObjectSection) => {
    setScreen(section);
    setIsAssistantOpen(false);

    if (section === "story") {
      setStoryVideoUnavailable(false);
    }
  };

  const handleNextContent = () => {
    const currentIndex = contentFlow.indexOf(screen as ObjectSection);

    if (currentIndex === -1) return;

    const nextSection =
      contentFlow[(currentIndex + 1) % contentFlow.length];

    openObjectSection(nextSection);
  };

  const screenTitles: Record<ExperienceScreen, string> = {
    scan: "Quét hiện vật",
    object: "Khám phá hiện vật",
    information: "Thông tin hiện vật",
    story: "Câu chuyện hiện vật",
    crafting: "Quá trình chế tác",
    quiz: "Đố vui có thưởng",
  };
  const nextSection = contentFlow[(contentFlow.indexOf(screen as ObjectSection) + 1) % contentFlow.length];
  const nextSectionLabel = objectSections.find((section) => section.id === nextSection)?.label;

  return (
    <CameraPassthrough>
      <main className="app heritage-experience spatial-app">
        <header className="visitor-identity">
          <div className="heritage-brand visitor-brand"><strong>HeritageXR</strong><span>BẢO TÀNG TƯƠNG TÁC</span></div>
          <span className="heritage-total-points" aria-label={`Tổng điểm: ${points}`}>✦ {points} điểm</span>
        </header>

        <div className={`spatial-stage spatial-stage-${screen}${isContentOpen ? " is-reading" : ""}`}>
          {screen === "scan" && (
            <section className="scan-experience" aria-label="Quét hiện vật">
              <div className="mobile-gallery-setting" aria-hidden="true" />
              <div className="scan-guidance glass-surface">
                <div className="mobile-demo-intro">
                  <span className="section-label">THAM QUAN MÔ PHỎNG</span>
                  <strong>Khám phá bộ sưu tập Đông Sơn</strong>
                  <p>Chạm điểm sáng trên hiện vật để bắt đầu.</p>
                </div>
                <div className="desktop-scan-intro">
                <span className="section-label">GÓC NHÌN CAMERA</span>
                <strong>Hướng camera về hiện vật muốn khám phá</strong>
                <p>
                  Chạm hotspot trên hiện vật để mở không gian xem riêng.
                </p>
                </div>
              </div>

              <InteractiveScene
                selectedId={null}
                onSelect={handleSelectExhibit}
                showDisplayCase
                alignToGallery
              />

              <div className="scan-bottom-hint glass-surface">
                <span className="scan-status-dot" />
                <span className="desktop-scan-intro">Cảnh xung quanh vẫn hiển thị khi fen lia điện thoại</span>
                <span className="mobile-demo-intro">3 hiện vật · Chạm để khám phá</span>
              </div>
            </section>
          )}

          {screen === "object" && selectedExhibit && (
            <section
              className="object-experience"
              aria-label={`Khám phá ${selectedExhibit.name}`}
            >
              <header className="object-experience-heading glass-surface">
                <button
                  className="spatial-back-button"
                  type="button"
                  aria-label="Quay lại phòng trưng bày"
                  onClick={handleBackToScan}
                >
                  <span className="object-back-arrow" aria-hidden="true">←</span>
                  <span className="object-back-text">Quay lại quét</span>
                </button>

                <div className="object-title-copy">
                  <span className="section-label">KHÁM PHÁ HIỆN VẬT</span>
                  <h1>{selectedExhibit.name}</h1>
                  <p>{selectedExhibit.collection}</p>
                </div>

                <button
                  className="spatial-assistant-button"
                  type="button"
                  aria-expanded={isAssistantOpen}
                  onClick={() => setIsAssistantOpen((open) => !open)}
                >
                  ✦ Hỏi AI
                </button>
              </header>

              <InteractiveStructureScene exhibitId={selectedExhibit.id} />

              {isAssistantOpen && (
                <aside className="spatial-assistant-panel glass-surface">
                  <header>
                    <div>
                      <span className="section-label">HƯỚNG DẪN VIÊN AI</span>
                      <strong>{selectedExhibit.name}</strong>
                    </div>

                    <button
                      type="button"
                      aria-label="Đóng trợ lý AI"
                      onClick={() => setIsAssistantOpen(false)}
                    >
                      ×
                    </button>
                  </header>

                  <PhuChatbot exhibit={chatContext} />
                </aside>
              )}

              <ExhibitSectionNav active={screen} onSelect={openObjectSection} />
            </section>
          )}

          {screen !== "scan" && screen !== "object" && selectedExhibit && (
            <section
              className={`content-experience content-experience-${screen}`}
              aria-label={screenTitles[screen]}
            >
              <div className="content-glass-panel glass-surface">
                <header className="content-experience-header">
                  <button
                    className="spatial-back-button"
                    type="button"
                    onClick={handleBackToObject}
                  >
                    ← Quay lại hiện vật
                  </button>

                  <div>
                    <span className="section-label">
                      {selectedExhibit.name}
                    </span>
                    <h1 aria-live="polite">{screenTitles[screen]}</h1>
                  </div>

                  <button
                    className="spatial-next-button"
                    type="button"
                    onClick={handleNextContent}
                  >
                    {nextSectionLabel} →
                  </button>
                </header>

                <ExhibitSectionNav active={screen} onSelect={openObjectSection} />
                <div className="content-scroll-region" ref={contentPanelRef}>
                {screen === "information" && selectedInformation && (
                  <article className="spatial-information-content">
                    <div className="spatial-information-meta">
                      <span>{selectedInformation.period}</span>
                      <span>{selectedInformation.material}</span>
                    </div>

                    <p className="spatial-information-overview">
                      {selectedInformation.overview}
                    </p>

                    <ul className="spatial-information-facts">
                      {selectedInformation.facts.map((fact) => (
                        <li key={fact}>{fact}</li>
                      ))}
                    </ul>

                    {selectedInformation.note && (
                      <p className="information-note">
                        {selectedInformation.note}
                      </p>
                    )}

                    <p className="heritage-3d-note">
                      Mô hình 3D là bản minh họa để khám phá cấu tạo; không
                      phải bản quét số hóa chính xác.
                    </p>

                    <a
                      className="information-source"
                      href={selectedInformation.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Nguồn: {selectedInformation.sourceTitle} ↗
                    </a>
                  </article>
                )}

                {screen === "story" && selectedStory && (
                  <article className="spatial-story-content">
                    <div className="spatial-story-copy">
                      <h2>{selectedStory.title}</h2>
                      <p>{selectedStory.introduction}</p>

                      <p className="spatial-story-description">
                        {selectedStory.videoDescription}
                      </p>
                    </div>

                    <div className="spatial-story-video">
                      {!storyVideoUnavailable ? (
                        <NarratedVideo
                          key={selectedExhibit.id}
                          exhibitId={selectedExhibit.id}
                          kind="story"
                          ariaLabel={`Video câu chuyện ${selectedExhibit.name}`}
                          onLoadedData={() => setStoryVideoUnavailable(false)}
                          onError={() => setStoryVideoUnavailable(true)}
                        />
                      ) : (
                        <div
                          className="story-viewer-video-error"
                          role="status"
                        >
                          Không tải được video. Kiểm tra file trong
                          frontend/public/videos và đường dẫn trong
                          exhibitStories.ts.
                        </div>
                      )}
                    </div>

                    <div className="spatial-story-sources">
                      <span className="section-label">NGUỒN TƯ LIỆU</span>

                      {selectedStory.sources.map((source) => (
                        <a
                          href={source.url}
                          key={source.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {source.title} ↗
                        </a>
                      ))}
                    </div>
                  </article>
                )}

                {screen === "crafting" && (
                  <div className="spatial-crafting-content">
                    <CraftingVideo
                      exhibitId={selectedExhibit.id}
                      title={selectedExhibit.name}
                      onContinueToFact={() => setScreen("information")}
                    />
                  </div>
                )}

                {screen === "quiz" && (
                  <div className="spatial-quiz-content">
                    <QuizPanel
                      key={`${selectedExhibit.id}-${quizProgress.day}`}
                      exhibitId={selectedExhibit.id}
                    />
                  </div>
                )}
                </div>
              </div>
            </section>
          )}
        </div>
      </main>
    </CameraPassthrough>
  );
}

function App() {
  if (new URLSearchParams(window.location.search).has("sandbox")) {
    return <Suspense fallback={<p role="status">Đang mở không gian thử nghiệm…</p>}><RagSandbox /></Suspense>;
  }
  return <MuseumApp />;
}

export default App;
