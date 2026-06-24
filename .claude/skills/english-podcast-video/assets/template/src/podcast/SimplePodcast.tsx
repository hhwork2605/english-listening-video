import React from "react";
import { AbsoluteFill, Audio, Img, Series, staticFile, useVideoConfig } from "remotion";
import type { Dialogue } from "./types";
import { turnDurationInFrames } from "./timing";
import { Caption } from "./components/Caption";
import { AudioWaveform, IdleWaveform } from "../components/AudioWaveform";

export type SimplePodcastProps = {
  dialogue: Dialogue;
  /** Ảnh nền tĩnh xuyên suốt, trong public/ (vd "backgrounds/scene.png"). */
  backgroundImage?: string;
  /** Màu dải sóng âm. */
  waveColor?: string;
  bgm?: string;
  bgmVolume?: number;
};

/** Nền dự phòng khi chưa có ảnh — gợi nhắc người dùng thả ảnh studio vào. */
const FallbackBackground: React.FC = () => (
  <AbsoluteFill
    style={{
      background: "linear-gradient(135deg, #16222a 0%, #1d2d38 55%, #24323d 100%)",
      alignItems: "center",
      justifyContent: "flex-end",
      paddingBottom: 40,
    }}
  >
    <div style={{ color: "rgba(255,255,255,0.28)", fontSize: 24, fontFamily: "system-ui" }}>
      Đặt ảnh studio vào public/ và truyền backgroundImage để dùng làm nền cố định
    </div>
  </AbsoluteFill>
);

/**
 * Định dạng kênh: MỘT ảnh tĩnh xuyên suốt + sóng âm + transcript tiếng Anh.
 * Không avatar/badge/tiếng Việt — audio vẫn là hội thoại 2 giọng từ dialogue.json.
 */
export const SimplePodcast: React.FC<SimplePodcastProps> = ({
  dialogue,
  backgroundImage,
  waveColor = "#d7e7f0",
  bgm,
  bgmVolume = 0.08,
}) => {
  const { fps, width } = useVideoConfig();
  const isPortrait = width < 1200;

  return (
    <AbsoluteFill style={{ backgroundColor: "#0b141a" }}>
      {backgroundImage ? (
        <Img
          src={staticFile(backgroundImage)}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        <FallbackBackground />
      )}

      {bgm ? <Audio src={staticFile(bgm)} volume={bgmVolume} loop /> : null}

      <Series>
        {dialogue.turns.map((turn) => (
          <Series.Sequence key={turn.id} durationInFrames={turnDurationInFrames(turn, fps)}>
            {turn.audio ? <Audio src={staticFile(turn.audio)} /> : null}

            <Caption turn={turn} isPortrait={isPortrait} />

            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: isPortrait ? "40%" : "64%",
                display: "flex",
                justifyContent: "center",
              }}
            >
              {turn.audio ? (
                <AudioWaveform
                  src={turn.audio}
                  color={waveColor}
                  maxHeight={isPortrait ? 70 : 80}
                  width={isPortrait ? 520 : 560}
                  bars={isPortrait ? 40 : 48}
                  barWidth={5}
                />
              ) : (
                <IdleWaveform
                  color={waveColor}
                  maxHeight={isPortrait ? 70 : 80}
                  width={isPortrait ? 520 : 560}
                  bars={isPortrait ? 40 : 48}
                  barWidth={5}
                />
              )}
            </div>
          </Series.Sequence>
        ))}
      </Series>
    </AbsoluteFill>
  );
};
