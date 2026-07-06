import React from "react";
import {
  AbsoluteFill,
  Audio,
  Img,
  Series,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { Reel as ReelData, ReelRole, ReelTurn } from "./types";
import type { WordTiming } from "../types";
import { turnDurationInFrames } from "../podcast/timing";
import { AudioWaveform, IdleWaveform } from "../components/AudioWaveform";

export type ReelProps = {
  reel: ReelData;
  /** Ảnh nền tĩnh (public/, vd "backgrounds/reel.png"). Bỏ trống -> nền gradient động. */
  backgroundImage?: string;
  /** Màu nhấn #RRGGBB. Ưu tiên prop > reel.accent > mặc định. */
  accent?: string;
  /** Logo kênh watermark góc phải dưới (public/). "" để tắt. */
  logo?: string;
};

const FONT = '"Montserrat", "Segoe UI", Roboto, system-ui, sans-serif';
const DEFAULT_ACCENT = "#ffd23f";

/* Mốc kết thúc highlight một từ — giống podcast Caption: nếu span dài bất thường
   (placeholder từ SAPI) thì chốt ~0.6s để tránh "dính sáng". */
const HL_MAX = 1.5;
const spokenEnd = (w: WordTiming): number => {
  const span = w.endSec - w.startSec;
  if (span <= 0) return w.startSec + 0.4;
  return span > HL_MAX ? w.startSec + 0.6 : w.endSec;
};

/* ------------------------------------------------------------------ */
/* Nền gradient động (khi không truyền ảnh) — luôn đổi nhẹ từng frame.  */
const ReelBackground: React.FC<{ accent: string; image?: string }> = ({ accent, image }) => {
  const frame = useCurrentFrame();
  if (image) {
    return <Img src={staticFile(image)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />;
  }
  const drift = Math.sin(frame / 70) * 8;
  const glow = 0.16 + 0.05 * Math.abs(Math.sin(frame / 40));
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(130% 70% at ${50 + drift}% 8%, ${accent}22 0%, #131b24 42%, #0a1015 100%)`,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: "58%",
          left: `${28 + drift}%`,
          width: 520,
          height: 520,
          borderRadius: "50%",
          background: accent,
          filter: "blur(120px)",
          opacity: glow,
        }}
      />
    </AbsoluteFill>
  );
};

/* Chip bo tròn (kicker / nhãn segment). */
const Pill: React.FC<{ children: React.ReactNode; accent: string; solid?: boolean }> = ({
  children,
  accent,
  solid,
}) => (
  <span
    style={{
      display: "inline-block",
      padding: "10px 26px",
      borderRadius: 999,
      fontSize: 30,
      fontWeight: 800,
      letterSpacing: 2,
      textTransform: "uppercase",
      color: solid ? "#0a1015" : accent,
      background: solid ? accent : "rgba(255,255,255,0.08)",
      border: `2px solid ${accent}`,
    }}
  >
    {children}
  </span>
);

/* Karaoke: highlight từng từ theo words[] (thời gian LOCAL của segment). */
const Karaoke: React.FC<{ turn: ReelTurn; size: number; accent: string }> = ({ turn, size, accent }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const words = turn.words ?? [];
  let active = -1;
  for (let i = 0; i < words.length; i++) {
    if (t >= words[i].startSec && t < spokenEnd(words[i])) {
      active = i;
      break;
    }
  }
  const base: React.CSSProperties = {
    fontSize: size,
    fontWeight: 800,
    lineHeight: 1.28,
    textAlign: "center",
    textShadow: "0 4px 22px rgba(0,0,0,0.55)",
  };
  if (words.length === 0) {
    return <div style={{ ...base, color: "#fff" }}>{turn.en}</div>;
  }
  return (
    <div
      style={{
        ...base,
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        gap: `${size * 0.26}px`,
      }}
    >
      {words.map((w, i) => (
        <span key={i} style={{ color: i === active ? accent : "#ffffff" }}>
          {w.text}
        </span>
      ))}
    </div>
  );
};

/* Nội dung trung tâm theo vai trò của lượt. */
const RoleCard: React.FC<{ turn: ReelTurn; reel: ReelData; accent: string }> = ({ turn, reel, accent }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 14, stiffness: 160, mass: 0.7 } });
  const y = interpolate(pop, [0, 1], [46, 0]);
  const op = interpolate(frame, [0, 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const role: ReelRole = turn.role ?? "example";

  let body: React.ReactNode;
  if (role === "hook") {
    body = (
      <div
        style={{
          fontSize: 84,
          fontWeight: 900,
          color: "#fff",
          textAlign: "center",
          lineHeight: 1.12,
          letterSpacing: -1,
          textShadow: "0 6px 26px rgba(0,0,0,0.6)",
        }}
      >
        {reel.hook || turn.en}
      </div>
    );
  } else if (role === "phrase") {
    body = (
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            fontSize: 96,
            fontWeight: 900,
            color: accent,
            lineHeight: 1.05,
            letterSpacing: -1,
            textTransform: "uppercase",
            textShadow: "0 8px 30px rgba(0,0,0,0.55)",
          }}
        >
          {reel.phrase || turn.en}
        </div>
        {reel.phonetic ? (
          <div style={{ marginTop: 20, fontSize: 40, fontWeight: 600, color: "rgba(255,255,255,0.7)" }}>
            {reel.phonetic}
          </div>
        ) : null}
      </div>
    );
  } else if (role === "cta") {
    body = (
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 72, marginBottom: 26 }}>🔔</div>
        <div style={{ display: "inline-block" }}>
          <Pill accent={accent} solid>
            {reel.cta || turn.en || "Follow for more"}
          </Pill>
        </div>
      </div>
    );
  } else {
    // meaning / example / tip: nhãn pill + nội dung
    const label = role === "meaning" ? "MEANING" : role === "tip" ? "TIP" : "EXAMPLE";
    body = (
      <div style={{ textAlign: "center" }}>
        <div style={{ marginBottom: 30 }}>
          <Pill accent={accent}>{label}</Pill>
        </div>
        <Karaoke turn={turn} size={role === "meaning" ? 58 : 62} accent={accent} />
      </div>
    );
  }

  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        justifyContent: "center",
        padding: "0 80px",
        fontFamily: FONT,
        transform: `translateY(${y}px)`,
        opacity: op,
      }}
    >
      {body}
    </AbsoluteFill>
  );
};

/**
 * Reel micro-lesson dọc (1080×1920): hook → phrase → meaning → example(s) → CTA.
 * Dùng CHUNG dialogue.json (turns có `role`). Tái dùng TTS/align/speed/finalize
 * y như podcast; chỉ khác phần hiển thị.
 */
export const Reel: React.FC<ReelProps> = ({ reel, backgroundImage, accent, logo = "logo.jpg" }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const AC = accent || reel.accent || DEFAULT_ACCENT;
  const turns = reel.turns ?? [];

  // Mốc frame tuyệt đối của từng lượt (để dock phrase + progress bar).
  let acc = 0;
  const bounds = turns.map((turn) => {
    const dur = turnDurationInFrames(turn, fps);
    const b = { start: acc, end: acc + dur, turn };
    acc += dur;
    return b;
  });
  const total = acc || 1;

  const phraseBounds = bounds.filter((b) => b.turn.role === "phrase");
  const phraseText = reel.phrase || phraseBounds[0]?.turn.en || "";
  // Dock phrase lên đầu sau khi segment phrase kết thúc.
  const dockAt = phraseBounds.length ? phraseBounds[phraseBounds.length - 1].end : -1;
  const bannerOp =
    dockAt >= 0 && phraseText
      ? interpolate(frame, [dockAt - 6, dockAt + 6], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 0;

  return (
    <AbsoluteFill style={{ backgroundColor: "#0a1015", fontFamily: FONT }}>
      <ReelBackground accent={AC} image={backgroundImage} />

      {/* Thanh tiến độ trên cùng */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 10, background: "rgba(255,255,255,0.08)" }}>
        <div style={{ height: "100%", width: `${(frame / total) * 100}%`, background: AC }} />
      </div>

      {/* Chip kicker */}
      <div style={{ position: "absolute", top: 70, left: 0, right: 0, textAlign: "center" }}>
        <Pill accent={AC} solid>
          {reel.kicker || "PHRASE OF THE DAY"}
        </Pill>
      </div>

      {/* Phrase dock (hiện sau khi đã giới thiệu) */}
      {phraseText ? (
        <div style={{ position: "absolute", top: 168, left: 0, right: 0, textAlign: "center", opacity: bannerOp }}>
          <div
            style={{
              fontSize: 62,
              fontWeight: 900,
              color: AC,
              letterSpacing: 0,
              textTransform: "uppercase",
              textShadow: "0 6px 22px rgba(0,0,0,0.5)",
            }}
          >
            {phraseText}
          </div>
        </div>
      ) : null}

      {/* Các segment: audio + nội dung + sóng âm */}
      <Series>
        {turns.map((turn) => (
          <Series.Sequence key={turn.id} durationInFrames={turnDurationInFrames(turn, fps)}>
            {turn.audio ? <Audio src={staticFile(turn.audio)} /> : null}
            <RoleCard turn={turn} reel={reel} accent={AC} />
            <div style={{ position: "absolute", left: 0, right: 0, bottom: 220, display: "flex", justifyContent: "center" }}>
              {turn.audio ? (
                <AudioWaveform src={turn.audio} color={AC} maxHeight={70} width={520} bars={40} barWidth={5} />
              ) : (
                <IdleWaveform color={AC} maxHeight={70} width={520} bars={40} barWidth={5} />
              )}
            </div>
          </Series.Sequence>
        ))}
      </Series>

      {/* Logo watermark góc phải dưới (đồng bộ podcast/thumbnail) */}
      {logo ? (
        <Img
          src={staticFile(logo)}
          style={{
            position: "absolute",
            bottom: 28,
            right: 28,
            width: 96,
            height: 96,
            borderRadius: "50%",
            objectFit: "cover",
            border: "3px solid rgba(255,255,255,0.85)",
            boxShadow: "0 4px 14px rgba(0,0,0,0.35)",
            opacity: 0.55,
          }}
        />
      ) : null}
    </AbsoluteFill>
  );
};
