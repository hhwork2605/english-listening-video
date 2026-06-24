import React from "react";

type Props = {
  topic: string;
  level: string;
  isPortrait: boolean;
};

/** Tiêu đề chủ đề + badge cấp độ ở phần trên màn hình (giống thumbnail kênh). */
export const TopicHeader: React.FC<Props> = ({ topic, level, isPortrait }) => {
  return (
    <div
      style={{
        position: "absolute",
        top: isPortrait ? 90 : 56,
        left: 0,
        right: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 16,
        fontFamily: "system-ui, Segoe UI, Roboto, sans-serif",
      }}
    >
      <div
        style={{
          color: "#fff",
          fontSize: isPortrait ? 52 : 56,
          fontWeight: 800,
          letterSpacing: 0.3,
          textShadow: "0 4px 18px rgba(0,0,0,0.5)",
          textAlign: "center",
          padding: "0 60px",
        }}
      >
        {topic}
      </div>
      <div
        style={{
          background: "#ffd86b",
          color: "#0f2027",
          fontWeight: 800,
          fontSize: isPortrait ? 30 : 28,
          padding: "6px 22px",
          borderRadius: 999,
        }}
      >
        {level}
      </div>
    </div>
  );
};
