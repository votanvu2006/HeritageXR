import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import "./CameraPassthrough.css";
import { mediaFailure } from "./device/deviceSupport";

type CameraPassthroughProps = {
  children: ReactNode;
};

export function CameraPassthrough({ children }: CameraPassthroughProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mountedRef = useRef(true);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [cameraMessage, setCameraMessage] = useState("");

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsCameraOn(false);
  }, []);

  const toggleCamera = useCallback(async () => {
    if (isCameraOn) {
      stopCamera();
      setCameraMessage("Camera đã tắt.");
      return;
    }

    if (!window.isSecureContext) {
      setCameraMessage("Camera cần đường dẫn HTTPS. Bạn vẫn có thể xem phòng mô phỏng.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraMessage(
        "Trình duyệt chưa hỗ trợ camera. Hãy mở bằng Safari hoặc Chrome đã cập nhật.",
      );
      return;
    }

    try {
      setCameraMessage("");

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });

      if (!mountedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setIsCameraOn(true);
    } catch (error) {
      setCameraMessage(mediaFailure("camera", error));
      stopCamera();
    }
  }, [isCameraOn, stopCamera]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  return (
    <div className="camera-passthrough-shell">
      <video
        ref={videoRef}
        className={`camera-passthrough-video ${
          isCameraOn ? "is-active" : ""
        }`}
        autoPlay
        muted
        playsInline
        aria-hidden="true"
      />

      <div className="camera-passthrough-shade" aria-hidden="true" />
      <div className="camera-passthrough-content">{children}</div>

      <div className="camera-passthrough-control">
        <button
          className={`camera-toggle-button ${
            isCameraOn ? "is-active" : ""
          }`}
          type="button"
          onClick={toggleCamera}
          aria-pressed={isCameraOn}
        >
          <span className="camera-toggle-dot" />
          {isCameraOn ? "Tắt camera" : "Bật camera thật"}
        </button>

        <span className="camera-passthrough-caption" aria-live="polite">
          {cameraMessage ||
            (isCameraOn
              ? "Cảnh thật đang hiển thị · xoay điện thoại để lia nhìn"
              : "Bật camera để nhìn thấy không gian xung quanh")}
        </span>
      </div>
    </div>
  );
}
