import React from "react";
import { Img, staticFile, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { SpeakerInfo } from "../types";

type Props = {
  info: SpeakerInfo;
  active: boolean;
  /** Frame cục bộ tính từ lúc lượt nói bắt đầu (để nảy nhẹ khi tới lượt). */
  enterFrame: number;
  size?: number;
};

/**
 * Một nhân vật. Khi đang nói thì sáng + nhỉnh hơn + có quầng theo màu speaker;
 * khi không nói thì mờ và nhỏ lại để mắt người xem dồn về người đang nói.
 * Nếu có ảnh trong public/characters thì dùng ảnh, không thì vẽ avatar chữ cái.
 */
export const Speaker: React.FC<Props> = ({ info, active, enterFrame, size = 360 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const pop = active
    ? spring({ frame: Math.max(0, frame - enterFrame), fps, config: { damping: 12 }, durationInFrames: 18 })
    : 0;
  const scale = (active ? 1 : 0.86) + pop * 0.04;
  const opacity = active ? 1 : 0.55;
  const glow = active ? `0 0 0 8px ${info.color}55, 0 24px 60px rgba(0,0,0,0.45)` : "0 12px 30px rgba(0,0,0,0.35)";

  const initial = info.name.trim().charAt(0).toUpperCase();

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        transform: `scale(${scale})`,
        opacity,
        transition: "none",
      }}
    >
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          overflow: "hidden",
          background: `linear-gradient(160deg, ${info.color}, #1b2733)`,
          boxShadow: glow,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {info.image ? (
          <Img
            src={staticFile(info.image)}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <span style={{ color: "#fff", fontSize: size * 0.42, fontWeight: 800 }}>
            {initial}
          </span>
        )}
      </div>

      <div
        style={{
          marginTop: 22,
          padding: "8px 26px",
          borderRadius: 999,
          background: active ? info.color : "rgba(255,255,255,0.14)",
          color: active ? "#0f2027" : "#e7eef2",
          fontSize: size * 0.1,
          fontWeight: 700,
          fontFamily: "system-ui, Segoe UI, Roboto, sans-serif",
        }}
      >
        {info.name}
      </div>
    </div>
  );
};
