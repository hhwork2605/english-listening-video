import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { ScriptItem } from "../types";

type Props = {
  item: ScriptItem;
  /** Cỡ chữ co giãn theo định dạng (ngang/dọc). */
  scale?: number;
  /** Số frame của một vòng phát (audio + nghỉ). Dùng để map highlight. */
  roundFrames?: number;
  /** Số lần lặp. Sau khi hết các vòng (đang nghỉ cuối) thì không highlight. */
  repeatCount?: number;
};

export const Subtitle: React.FC<Props> = ({
  item,
  scale = 1,
  roundFrames,
  repeatCount = 1,
}) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();

  // Fade-in nhẹ ở 0.3s đầu mỗi cảnh.
  const opacity = interpolate(frame, [0, Math.round(fps * 0.3)], [0, 1], {
    extrapolateRight: "clamp",
  });
  const translateY = interpolate(frame, [0, Math.round(fps * 0.3)], [20, 0], {
    extrapolateRight: "clamp",
  });

  const isPortrait = width < 1200;

  // Thời điểm hiện tại trong một vòng phát (giây), để biết từ nào đang được đọc.
  // Mỗi lần lặp lại reset về 0; trong khoảng nghỉ cuối thì trả null (không highlight).
  const timeInRound = ((): number | null => {
    if (!item.words || !roundFrames) return null;
    const roundsTotal = roundFrames * Math.max(1, repeatCount);
    if (frame >= roundsTotal) return null;
    return (frame % roundFrames) / fps;
  })();

  const activeIndex =
    timeInRound === null || !item.words
      ? -1
      : item.words.findIndex(
          (w) => timeInRound >= w.startSec && timeInRound < w.endSec,
        );

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        padding: isPortrait ? "0 80px" : "0 160px",
        opacity,
        transform: `translateY(${translateY}px)`,
        textAlign: "center",
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
      }}
    >
      <div
        style={{
          fontSize: 64 * scale,
          fontWeight: 700,
          lineHeight: 1.3,
          textShadow: "0 4px 24px rgba(0,0,0,0.45)",
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: `${0.28 * 64 * scale}px`,
        }}
      >
        {item.words && item.words.length > 0
          ? item.words.map((w, i) => {
              const active = i === activeIndex;
              return (
                <span
                  key={i}
                  style={{
                    color: active ? "#0f2027" : "#ffffff",
                    background: active ? "#ffd86b" : "transparent",
                    borderRadius: active ? 10 : 0,
                    padding: active ? "2px 12px" : "2px 0",
                    transform: active ? "scale(1.06)" : "scale(1)",
                    transition: "none",
                    display: "inline-block",
                  }}
                >
                  {w.text}
                </span>
              );
            })
          : <span style={{ color: "#ffffff" }}>{item.en}</span>}
      </div>

      {item.phonetic ? (
        <div
          style={{
            color: "#9fe3ff",
            fontSize: 32 * scale,
            marginTop: 24 * scale,
            fontStyle: "italic",
          }}
        >
          {item.phonetic}
        </div>
      ) : null}

      <div
        style={{
          color: "#ffd86b",
          fontSize: 40 * scale,
          fontWeight: 500,
          marginTop: 36 * scale,
          textShadow: "0 2px 16px rgba(0,0,0,0.45)",
        }}
      >
        {item.vi}
      </div>
    </AbsoluteFill>
  );
};
