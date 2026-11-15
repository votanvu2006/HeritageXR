/** Check real graphics capabilities, never a phone model or reported RAM. */
export function supportsGraphics(): boolean {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  let gl: WebGL2RenderingContext | null = null;
  try {
    gl = canvas.getContext('webgl2', { antialias: false, alpha: false });
    if (!gl || gl.isContextLost()) return false;
    // Current museum shadows use a 2048 px texture.
    if (gl.getParameter(gl.MAX_TEXTURE_SIZE) < 2048) return false;
    gl.clearColor(1, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    const pixel = new Uint8Array(4);
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    return gl.getError() === gl.NO_ERROR && pixel[0] === 255 && pixel[1] === 0;
  } catch {
    return false;
  } finally {
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    canvas.width = canvas.height = 0;
  }
}

/** Only sustained foreground stalls count; startup and background tabs do not. */
export class FrameHealth {
  private warmUntil = 0;
  private windowStart = 0;
  private previous = 0;
  private frames = 0;
  private slowWindows = 0;

  reset(now: number) {
    this.warmUntil = now + 5000;
    this.windowStart = this.warmUntil;
    this.previous = now;
    this.frames = 0;
    this.slowWindows = 0;
  }

  sample(now: number, visible: boolean): boolean {
    if (!visible || !this.previous || now - this.previous > 2000) {
      this.reset(now);
      return false;
    }
    this.previous = now;
    if (now < this.warmUntil) return false;
    this.frames++;
    const elapsed = now - this.windowStart;
    if (elapsed < 5000) return false;
    const fps = this.frames * 1000 / elapsed;
    this.slowWindows = fps < 8 ? this.slowWindows + 1 : 0;
    this.windowStart = now;
    this.frames = 0;
    return this.slowWindows >= 3;
  }
}

export function mediaFailure(kind: 'camera' | 'micro', error: unknown): string {
  const name = error instanceof Error ? error.name : '';
  const messages: Record<string, string> = {
    NotAllowedError: `Bạn chưa cấp quyền ${kind}. Hãy cho phép trong cài đặt trang web rồi thử lại.`,
    SecurityError: `${kind === 'camera' ? 'Camera' : 'Micro'} cần HTTPS và quyền truy cập từ trình duyệt.`,
    NotFoundError: `Không tìm thấy ${kind} khả dụng trên thiết bị.`,
    NotReadableError: `Chưa truy cập được ${kind}. Đóng ứng dụng có thể đang sử dụng rồi thử lại.`,
    OverconstrainedError: `Thiết lập ${kind} chưa được thiết bị hỗ trợ. Hãy thử lại bằng Safari hoặc Chrome đã cập nhật.`,
    AbortError: `Việc mở ${kind} đã bị gián đoạn. Bạn hãy thử lại.`,
    NotSupportedError: `Trình duyệt chưa hỗ trợ thao tác ${kind} này. Hãy dùng Safari hoặc Chrome đã cập nhật.`,
  };
  return messages[name] ?? `Chưa mở được ${kind}. Kiểm tra quyền truy cập rồi thử lại.`;
}
