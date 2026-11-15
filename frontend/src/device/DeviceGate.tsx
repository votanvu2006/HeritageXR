import { Component, useEffect, useState, type ReactNode } from 'react';
import { FrameHealth, supportsGraphics } from './deviceSupport';
import './DeviceGate.css';

type Failure = 'graphics' | 'slow' | 'lost';
function DeviceNotice({ reason }: { reason: Failure }) {
  const explanations: Record<Failure, string> = {
    graphics: 'Trình duyệt hoặc thiết bị hiện chưa đáp ứng yêu cầu hiển thị 3D của HeritageXR.',
    slow: 'Thiết bị hiện chạy trải nghiệm quá chậm trong thời gian dài. HeritageXR đã dừng hiển thị 3D để tránh tiếp tục gây giật, treo máy.',
    lost: 'Thiết bị vừa mất kết nối đồ họa 3D. Nguyên nhân có thể là thiếu tài nguyên hoặc trình duyệt tạm dừng xử lý.',
  };
  return <section className="device-notice" role="alert">
    <div className="device-notice-card">
      <span className="device-notice-brand">HeritageXR</span>
      <span className="device-notice-icon" aria-hidden="true">◇</span>
      <h1>Chưa thể mở trải nghiệm 3D</h1>
      <p>{explanations[reason]}</p>
      <p>Đóng bớt ứng dụng và mở lại bằng Safari trên iPhone hoặc Chrome trên Android đã cập nhật. Nếu vẫn gặp lỗi, vui lòng dùng thiết bị khác.</p>
      <button type="button" onClick={() => window.location.reload()}>Thử lại</button>
    </div>
  </section>;
}

class GraphicsBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      if (/webgl|creating.*context|graphics context/i.test(this.state.error.message)) return <DeviceNotice reason="graphics" />;
      throw this.state.error;
    }
    return this.props.children;
  }
}

export function DeviceGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<'checking' | 'ready' | Failure>('checking');
  useEffect(() => {
    const frame = requestAnimationFrame(() => setStatus(supportsGraphics() ? 'ready' : 'graphics'));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (status !== 'ready') return;
    const health = new FrameHealth();
    let frame = 0;
    const tick = (now: number) => {
      if (health.sample(now, !document.hidden)) {
        setStatus('slow');
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    const resume = () => health.reset(performance.now());
    const contextLost = (event: Event) => {
      if (event.target instanceof HTMLCanvasElement && event.target.isConnected) setStatus('lost');
    };
    frame = requestAnimationFrame(tick);
    document.addEventListener('visibilitychange', resume);
    document.addEventListener('webglcontextlost', contextLost, true);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('visibilitychange', resume);
      document.removeEventListener('webglcontextlost', contextLost, true);
    };
  }, [status]);

  if (status === 'checking') return <div className="device-checking" role="status">Đang kiểm tra khả năng hiển thị 3D…</div>;
  if (status !== 'ready') return <DeviceNotice reason={status} />;
  return <GraphicsBoundary>{children}</GraphicsBoundary>;
}
