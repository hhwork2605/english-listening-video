import React from "react";
import {
  AbsoluteFill,
  Audio,
  Img,
  Sequence,
  Video,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { Dialogue } from "../podcast/types";
import { turnDurationInFrames } from "../podcast/timing";

export type ReelDialogueListProps = {
  dialogue: Dialogue;
  /** Tiêu đề trên cùng (vd "Outside Tom's House"). "" để ẨN; bỏ trống -> dùng dialogue.topic. */
  header?: string;
  /** Emoji đứng trước tiêu đề. */
  headerEmoji?: string;
  /**
   * Preset giao diện:
   * - "classic" (mặc định): nền giấy + tên người nói tô màu + band tô sáng câu đang đọc.
   * - "storybook": giống các reel "Easy English Conversation" — ảnh cảnh hoạt hình
   *   trên cùng, KHÔNG hiện tên người nói (phân biệt bằng màu chữ cả câu, đen/đỏ),
   *   font serif đậm viền trắng trên nền hồng nhạt, không band tô sáng.
   */
  preset?: "classic" | "storybook";
  /** Ảnh cảnh (public/) hiện trên cùng, chia đều thời lượng nếu nhiều ảnh. Thường dùng với preset storybook. */
  sceneImages?: string[];
  /** VIDEO cảnh (public/, mp4/webm, tắt tiếng, tự lặp) — CHUYỂN ĐỘNG thật như các reel AI; ưu tiên hơn sceneImages. */
  sceneVideos?: string[];
  /**
   * Lượt thoại (index, 0-based) mà mỗi cảnh BẮT ĐẦU — cùng độ dài với sceneImages/sceneVideos,
   * phần tử đầu nên là 0 (vd [0,4,8,10]: cảnh 2 vào từ lượt 5...). Bỏ trống -> chia đều thời lượng.
   */
  sceneTurns?: number[];
  /** Chiều cao vùng ảnh cảnh (px, khung 1080×1920). */
  sceneHeight?: number;
  /** Hiện "Tên:" trước câu. Mặc định: classic có, storybook không. */
  showNames?: boolean;
  /** Cách nhấn câu đang đọc: band tô sáng hay không nhấn (storybook mặc định "none"). */
  highlightMode?: "band" | "none";
  /** Viền trắng quanh chữ (storybook mặc định bật). */
  textStroke?: boolean;
  /** Màu nền giấy. */
  background?: string;
  /** Màu chữ tiêu đề. */
  headerColor?: string;
  /** Màu nội dung câu (không phải tên người nói). */
  textColor?: string;
  /** Màu chữ CẢ CÂU theo speaker khi ẩn tên (vd {"A":"#1f1f1f","B":"#e0234e"}). */
  speakerColors?: Record<string, string>;
  /** Màu band tô sáng câu đang đọc. */
  highlightColor?: string;
  /** Font chữ nội dung. */
  fontFamily?: string;
  /** Logo watermark (public/). "" để tắt. */
  logo?: string;
};

// Bảng màu câu mặc định cho storybook khi ẩn tên (theo thứ tự speakers).
const STORYBOOK_TURN_COLORS = ["#1f1c1c", "#e0234e", "#1769aa", "#2e7d32"];

/**
 * Dạng A — "danh sách hội thoại đọc theo" (giống các reel luyện nghe phổ biến):
 * tiêu đề + TOÀN BỘ hội thoại dạng list, audio 2 giọng luân phiên từ dialogue.json —
 * tái dùng nguyên pipeline TTS/align/finalize. Hai preset: "classic" (nền giấy,
 * tên người nói, karaoke mức câu) và "storybook" (ảnh cảnh + câu tô màu theo người
 * nói, xem ReelDialogueListProps.preset).
 */
export const ReelDialogueList: React.FC<ReelDialogueListProps> = ({
  dialogue,
  header,
  headerEmoji = "👉",
  preset = "classic",
  sceneImages = [],
  sceneVideos = [],
  sceneTurns,
  sceneHeight = 640,
  showNames,
  highlightMode,
  textStroke,
  background,
  headerColor,
  textColor,
  speakerColors,
  highlightColor,
  fontFamily,
  logo = "logo.jpg",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const turns = dialogue.turns ?? [];

  const storybook = preset === "storybook";
  const bg = background ?? (storybook ? "#fdeaea" : "#fbf6e9");
  const hColor = headerColor ?? (storybook ? "#c2185b" : "#2e9d4f");
  const tColor = textColor ?? (storybook ? "#241d1d" : "#1c2b4a");
  const hlColor = highlightColor ?? "rgba(160, 200, 90, 0.35)";
  const names = showNames ?? !storybook;
  const hlMode = highlightMode ?? (storybook ? "none" : "band");
  const stroke = textStroke ?? storybook;
  const font =
    fontFamily ??
    (storybook
      ? '"Noto Serif", "PT Serif", Georgia, "Times New Roman", serif'
      : '"Baloo 2", "Nunito", "Segoe UI", system-ui, sans-serif');
  const speakerKeys = Object.keys(dialogue.speakers ?? {});

  // Mốc frame tuyệt đối của từng lượt -> xác định câu đang đọc.
  let acc = 0;
  const bounds = turns.map((turn) => {
    const dur = turnDurationInFrames(turn, fps);
    const b = { start: acc, end: acc + dur };
    acc += dur;
    return b;
  });
  const totalFrames = Math.max(1, acc);
  let activeIdx = -1;
  for (let i = 0; i < bounds.length; i++) {
    if (frame >= bounds[i].start && frame < bounds[i].end) {
      activeIdx = i;
      break;
    }
  }

  // Cỡ chữ tự co theo số lượt để đủ chỗ trong khung dọc (ảnh cảnh ăn bớt chiều cao).
  const n = turns.length;
  const hasSceneVideo = sceneVideos.length > 0;
  const hasScene = hasSceneVideo || sceneImages.length > 0;
  const fontSize = hasScene
    ? n <= 8 ? 50 : n <= 10 ? 45 : n <= 12 ? 40 : n <= 14 ? 36 : n <= 18 ? 31 : 26
    : n <= 12 ? 40 : n <= 16 ? 34 : n <= 20 ? 29 : 25;
  const gap = fontSize * (storybook ? 0.55 : 0.42);

  const headerText = (header ?? dialogue.topic ?? dialogue.title ?? "").toString();

  // Nhiều ảnh/clip cảnh: đổi cảnh theo sceneTurns (khớp lượt thoại) hoặc chia đều
  // thời lượng; ảnh tĩnh thêm zoom chậm (Ken Burns) trong mỗi khúc.
  const sceneCount = hasSceneVideo ? sceneVideos.length : sceneImages.length;
  const segFrames = totalFrames / Math.max(1, sceneCount);
  // Mốc frame bắt đầu của từng cảnh.
  const sceneStarts = Array.from({ length: sceneCount }, (_, i) => {
    const turnIdx = sceneTurns?.[i];
    return turnIdx !== undefined && bounds[turnIdx]
      ? bounds[turnIdx].start
      : Math.round(i * segFrames);
  });
  let sceneIdx = 0;
  for (let i = sceneCount - 1; i >= 0; i--) {
    if (frame >= sceneStarts[i]) {
      sceneIdx = i;
      break;
    }
  }
  const sceneEnd = sceneIdx + 1 < sceneCount ? sceneStarts[sceneIdx + 1] : totalFrames;
  const sceneZoom = hasScene && !hasSceneVideo
    ? interpolate(frame, [sceneStarts[sceneIdx], sceneEnd], [1, 1.07], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 1;

  const strokeStyle: React.CSSProperties = stroke
    ? { WebkitTextStroke: "8px #ffffff", paintOrder: "stroke fill" }
    : {};

  return (
    <AbsoluteFill style={{ backgroundColor: bg, fontFamily: font }}>
      {/* Ảnh / video cảnh trên cùng (tùy chọn). Clip tắt tiếng + tự lặp nếu ngắn hơn khúc của nó. */}
      {hasScene ? (
        <div style={{ height: sceneHeight, overflow: "hidden", flexShrink: 0, position: "relative" }}>
          {hasSceneVideo ? (
            sceneVideos.map((src, i) => (
              <Sequence
                key={src + i}
                from={sceneStarts[i]}
                durationInFrames={Math.max(1, (i + 1 < sceneCount ? sceneStarts[i + 1] : totalFrames) - sceneStarts[i])}
                layout="none"
              >
                <Video
                  src={staticFile(src)}
                  muted
                  loop
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                />
              </Sequence>
            ))
          ) : (
            <Img
              src={staticFile(sceneImages[sceneIdx])}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                transform: `scale(${sceneZoom})`,
              }}
            />
          )}
        </div>
      ) : null}

      {/* Tiêu đề ("" để ẩn) */}
      {headerText.trim() ? (
        <div
          style={{
            textAlign: "center",
            fontWeight: 900,
            color: hColor,
            fontSize: 52,
            padding: hasScene ? "24px 40px 0" : "40px 40px 10px",
            textShadow: "0 2px 0 rgba(0,0,0,0.06)",
            ...strokeStyle,
          }}
        >
          {headerEmoji ? `${headerEmoji} ` : ""}
          {headerText}
        </div>
      ) : null}

      {/* Danh sách hội thoại */}
      <div style={{ padding: "10px 52px 40px", display: "flex", flexDirection: "column", gap, justifyContent: "center", flex: 1 }}>
        {turns.map((turn, i) => {
          const sp = dialogue.speakers[turn.speaker];
          const active = i === activeIdx;
          const band = hlMode === "band";
          const pulse = active && band
            ? interpolate(frame - bounds[i].start, [0, 6], [0.6, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
            : 1;
          // Khi ẩn tên: cả câu tô màu theo người nói (như mẫu storybook đen/đỏ).
          const turnColor = names
            ? tColor
            : speakerColors?.[turn.speaker] ??
              STORYBOOK_TURN_COLORS[Math.max(0, speakerKeys.indexOf(turn.speaker)) % STORYBOOK_TURN_COLORS.length];
          return (
            <div
              key={turn.id}
              style={{
                background: active && band ? hlColor : "transparent",
                borderRadius: 14,
                padding: "6px 14px",
                fontSize,
                lineHeight: 1.28,
                fontWeight: 700,
                color: turnColor,
                wordSpacing: storybook ? "0.28em" : "normal",
                paddingLeft: names ? `calc(14px + 2.2em)` : 14,
                textIndent: names ? "-2.2em" : 0,
                opacity: band ? (activeIdx === -1 ? 1 : active ? 1 : 0.85) : 1,
                transform: band ? `scale(${active ? 0.6 + 0.4 * pulse + 0.02 : 1})` : undefined,
                transformOrigin: "left center",
                ...strokeStyle,
              }}
            >
              {names ? (
                <span style={{ color: sp?.color ?? "#333", fontWeight: 900, marginRight: 8 }}>
                  {sp?.name ?? turn.speaker}:
                </span>
              ) : null}
              {turn.en}
            </div>
          );
        })}
      </div>

      {/* Audio 2 giọng luân phiên — mỗi lượt phát đúng mốc frame của nó */}
      {turns.map((turn, i) =>
        turn.audio ? (
          <Sequence key={turn.id} from={bounds[i].start} durationInFrames={bounds[i].end - bounds[i].start}>
            <Audio src={staticFile(turn.audio)} />
          </Sequence>
        ) : null,
      )}

      {/* Logo watermark */}
      {logo ? (
        <Img
          src={staticFile(logo)}
          style={{
            position: "absolute",
            bottom: 26,
            right: 26,
            width: 92,
            height: 92,
            borderRadius: "50%",
            objectFit: "cover",
            border: "3px solid rgba(255,255,255,0.9)",
            boxShadow: "0 4px 14px rgba(0,0,0,0.25)",
            opacity: 0.6,
          }}
        />
      ) : null}
    </AbsoluteFill>
  );
};
