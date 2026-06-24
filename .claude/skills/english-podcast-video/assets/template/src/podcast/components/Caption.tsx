import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { DialogueTurn } from "../types";
import type { WordTiming } from "../../types";

type Props = {
  turn: DialogueTurn;
  isPortrait: boolean;
  /** Số từ tối đa mỗi cụm caption. */
  maxWords?: number;
  /** Màu của từ đang được đọc. */
  highlightColor?: string;
};

type IndexedWord = { w: WordTiming; idx: number };
type Chunk = { words: IndexedWord[]; start: number };

/**
 * Thời điểm KẾT THÚC để highlight một từ.
 * - Khi đã forced-align bằng Whisper (scripts/align_whisper.py), `endSec` là mốc
 *   THẬT của từ → dùng thẳng, highlight khớp tuyệt đối với tiếng nói.
 * - Dữ liệu SAPI cũ đặt `endSec = start của từ kế tiếp`, có thể trải dài qua
 *   khoảng nghỉ cuối câu (vài giây) làm từ "dính" sáng. Nếu khoảng đó dài bất
 *   thường (> 1.5s) thì coi là placeholder và chốt lại ~0.6s.
 */
const HL_MAX_SEC = 1.5;
const spokenEnd = (w: WordTiming): number => {
  const span = w.endSec - w.startSec;
  if (span <= 0) return w.startSec + 0.4;
  return span > HL_MAX_SEC ? w.startSec + 0.6 : w.endSec;
};

/** Gom các từ thành cụm ngắn (ngắt theo dấu câu hoặc khi đủ số từ). */
const buildChunks = (turn: DialogueTurn, maxWords: number): Chunk[] => {
  if (!turn.words || turn.words.length === 0) {
    const fallback: WordTiming = { text: turn.en, startSec: 0, endSec: turn.durationInSec || 9999 };
    return [{ words: [{ w: fallback, idx: 0 }], start: 0 }];
  }
  const chunks: Chunk[] = [];
  let cur: IndexedWord[] = [];
  turn.words.forEach((w, idx) => {
    cur.push({ w, idx });
    const endsClause = /[,.!?;:]$/.test(w.text);
    if (cur.length >= maxWords || endsClause) {
      chunks.push({ words: cur, start: cur[0].w.startSec });
      cur = [];
    }
  });
  if (cur.length) chunks.push({ words: cur, start: cur[0].w.startSec });
  return chunks;
};

/**
 * Transcript dạng caption: hiển thị cụm từ đang được nói (tiếng Anh), căn giữa
 * phía trên — giống kênh gốc. Từ đang được đọc được làm sáng theo mốc thời gian
 * (chỉ trong lúc thực sự phát ra tiếng). Giữ cụm gần nhất trong các khoảng nghỉ
 * ngắn để tránh nhấp nháy.
 */
export const Caption: React.FC<Props> = ({
  turn,
  isPortrait,
  maxWords = 5,
  highlightColor = "#ffd86b",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  const words = turn.words ?? [];
  // Từ đang được đọc tại thời điểm t (—1 nếu đang ở khoảng nghỉ giữa các từ).
  let activeIdx = -1;
  for (let i = 0; i < words.length; i++) {
    if (t >= words[i].startSec && t < spokenEnd(words[i])) {
      activeIdx = i;
      break;
    }
  }

  const chunks = buildChunks(turn, maxWords);
  let ci = 0;
  for (let i = 0; i < chunks.length; i++) if (t >= chunks[i].start) ci = i;
  const chunk = chunks[ci];

  const local = t - chunk.start;
  const opacity = interpolate(local, [0, 0.12], [0.3, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        top: isPortrait ? "16%" : "18%",
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        padding: isPortrait ? "0 70px" : "0 220px",
        fontFamily: "system-ui, Segoe UI, Roboto, sans-serif",
      }}
    >
      <div
        style={{
          fontSize: isPortrait ? 56 : 64,
          fontWeight: 800,
          lineHeight: 1.25,
          textAlign: "center",
          textShadow: "0 4px 22px rgba(0,0,0,0.6)",
          opacity,
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: `${0.28 * (isPortrait ? 56 : 64)}px`,
        }}
      >
        {chunk.words.map(({ w, idx }) => (
          <span key={idx} style={{ color: idx === activeIdx ? highlightColor : "#ffffff" }}>
            {w.text}
          </span>
        ))}
      </div>
    </div>
  );
};
