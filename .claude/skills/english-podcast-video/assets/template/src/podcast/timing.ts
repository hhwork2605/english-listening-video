import type { Dialogue, DialogueTurn } from "./types";

/** Số frame của một lượt nói = audio + khoảng nghỉ sau. */
export const turnDurationInFrames = (turn: DialogueTurn, fps: number): number => {
  const dur = Math.max(0.3, turn.durationInSec);
  return Math.max(1, Math.round((dur + turn.pauseAfterSec) * fps));
};

export const totalDialogueFrames = (d: Dialogue): number =>
  d.turns.reduce((acc, t) => acc + turnDurationInFrames(t, d.fps), 0);
