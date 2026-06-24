import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";

/**
 * Thanh tiến trình của cảnh hiện tại. Đặt trong một <Series.Sequence>
 * nên frame và durationInFrames đã được tính theo từng cảnh.
 */
export const ProgressBar: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames, width } = useVideoConfig();
  const progress = Math.min(1, frame / durationInFrames);
  const isPortrait = width < 1200;

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: isPortrait ? 120 : 80,
        height: 8,
        margin: isPortrait ? "0 80px" : "0 160px",
        borderRadius: 999,
        background: "rgba(255,255,255,0.18)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${progress * 100}%`,
          height: "100%",
          background: "#ffd86b",
          borderRadius: 999,
        }}
      />
    </div>
  );
};
