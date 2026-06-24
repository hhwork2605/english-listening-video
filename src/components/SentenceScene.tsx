import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile, useVideoConfig } from "remotion";
import type { ScriptItem } from "../types";
import { roundDurationInFrames } from "../timing";
import { Background } from "./Background";
import { Subtitle } from "./Subtitle";
import { ProgressBar } from "./ProgressBar";
import { AudioWaveform, IdleWaveform } from "./AudioWaveform";

type Props = {
  item: ScriptItem;
  subtitleScale?: number;
};

/**
 * Một cảnh = một câu. Phát audio `repeat` lần, mỗi lần một <Sequence>,
 * kèm phụ đề và thanh tiến trình. Nếu item.audio rỗng thì chạy không tiếng
 * (tiện cho việc preview trước khi có file TTS).
 */
export const SentenceScene: React.FC<Props> = ({ item, subtitleScale = 1 }) => {
  const { fps, width } = useVideoConfig();
  const roundFrames = roundDurationInFrames(item, fps);
  const isPortrait = width < 1200;

  return (
    <AbsoluteFill>
      <Background />

      {item.audio
        ? Array.from({ length: Math.max(1, item.repeat) }).map((_, i) => (
            <Sequence
              key={i}
              from={i * roundFrames}
              durationInFrames={roundFrames}
            >
              <Audio src={staticFile(item.audio)} />
            </Sequence>
          ))
        : null}

      <Subtitle
        item={item}
        scale={subtitleScale}
        roundFrames={roundFrames}
        repeatCount={Math.max(1, item.repeat)}
      />

      <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center" }}>
        <div style={{ marginBottom: isPortrait ? 200 : 140 }}>
          {item.audio ? (
            <AudioWaveform
              src={item.audio}
              maxHeight={isPortrait ? 64 : 76}
              width={isPortrait ? 520 : 720}
              bars={isPortrait ? 28 : 36}
            />
          ) : (
            <IdleWaveform
              maxHeight={isPortrait ? 64 : 76}
              width={isPortrait ? 520 : 720}
              bars={isPortrait ? 28 : 36}
            />
          )}
        </div>
      </AbsoluteFill>

      <ProgressBar />
    </AbsoluteFill>
  );
};
