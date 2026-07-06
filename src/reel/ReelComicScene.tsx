import React from "react";
import {
  AbsoluteFill,
  Audio,
  Img,
  Sequence,
  Series,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { Dialogue, DialogueTurn } from "../podcast/types";
import { turnDurationInFrames } from "../podcast/timing";

/**
 * Vị trí ĐỈNH ĐẦU mỗi nhân vật (%) để neo bong bóng — mũi bong bóng chỉ tới điểm
 * này. Tinh chỉnh theo từng ảnh cảnh (đầu 2 người thường cao thấp khác nhau).
 */
export type HeadAnchors = {
  leftXPct: number;
  leftYPct: number;
  rightXPct: number;
  rightYPct: number;
};

export type ReelComicSceneProps = {
  dialogue: Dialogue;
  /** Ảnh cảnh tĩnh (public/, vd "backgrounds/reception.png"). Bỏ trống -> nền gradient nhắc. */
  backgroundImage?: string;
  /** Màu nhấn (viền bong bóng active theo speaker.color; cái này cho end-card). */
  accent?: string;
  /** Hiện end-card "Subscribe" ở cuối. */
  endcard?: boolean;
  /** Logo watermark (public/). "" để tắt. */
  logo?: string;
  /** Vị trí đầu 2 nhân vật để neo bong bóng (tùy ảnh cảnh). */
  heads?: HeadAnchors;
};

const DEFAULT_HEADS: HeadAnchors = { leftXPct: 24, leftYPct: 45, rightXPct: 77, rightYPct: 50 };

const FONT = '"Nunito", "Baloo 2", "Segoe UI", system-ui, sans-serif';

const SceneFallback: React.FC = () => (
  <AbsoluteFill
    style={{
      background: "linear-gradient(160deg, #cfe8ff 0%, #eaf6ff 50%, #d7f0e6 100%)",
      alignItems: "center",
      justifyContent: "flex-end",
      paddingBottom: 60,
    }}
  >
    <div style={{ color: "rgba(0,0,0,0.35)", fontSize: 30, fontFamily: FONT, textAlign: "center", padding: "0 60px" }}>
      Đặt ảnh cảnh vào public/ và truyền backgroundImage
    </div>
  </AbsoluteFill>
);

/**
 * Bong bóng thoại — neo NGAY TRÊN ĐẦU người đang nói: điểm neo = đầu nhân vật
 * (heads), bong bóng dựng LÊN TRÊN neo (translateY -100%), mũi nhọn chỉ XUỐNG đầu.
 * Nảy lên khi lượt bắt đầu.
 */
const TAIL_OFFSET = 50; // khoảng cách mũi bong bóng tới mép bong bóng (px)
const HEAD_LIFT = 88; // nâng bong bóng cao hơn đầu để cách ra một chút (px)
const SpeechBubble: React.FC<{ turn: DialogueTurn; side: "left" | "right"; heads: HeadAnchors }> = ({
  turn,
  side,
  heads,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 13, stiffness: 180, mass: 0.6 } });
  const scale = interpolate(pop, [0, 1], [0.5, 1]);
  const op = interpolate(frame, [0, 5], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const anchorX = side === "left" ? heads.leftXPct : heads.rightXPct;
  const anchorY = side === "left" ? heads.leftYPct : heads.rightYPct;
  // Chữ đủ lớn; chỉ giảm nhẹ khi câu dài để giữ gọn 1–2 dòng.
  const fontSize = turn.en.length > 40 ? 46 : 54;

  // Neo TRÁI bằng `left`, PHẢI bằng `right` để chiều rộng khả dụng luôn nới về phía
  // giữa màn hình (nếu bên phải mà dùng `left:80%` thì chỉ còn 20% -> chữ dồn dòng).
  const lift = `calc(-100% - ${HEAD_LIFT}px)`;
  const posStyle: React.CSSProperties =
    side === "left"
      ? {
          left: `${anchorX}%`,
          transform: `translate(-${TAIL_OFFSET}px, ${lift}) scale(${scale})`,
          transformOrigin: `${TAIL_OFFSET}px bottom`,
        }
      : {
          right: `${100 - anchorX}%`,
          transform: `translate(${TAIL_OFFSET}px, ${lift}) scale(${scale})`,
          transformOrigin: `calc(100% - ${TAIL_OFFSET}px) bottom`,
        };

  return (
    <div
      style={{
        position: "absolute",
        top: `${anchorY}%`,
        // chỉ maxWidth => bong bóng tự co theo chữ, xuống dòng khi chạm giới hạn
        maxWidth: "68%",
        opacity: op,
        ...posStyle,
      }}
    >
      <div
        style={{
          position: "relative",
          background: "#ffffff",
          borderRadius: 34,
          padding: "26px 38px",
          fontSize,
          fontWeight: 800,
          lineHeight: 1.24,
          color: "#141b26",
          fontFamily: FONT,
          textAlign: "center",
          boxShadow: "0 10px 30px rgba(0,0,0,0.22)",
          border: "3px solid rgba(0,0,0,0.06)",
        }}
      >
        {turn.en}
        {/* mũi bong bóng chỉ xuống đầu người nói */}
        <div
          style={{
            position: "absolute",
            bottom: -24,
            left: side === "left" ? TAIL_OFFSET - 20 : "auto",
            right: side === "right" ? TAIL_OFFSET - 20 : "auto",
            width: 0,
            height: 0,
            borderLeft: "20px solid transparent",
            borderRight: "20px solid transparent",
            borderTop: "28px solid #ffffff",
          }}
        />
      </div>
    </div>
  );
};

/** End-card nút Subscribe (nền trắng, giống các reel ESL). */
const SubscribeCard: React.FC<{ accent: string }> = ({ accent }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 12, stiffness: 200, mass: 0.6 } });
  const scale = interpolate(pop, [0, 1], [0.7, 1]);
  return (
    <AbsoluteFill style={{ background: "#ffffff", alignItems: "center", justifyContent: "center", fontFamily: FONT }}>
      <div style={{ position: "relative", transform: `scale(${scale})`, display: "flex", alignItems: "center", gap: 18, background: "#ff0000", color: "#fff", padding: "28px 54px", borderRadius: 18, boxShadow: "0 12px 28px rgba(255,0,0,0.35)" }}>
        <div style={{ width: 0, height: 0, borderTop: "22px solid transparent", borderBottom: "22px solid transparent", borderLeft: "34px solid #fff" }} />
        <span style={{ fontSize: 68, fontWeight: 900, letterSpacing: -1 }}>Subscribe</span>
        <span style={{ position: "absolute", right: 30, bottom: -30, fontSize: 70 }}>👆</span>
      </div>
    </AbsoluteFill>
  );
};

/**
 * Dạng B — "cảnh hoạt hình tĩnh + bong bóng thoại": một ảnh cảnh giữ nguyên suốt
 * video, bong bóng đổi câu theo từng lượt (mũi về phía người nói theo speakers[].side),
 * kết bằng end-card Subscribe. Audio 2 giọng từ dialogue.json.
 * Thời lượng composition = tổng lượt + endcard (đặt trong Root.tsx).
 */
export const ReelComicScene: React.FC<ReelComicSceneProps> = ({
  dialogue,
  backgroundImage,
  accent = "#ff3b3b",
  endcard = true,
  logo = "logo.jpg",
  heads,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const turns = dialogue.turns ?? [];
  const HEADS = heads ?? DEFAULT_HEADS;

  const dialogueFrames = turns.reduce((s, t) => s + turnDurationInFrames(t, fps), 0);
  const inEndcard = endcard && frame >= dialogueFrames && durationInFrames > dialogueFrames;

  if (inEndcard) {
    return (
      <AbsoluteFill>
        <Sequence from={dialogueFrames}>
          <SubscribeCard accent={accent} />
        </Sequence>
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill style={{ backgroundColor: "#eaf6ff" }}>
      {backgroundImage ? (
        <Img src={staticFile(backgroundImage)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <SceneFallback />
      )}

      <Series>
        {turns.map((turn) => {
          const side = dialogue.speakers[turn.speaker]?.side ?? "left";
          return (
            <Series.Sequence key={turn.id} durationInFrames={turnDurationInFrames(turn, fps)}>
              {turn.audio ? <Audio src={staticFile(turn.audio)} /> : null}
              <SpeechBubble turn={turn} side={side} heads={HEADS} />
            </Series.Sequence>
          );
        })}
      </Series>

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

/** Số frame end-card mặc định (~1.4s @30fps) — Root cộng vào thời lượng composition. */
export const ENDCARD_FRAMES = 42;
