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
import { Intro } from "./Intro";
import { Reel } from "./reel/Reel";
import type { Reel as ReelData } from "./reel/types";
import { ReelDialogueList } from "./reel/ReelDialogueList";
import { ReelComicScene, ENDCARD_FRAMES } from "./reel/ReelComicScene";

const script = scriptJson as Script;
const fps = script.fps ?? 30;
const durationInFrames = Math.max(1, totalDurationInFrames(script));

const dialogue = dialogueJson as Dialogue;
const podcastFps = dialogue.fps ?? 30;
const podcastFrames = Math.max(1, totalDialogueFrames(dialogue));

// Reel micro-lesson dùng chung data/dialogue.json (Reel là superset của Dialogue).
const reel = dialogueJson as ReelData;
const reelFps = reel.fps ?? 30;
const reelFrames = Math.max(1, totalDialogueFrames(reel));

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

      {/* Reel micro-lesson dọc 1080×1920 (Shorts/TikTok) — 1 idiom/phrase mỗi video */}
      <Composition
        id="Reel"
        component={Reel}
        durationInFrames={reelFrames}
        fps={reelFps}
        width={1080}
        height={1920}
        defaultProps={{
          reel,
          // backgroundImage + accent truyền qua --props lúc render (tùy chọn)
        }}
      />

      {/* Reel dạng A — danh sách hội thoại đọc theo (nền trơn + tô sáng câu) */}
      <Composition
        id="ReelDialogueList"
        component={ReelDialogueList}
        durationInFrames={podcastFrames}
        fps={podcastFps}
        width={1080}
        height={1920}
        // dialogue truyền được qua --props để render không phụ thuộc buffer data/
        // (nhiều phiên song song đè nhau data/dialogue.json) → duration tính theo props
        calculateMetadata={({ props }) => ({
          durationInFrames: Math.max(1, totalDialogueFrames(props.dialogue)),
          fps: props.dialogue.fps ?? 30,
        })}
        defaultProps={{
          dialogue,
          // header / background / accent truyền qua --props (tùy chọn)
        }}
      />

      {/* Reel dạng B — cảnh hoạt hình tĩnh + bong bóng thoại + end-card Subscribe */}
      <Composition
        id="ReelComicScene"
        component={ReelComicScene}
        durationInFrames={podcastFrames + ENDCARD_FRAMES}
        fps={podcastFps}
        width={1080}
        height={1920}
        // dialogue truyền được qua --props để render không phụ thuộc buffer data/
        // (nhiều phiên song song đè nhau data/dialogue.json) → duration tính theo props
        calculateMetadata={({ props }) => ({
          durationInFrames:
            Math.max(1, totalDialogueFrames(props.dialogue)) + ENDCARD_FRAMES,
          fps: props.dialogue.fps ?? 30,
        })}
        defaultProps={{
          dialogue,
          // backgroundImage (ảnh cảnh) truyền qua --props
        }}
      />

      {/* Intro thương hiệu 6s (tự dựng, không logo bên thứ ba) */}
      <Composition
        id="Intro"
        component={Intro}
        durationInFrames={180}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          channel: "The English Nook",
          tagline: "New Lesson Every Day",
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
