import type { WordTiming } from "../types";

export type SpeakerId = "A" | "B";

export type SpeakerInfo = {
  /** Tên hiển thị (vd "Emma"). */
  name: string;
  /** Giọng SAPI dùng cho speaker này (vd "Microsoft Zira Desktop"). */
  voice: string;
  /** Vị trí trên sân khấu. */
  side: "left" | "right";
  /** Màu nhấn của speaker (badge, viền khi đang nói). */
  color: string;
  /** Ảnh nhân vật trong public/ (vd "characters/emma.png"). Bỏ trống -> avatar chữ. */
  image?: string;
};

export type DialogueTurn = {
  id: string;
  speaker: SpeakerId;
  en: string;
  vi: string;
  /** File audio trong public/ (tts-dialogue.ps1 tự điền). */
  audio: string;
  /** Độ dài audio (giây) — tts/measure tự điền. */
  durationInSec: number;
  /** Khoảng nghỉ sau lượt nói này (giây). */
  pauseAfterSec: number;
  /** Mốc thời gian từng từ (tùy chọn) cho highlight. */
  words?: WordTiming[];
};

export type Dialogue = {
  title: string;
  /** Cấp độ hiển thị trên badge, vd "B1-B2". */
  level: string;
  /** Chủ đề ngắn, hiển thị ở header. */
  topic: string;
  fps: number;
  speakers: Record<SpeakerId, SpeakerInfo>;
  turns: DialogueTurn[];
};
