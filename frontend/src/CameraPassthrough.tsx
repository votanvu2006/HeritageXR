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

  const retryCamera = () => {
    const video = videoRef.current;
    if (video?.srcObject && (video.srcObject as MediaStream).active) {
      video.play().then(() => {
        setReady(true);
        onReady?.(true);
        setMessage("");
      }).catch(() => setMessage("Video chưa phát được. Hãy tải lại trang hoặc mở bằng Safari/Chrome."));
    } else {
      setRetry(value => value + 1);
    }
  };

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | undefined;
    const video = videoRef.current;
    setReady(false);
    onReady?.(false);
    setMessage("");
    if (!enabled) return;
    const startupTimer = window.setTimeout(() => {
      if (!cancelled) setMessage("Camera chưa sẵn sàng. Hãy cho phép camera, rồi chạm Mở lại camera.");
    }, 12000);

    async function start() {
      try {
        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
          throw new Error("Camera cần HTTPS và trình duyệt hỗ trợ camera. Hãy mở bằng Safari hoặc Chrome.");
        }
        stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: {
          facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 24, max: 30 },
        } });
        if (cancelled) { stream.getTracks().forEach(track => track.stop()); return; }
        if (video) {
          // Apply inline playback before attaching the stream, including WebKit.
          video.muted = true;
          video.defaultMuted = true;
          video.playsInline = true;
          video.setAttribute("playsinline", "");
          video.setAttribute("webkit-playsinline", "");
          video.setAttribute("muted", "");
          video.srcObject = stream;
          try {
            await video.play();
          } catch {
            if (!cancelled) setMessage("Chạm Mở lại camera để phát hình ảnh trực tiếp.");
            return;
          }
        }
        if (!cancelled) { window.clearTimeout(startupTimer); setMessage(""); setReady(true); onReady?.(true); }
      } catch (error) {
        window.clearTimeout(startupTimer);
        stream?.getTracks().forEach(track => track.stop());
        if (!cancelled) setMessage(error instanceof Error && error.message.startsWith("Camera cần") ? error.message : mediaFailure("camera", error));
      }
    }
    void start();
    return () => {
      cancelled = true;
      window.clearTimeout(startupTimer);
      stream?.getTracks().forEach(track => track.stop());
      if (video) video.srcObject = null;
    };
  }, [enabled, retry, videoRef, onReady]);

  return <div className={`camera-passthrough-shell${enabled ? " is-live-camera" : ""}`}>
    <video ref={videoRef} className={`camera-passthrough-video ${enabled && ready ? "is-active" : ""}`} autoPlay muted playsInline controls={false} disablePictureInPicture disableRemotePlayback aria-label="Hình ảnh camera trực tiếp" />
    <div className="camera-passthrough-shade" aria-hidden="true" />
    <div className="camera-passthrough-content">{children}</div>
    {enabled && !ready && <div className="live-camera-feedback" role="status">
      <p>{message || "Đang mở camera… Vui lòng cho phép truy cập camera."}</p>
      {message && <button type="button" onClick={retryCamera}>Mở lại camera</button>}
    </div>}
    <div className="camera-passthrough-control">{controls}</div>
  </div>;
}
