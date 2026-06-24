import React from "react";
import {
  AbsoluteFill,
  Audio,
  Series,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { Dialogue, SpeakerId } from "./types";
import { turnDurationInFrames } from "./timing";
import { Background } from "../components/Background";
import { Speaker } from "./components/Speaker";
import { TopicHeader } from "./components/TopicHeader";
import { DialogueLine } from "./components/DialogueLine";
import { AudioWaveform, IdleWaveform } from "../components/AudioWaveform";

export type PodcastVideoProps = {
  dialogue: Dialogue;
  bgm?: string;
  bgmVolume?: number;
};

const cumulativeStarts = (d: Dialogue, fps: number): number[] => {
  const starts: number[] = [];
  let acc = 0;
  for (const turn of d.turns) {
    starts.push(acc);
    acc += turnDurationInFrames(turn, fps);
  }
  return starts;
};

/** Sân khấu thường trực: header + 2 nhân vật, người đang nói được làm nổi bật. */
const Stage: React.FC<{ dialogue: Dialogue; starts: number[]; isPortrait: boolean }> = ({
  dialogue,
  starts,
  isPortrait,
}) => {
  const frame = useCurrentFrame();

  let idx = 0;
  for (let i = 0; i < starts.length; i++) if (frame >= starts[i]) idx = i;
  const activeSpeaker: SpeakerId = dialogue.turns[idx].speaker;
  const enterFrame = starts[idx];

  const ids = Object.keys(dialogue.speakers) as SpeakerId[];
  const leftId = ids.find((id) => dialogue.speakers[id].side === "left") ?? ids[0];
  const rightId = ids.find((id) => dialogue.speakers[id].side === "right") ?? ids[1];
  const size = isPortrait ? 280 : 360;

  return (
    <>
      <TopicHeader topic={dialogue.topic} level={dialogue.level} isPortrait={isPortrait} />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: isPortrait ? 360 : 250,
          display: "flex",
          justifyContent: "space-evenly",
          alignItems: "center",
        }}
      >
        <Speaker
          info={dialogue.speakers[leftId]}
          active={activeSpeaker === leftId}
          enterFrame={enterFrame}
          size={size}
        />
        <Speaker
          info={dialogue.speakers[rightId]}
          active={activeSpeaker === rightId}
          enterFrame={enterFrame}
          size={size}
        />
      </div>
    </>
  );
};

export const PodcastVideo: React.FC<PodcastVideoProps> = ({
  dialogue,
  bgm,
  bgmVolume = 0.08,
}) => {
  const { fps, width } = useVideoConfig();
  const isPortrait = width < 1200;
  const starts = cumulativeStarts(dialogue, fps);

  return (
    <AbsoluteFill style={{ backgroundColor: "#0b141a" }}>
      <Background />
      {bgm ? <Audio src={staticFile(bgm)} volume={bgmVolume} loop /> : null}

      <Stage dialogue={dialogue} starts={starts} isPortrait={isPortrait} />

      <Series>
        {dialogue.turns.map((turn) => {
          const color = dialogue.speakers[turn.speaker].color;
          return (
            <Series.Sequence key={turn.id} durationInFrames={turnDurationInFrames(turn, fps)}>
              {turn.audio ? <Audio src={staticFile(turn.audio)} /> : null}

              <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center" }}>
                <div style={{ marginBottom: isPortrait ? 470 : 330 }}>
                  {turn.audio ? (
                    <AudioWaveform
                      src={turn.audio}
                      color={color}
                      maxHeight={isPortrait ? 70 : 84}
                      width={isPortrait ? 520 : 760}
                      bars={isPortrait ? 28 : 36}
                    />
                  ) : (
                    <IdleWaveform
                      color={color}
                      maxHeight={isPortrait ? 70 : 84}
                      width={isPortrait ? 520 : 760}
                      bars={isPortrait ? 28 : 36}
                    />
                  )}
                </div>
              </AbsoluteFill>

              <DialogueLine
                turn={turn}
                speaker={dialogue.speakers[turn.speaker]}
                isPortrait={isPortrait}
              />
            </Series.Sequence>
          );
        })}
      </Series>
    </AbsoluteFill>
  );
};
