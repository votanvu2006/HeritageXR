import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import "./CameraPassthrough.css";
import { mediaFailure } from "./device/deviceSupport";

type CameraPassthroughProps = {
  children: ReactNode;
  controls?: ReactNode;
  enabled?: boolean;
  videoRef?: RefObject<HTMLVideoElement | null>;
  onReady?: (ready: boolean) => void;
};

export function CameraPassthrough({ children, controls, enabled = false, videoRef: providedRef, onReady }: CameraPassthroughProps) {
  const ownRef = useRef<HTMLVideoElement>(null);
  const videoRef = providedRef ?? ownRef;
  const [message, setMessage] = useState("");
  const [retry, setRetry] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | undefined;
    const video = videoRef.current;
    setReady(false);
    onReady?.(false);
    setMessage("");
    if (!enabled) return;

    async function start() {
      try {
        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
          throw new Error("Camera cần HTTPS và trình duyệt hỗ trợ camera. Hãy mở bằng Safari hoặc Chrome.");
        }
        stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: {
          facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 },
        } });
        if (cancelled) { stream.getTracks().forEach(track => track.stop()); return; }
        if (video) { video.srcObject = stream; await video.play(); }
        if (!cancelled) { setReady(true); onReady?.(true); }
      } catch (error) {
        stream?.getTracks().forEach(track => track.stop());
        if (!cancelled) setMessage(error instanceof Error && error.message.startsWith("Camera cần") ? error.message : mediaFailure("camera", error));
      }
    }
    void start();
    return () => {
      cancelled = true;
      stream?.getTracks().forEach(track => track.stop());
      if (video) video.srcObject = null;
    };
  }, [enabled, retry, videoRef, onReady]);

  return <div className={`camera-passthrough-shell${enabled ? " is-live-camera" : ""}`}>
    <video ref={videoRef} className={`camera-passthrough-video ${enabled && ready ? "is-active" : ""}`} autoPlay muted playsInline aria-label="Hình ảnh camera trực tiếp" />
    <div className="camera-passthrough-shade" aria-hidden="true" />
    <div className="camera-passthrough-content">{children}</div>
    {enabled && !ready && <div className="live-camera-feedback" role="status">
      <p>{message || "Đang mở camera… Vui lòng cho phép truy cập camera."}</p>
      {message && <button type="button" onClick={() => setRetry(value => value + 1)}>Mở lại camera</button>}
    </div>}
    <div className="camera-passthrough-control">{controls}</div>
  </div>;
}
