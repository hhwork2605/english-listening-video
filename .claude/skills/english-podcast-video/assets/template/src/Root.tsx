import React from "react";
import { Composition } from "remotion";
import { ListeningVideo } from "./ListeningVideo";
import { totalDurationInFrames } from "./timing";
import type { Script } from "./types";
import scriptJson from "../data/script.json";
import { SimplePodcast } from "./podcast/SimplePodcast";
import { totalDialogueFrames } from "./podcast/timing";
import type { Dialogue } from "./podcast/types";
import dialogueJson from "../data/dialogue.json";
import { Thumbnail } from "./Thumbnail";

const script = scriptJson as Script;
const fps = script.fps ?? 30;
const durationInFrames = Math.max(1, totalDurationInFrames(script));

const dialogue = dialogueJson as Dialogue;
const podcastFps = dialogue.fps ?? 30;
const podcastFrames = Math.max(1, totalDialogueFrames(dialogue));

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* YouTube ngang */}
      <Composition
        id="LandscapeVideo"
        component={ListeningVideo}
        durationInFrames={durationInFrames}
        fps={fps}
        width={1920}
        height={1080}
        defaultProps={{
          script,
          subtitleScale: 1,
          // bgm: "bgm/lofi.mp3",
        }}
      />

      {/* Shorts / TikTok dọc — dùng chung dữ liệu, chỉ đổi khung & cỡ chữ */}
      <Composition
        id="PortraitVideo"
        component={ListeningVideo}
        durationInFrames={durationInFrames}
        fps={fps}
        width={1080}
        height={1920}
        defaultProps={{
          script,
          subtitleScale: 0.9,
          // bgm: "bgm/lofi.mp3",
        }}
      />

      {/* Podcast kiểu kênh: 1 ảnh tĩnh xuyên suốt + sóng âm + transcript (EN) */}
      <Composition
        id="Podcast"
        component={SimplePodcast}
        durationInFrames={podcastFrames}
        fps={podcastFps}
        width={1920}
        height={1080}
        defaultProps={{
          dialogue,
          // backgroundImage truyền qua --props lúc render (xem quy trình project)
        }}
      />
      <Composition
        id="PodcastVertical"
        component={SimplePodcast}
        durationInFrames={podcastFrames}
        fps={podcastFps}
        width={1080}
        height={1920}
        defaultProps={{
          dialogue,
          // backgroundImage: "backgrounds/scene-vertical.png",
        }}
      />

      {/* Thumbnail YouTube 1280x720 — render bằng: npm run render:thumbnail */}
      <Composition
        id="Thumbnail"
        component={Thumbnail}
        durationInFrames={1}
        fps={podcastFps}
        width={1280}
        height={720}
        defaultProps={{
          dialogue,
          kicker: "TALK ABOUT",
          channel: "ENGLISH PODCAST",
          // title + backgroundImage truyền qua --props lúc render
        }}
      />
    </>
  );
};
