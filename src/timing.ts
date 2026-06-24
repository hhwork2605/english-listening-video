import type { Script, ScriptItem } from "./types";

export const DEFAULT_GAP_BETWEEN_REPEATS_SEC = 0.6;

/** Số frame của một lần phát (1 vòng = audio + khoảng nghỉ giữa các lần). */
export const roundDurationInFrames = (item: ScriptItem, fps: number): number => {
  const gap = item.gapBetweenRepeatsSec ?? DEFAULT_GAP_BETWEEN_REPEATS_SEC;
  return Math.max(1, Math.round((item.durationInSec + gap) * fps));
};

/** Tổng số frame của một cảnh (1 câu) = các vòng lặp + khoảng nghỉ cuối. */
export const sceneDurationInFrames = (item: ScriptItem, fps: number): number => {
  const rounds = roundDurationInFrames(item, fps) * Math.max(1, item.repeat);
  const pause = Math.round(item.pauseAfterSec * fps);
  return rounds + pause;
};

/** Tổng số frame của cả video. */
export const totalDurationInFrames = (script: Script): number =>
  script.items.reduce(
    (acc, item) => acc + sceneDurationInFrames(item, script.fps),
    0,
  );
