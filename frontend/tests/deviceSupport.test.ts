import assert from 'node:assert/strict';
import test from 'node:test';
import { FrameHealth, mediaFailure } from '../src/device/deviceSupport.ts';

function frames(monitor: FrameHealth, start: number, end: number, step: number, visible = true) {
  let stopped = false;
  for (let now = start; now <= end; now += step) stopped ||= monitor.sample(now, visible);
  return stopped;
}

test('normal foreground animation is not rejected', () => {
  assert.equal(frames(new FrameHealth(), 100, 60100, 16), false);
});
test('only sustained poor foreground animation stops the experience', () => {
  const monitor = new FrameHealth();
  assert.equal(frames(monitor, 100, 19100, 200), false);
  assert.equal(frames(monitor, 19300, 21100, 200), true);
});
test('brief slow frames and subsequent recovery do not trigger a block', () => {
  const monitor = new FrameHealth();
  assert.equal(frames(monitor, 100, 11100, 200), false);
  assert.equal(frames(monitor, 11116, 60100, 16), false);
});
test('background time and resume get a fresh warmup', () => {
  const monitor = new FrameHealth();
  assert.equal(frames(monitor, 100, 14100, 200), false);
  assert.equal(frames(monitor, 14300, 60100, 200, false), false);
  assert.equal(frames(monitor, 60300, 69100, 200), false);
});
test('a long scheduling pause is not treated as evidence of weak hardware', () => {
  const monitor = new FrameHealth();
  frames(monitor, 100, 14100, 200);
  assert.equal(monitor.sample(30100, true), false);
  assert.equal(frames(monitor, 30300, 39100, 200), false);
});
test('permissions and media availability have their own messages', () => {
  const denied = new Error(); denied.name = 'NotAllowedError';
  const busy = new Error(); busy.name = 'NotReadableError';
  const absent = new Error(); absent.name = 'NotFoundError';
  assert.match(mediaFailure('micro', denied), /quyền micro/);
  assert.match(mediaFailure('camera', busy), /Đóng ứng dụng/);
  assert.match(mediaFailure('micro', absent), /Không tìm thấy micro/);
  assert.doesNotMatch(mediaFailure('camera', denied), /máy yếu/);
});
