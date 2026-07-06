import React from "react";
import {
  AbsoluteFill,
  Audio,
  Img,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { Dialogue } from "../podcast/types";
import { turnDurationInFrames } from "../podcast/timing";

export type ReelDialogueListProps = {
  dialogue: Dialogue;
  /** Tiêu đề trên cùng (vd "Outside Tom's House"). Bỏ trống -> dùng dialogue.topic. */
  header?: string;
  /** Emoji đứng trước tiêu đề. */
  headerEmoji?: string;
  /** Màu nền giấy. */
  background?: string;
  /** Màu chữ tiêu đề. */
  headerColor?: string;
  /** Màu nội dung câu (không phải tên người nói). */
  textColor?: string;
  /** Màu band tô sáng câu đang đọc. */
  highlightColor?: string;
  /** Logo watermark (public/). "" để tắt. */
  logo?: string;
};

/**
 * Dạng A — "danh sách hội thoại đọc theo" (giống các reel luyện nghe phổ biến):
 * nền giấy trơn + tiêu đề + TOÀN BỘ hội thoại dạng list, tô sáng CÂU đang đọc
 * (karaoke mức câu), tên người nói tô màu theo speakers[].color. Audio 2 giọng
 * luân phiên từ dialogue.json — tái dùng nguyên pipeline TTS/align/finalize.
 */
export const ReelDialogueList: React.FC<ReelDialogueListProps> = ({
  dialogue,
  header,
  headerEmoji = "👉",
  background = "#fbf6e9",
  headerColor = "#2e9d4f",
  textColor = "#1c2b4a",
  highlightColor = "rgba(160, 200, 90, 0.35)",
  logo = "logo.jpg",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const turns = dialogue.turns ?? [];

  // Mốc frame tuyệt đối của từng lượt -> xác định câu đang đọc.
  let acc = 0;
  const bounds = turns.map((turn) => {
    const dur = turnDurationInFrames(turn, fps);
    const b = { start: acc, end: acc + dur };
    acc += dur;
    return b;
  });
  let activeIdx = -1;
  for (let i = 0; i < bounds.length; i++) {
    if (frame >= bounds[i].start && frame < bounds[i].end) {
      activeIdx = i;
      break;
    }
  }

  // Cỡ chữ tự co theo số lượt để đủ chỗ trong khung dọc.
  const n = turns.length;
  const fontSize = n <= 12 ? 40 : n <= 16 ? 34 : n <= 20 ? 29 : 25;
  const gap = fontSize * 0.42;

  const headerText = (header ?? dialogue.topic ?? dialogue.title ?? "").toString();

  return (
    <AbsoluteFill style={{ backgroundColor: background, fontFamily: '"Baloo 2", "Nunito", "Segoe UI", system-ui, sans-serif' }}>
      {/* Tiêu đề */}
      <div
        style={{
          textAlign: "center",
          fontWeight: 900,
          color: headerColor,
          fontSize: 52,
          padding: "40px 40px 10px",
          textShadow: "0 2px 0 rgba(0,0,0,0.06)",
        }}
      >
        {headerEmoji} {headerText}
      </div>

      {/* Danh sách hội thoại */}
      <div style={{ padding: "10px 46px 40px", display: "flex", flexDirection: "column", gap, justifyContent: "center", flex: 1 }}>
        {turns.map((turn, i) => {
          const sp = dialogue.speakers[turn.speaker];
          const active = i === activeIdx;
          const pulse = active
            ? interpolate(frame - bounds[i].start, [0, 6], [0.6, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
            : 1;
          return (
            <div
              key={turn.id}
              style={{
                background: active ? highlightColor : "transparent",
                borderRadius: 14,
                padding: active ? "6px 14px" : "6px 14px",
                fontSize,
                lineHeight: 1.28,
                fontWeight: 700,
                color: textColor,
                paddingLeft: `calc(14px + 2.2em)`,
                textIndent: "-2.2em",
                opacity: activeIdx === -1 ? 1 : active ? 1 : 0.85,
                transform: `scale(${active ? 0.6 + 0.4 * pulse + 0.02 : 1})`,
                transformOrigin: "left center",
              }}
            >
              <span style={{ color: sp?.color ?? "#333", fontWeight: 900, marginRight: 8 }}>
                {sp?.name ?? turn.speaker}:
              </span>
              {turn.en}
            </div>
          );
        })}
      </div>

      {/* Audio 2 giọng luân phiên — mỗi lượt phát đúng mốc frame của nó */}
      {turns.map((turn, i) =>
        turn.audio ? (
          <Sequence key={turn.id} from={bounds[i].start} durationInFrames={bounds[i].end - bounds[i].start}>
            <Audio src={staticFile(turn.audio)} />
          </Sequence>
        ) : null,
      )}

      {/* Logo watermark */}
      {logo ? (
        <Img
          src={staticFile(logo)}
          style={{
            position: "absolute",
            bottom: 26,
            right: 26,
            width: 92,
            height: 92,
            borderRadius: "50%",
            objectFit: "cover",
            border: "3px solid rgba(255,255,255,0.9)",
            boxShadow: "0 4px 14px rgba(0,0,0,0.25)",
            opacity: 0.6,
          }}
        />
      ) : null}
    </AbsoluteFill>
  );
};
