import React from "react";
import { AbsoluteFill, Audio, Series, staticFile, useVideoConfig } from "remotion";
import type { Script } from "./types";
import { sceneDurationInFrames } from "./timing";
import { SentenceScene } from "./components/SentenceScene";

export type ListeningVideoProps = {
  script: Script;
  /** Cỡ chữ phụ đề (dọc thường để nhỏ hơn). */
  subtitleScale?: number;
  /** Nhạc nền tùy chọn, đặt trong public/bgm/... */
  bgm?: string;
  /** Âm lượng nhạc nền (0..1). */
  bgmVolume?: number;
};

export const ListeningVideo: React.FC<ListeningVideoProps> = ({
  script,
  subtitleScale = 1,
  bgm,
  bgmVolume = 0.12,
}) => {
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {bgm ? (
        <Audio src={staticFile(bgm)} volume={bgmVolume} loop />
      ) : null}

      <Series>
        {script.items.map((item) => (
          <Series.Sequence
            key={item.id}
            durationInFrames={sceneDurationInFrames(item, fps)}
          >
            <SentenceScene item={item} subtitleScale={subtitleScale} />
          </Series.Sequence>
        ))}
      </Series>
    </AbsoluteFill>
  );
};
