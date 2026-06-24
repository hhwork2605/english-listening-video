import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { DialogueTurn, SpeakerInfo } from "../types";

type Props = {
  turn: DialogueTurn;
  speaker: SpeakerInfo;
  isPortrait: boolean;
};

/**
 * Khung phụ đề cho lượt thoại hiện tại: dải màu theo speaker, câu tiếng Anh
 * (highlight từ đang đọc nếu có words[]) và nghĩa tiếng Việt bên dưới.
 * Đặt bên trong <Series.Sequence> nên frame = 0 ở đầu mỗi lượt -> map thẳng
 * vào mốc thời gian của audio lượt đó.
 */
export const DialogueLine: React.FC<Props> = ({ turn, speaker, isPortrait }) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();

  const opacity = interpolate(frame, [0, Math.round(fps * 0.2)], [0, 1], {
    extrapolateRight: "clamp",
  });

  const t = frame / fps;
  const activeIndex = turn.words
    ? turn.words.findIndex((w) => t >= w.startSec && t < w.endSec)
    : -1;

  const enFont = isPortrait ? 46 : 50;
  const viFont = isPortrait ? 34 : 36;

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: isPortrait ? 150 : 90,
        margin: isPortrait ? "0 60px" : "0 220px",
        background: "rgba(8, 16, 22, 0.78)",
        borderLeft: `10px solid ${speaker.color}`,
        borderRadius: 20,
        padding: isPortrait ? "28px 32px" : "30px 44px",
        opacity,
        fontFamily: "system-ui, Segoe UI, Roboto, sans-serif",
        boxShadow: "0 18px 50px rgba(0,0,0,0.45)",
      }}
    >
      <div
        style={{
          color: speaker.color,
          fontWeight: 800,
          fontSize: isPortrait ? 26 : 24,
          marginBottom: 12,
          letterSpacing: 0.5,
        }}
      >
        {speaker.name}
      </div>

      <div
        style={{
          color: "#fff",
          fontSize: enFont,
          fontWeight: 700,
          lineHeight: 1.32,
          display: "flex",
          flexWrap: "wrap",
          gap: `${0.26 * enFont}px`,
        }}
      >
        {turn.words && turn.words.length > 0
          ? turn.words.map((w, i) => {
              const on = i === activeIndex;
              return (
                <span
                  key={i}
                  style={{
                    color: on ? "#0f2027" : "#fff",
                    background: on ? "#ffd86b" : "transparent",
                    borderRadius: on ? 8 : 0,
                    padding: on ? "1px 10px" : "1px 0",
                  }}
                >
                  {w.text}
                </span>
              );
            })
          : turn.en}
      </div>

      <div
        style={{
          color: "#ffd86b",
          fontSize: viFont,
          fontWeight: 500,
          marginTop: 18,
        }}
      >
        {turn.vi}
      </div>
    </div>
  );
};
