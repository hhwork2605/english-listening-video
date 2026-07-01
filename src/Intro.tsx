import React from "react";
import {
  AbsoluteFill,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

/**
 * Intro thương hiệu "THE ENGLISH NOOK" — tái dựng lại phong cách intro cũ
 * (giấy rách grunge cam/xám → huy hiệu tròn + vệt cọ → nền studio + tagline)
 * bằng thuần Remotion, KHÔNG dùng asset ngoài và KHÔNG có logo bên thứ ba.
 *
 * 3 pha (mặc định 6s @30fps = 180 frame):
 *   1) 0–78:   nền cam + giấy rách + chữ ENGLISH/LEARN/SPEAK/DAILY, pop "LEARN ENGLISH"
 *   2) 70–125: huy hiệu tròn trắng + vòng cọ cam + icon, hiện "THE ENGLISH NOOK"
 *   3) 118–180: nền studio sáng + vệt cọ sau chữ + tagline + hạt bokeh
 *
 * Đổi tên kênh/tagline/màu qua props (defaultProps trong Root.tsx hoặc --props).
 */
export type IntroProps = {
  channel?: string;
  tagline?: string;
  accent?: string;
};

const ACCENT = "#e07b2a";
const INK = "#3a3f45";
const PAPER = "#ece7dd";
const CHARCOAL = "#2b2b2b";

const FONT_DISPLAY = '"Arial Narrow", "Franklin Gothic Medium", Impact, "Segoe UI", sans-serif';

// Đốm mực splatter cố định (không random theo frame để khỏi nhấp nháy).
const SPLATTER: Array<[number, number, number]> = [
  [0.62, 0.18, 26], [0.7, 0.24, 12], [0.78, 0.15, 18], [0.85, 0.3, 9],
  [0.66, 0.36, 14], [0.74, 0.44, 20], [0.58, 0.5, 10], [0.8, 0.52, 16],
  [0.18, 0.72, 22], [0.28, 0.8, 12], [0.1, 0.83, 15], [0.36, 0.86, 9],
  [0.5, 0.78, 13], [0.44, 0.68, 8],
];

const Splatter: React.FC<{ opacity?: number }> = ({ opacity = 0.5 }) => (
  <AbsoluteFill style={{ opacity }}>
    {SPLATTER.map(([x, y, r], i) => (
      <div
        key={i}
        style={{
          position: "absolute",
          left: `${x * 100}%`,
          top: `${y * 100}%`,
          width: r,
          height: r,
          borderRadius: "50%",
          background: INK,
          filter: "blur(0.5px)",
        }}
      />
    ))}
  </AbsoluteFill>
);

// Lớp nhiễu giấy (grunge) bằng SVG feTurbulence — tự chứa, không cần ảnh.
const PaperNoise: React.FC<{ opacity?: number }> = ({ opacity = 0.12 }) => (
  <svg
    style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity, mixBlendMode: "multiply" }}
  >
    <filter id="paperNoise">
      <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} stitchTiles="stitch" />
    </filter>
    <rect width="100%" height="100%" filter="url(#paperNoise)" />
  </svg>
);

// Vệt cọ sơn (paint swipe) — một path blobby, tô ACCENT.
const BrushStroke: React.FC<{ width: number; height: number; color?: string; style?: React.CSSProperties }>
  = ({ width, height, color = ACCENT, style }) => (
  <svg viewBox="0 0 600 200" width={width} height={height} style={style}>
    <path
      d="M18 118 C 60 70, 150 60, 210 92 C 250 112, 300 78, 360 96 C 420 114, 470 82, 540 104 C 575 116, 588 132, 566 150 C 520 176, 430 150, 360 156 C 300 161, 250 176, 190 160 C 120 141, 70 168, 34 150 C 8 136, 4 130, 18 118 Z"
      fill={color}
    />
  </svg>
);

// Icon đường nét đơn giản quanh huy hiệu.
const RingIcon: React.FC<{ kind: "book" | "chat" | "head" | "mic"; size: number; color?: string }>
  = ({ kind, size, color = ACCENT }) => {
  const s = { width: size, height: size, stroke: color, strokeWidth: 6, fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (kind === "book")
    return (<svg viewBox="0 0 64 64" {...s}><path d="M32 16c-6-5-16-5-22-3v34c6-2 16-2 22 3 6-5 16-5 22-3V13c-6-2-16-2-22 3z" /><path d="M32 16v34" /></svg>);
  if (kind === "chat")
    return (<svg viewBox="0 0 64 64" {...s}><path d="M12 14h40v28H30l-12 10v-10h-6z" /></svg>);
  if (kind === "head")
    return (<svg viewBox="0 0 64 64" {...s}><path d="M14 38v-6a18 18 0 0 1 36 0v6" /><rect x="10" y="36" width="10" height="16" rx="4" /><rect x="44" y="36" width="10" height="16" rx="4" /></svg>);
  return (<svg viewBox="0 0 64 64" {...s}><rect x="24" y="10" width="16" height="28" rx="8" /><path d="M18 32a14 14 0 0 0 28 0" /><path d="M32 46v8" /><path d="M24 54h16" /></svg>);
};

// ---------- Pha 1: giấy rách + chữ ----------
const Phase1: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // Pop "LEARN ENGLISH" đúng cú nhấn mạnh nhất của nhạc (f33 ≈ 1.10s).
  const out = interpolate(frame, [74, 82], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const pop = spring({ frame: frame - 24, fps, config: { damping: 12, stiffness: 200, mass: 0.6 } });
  const popScale = interpolate(pop, [0, 1], [0.5, 1]);

  const ghosts: Array<[string, number, number, number]> = [
    ["ENGLISH", 3, 6, 120], ["LEARN", 4, 30, 150], ["SPEAK", 3, 55, 150],
    ["DAILY", 6, 82, 120], ["HELLO", 66, 22, 110], ["SPEAK", 72, 45, 120],
    ["DAILY", 74, 66, 130], ["PRACTICE", 60, 82, 90],
  ];

  return (
    <AbsoluteFill style={{ opacity: out, background: ACCENT, fontFamily: FONT_DISPLAY, overflow: "hidden" }}>
      <PaperNoise opacity={0.14} />
      {/* chữ chìm (đậm hơn nền) rải khắp */}
      {ghosts.map(([w, x, y, size], i) => (
        <div key={i} style={{ position: "absolute", left: `${x}%`, top: `${y}%`, fontSize: size, fontWeight: 900, letterSpacing: -2, color: "rgba(120,60,15,0.45)", textTransform: "uppercase" }}>{w}</div>
      ))}
      <Splatter opacity={0.55} />

      {/* dải giấy rách trắng trên & dưới (mép răng cưa) */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "22%", background: PAPER, clipPath: "polygon(0 0,100% 0,100% 62%,92% 78%,84% 66%,72% 84%,60% 70%,48% 88%,36% 72%,24% 86%,12% 70%,0 84%)" }}>
        <PaperNoise opacity={0.1} />
      </div>
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "24%", background: PAPER, clipPath: "polygon(0 40%,10% 24%,22% 40%,34% 22%,46% 38%,58% 20%,70% 38%,82% 24%,94% 40%,100% 28%,100% 100%,0 100%)" }}>
        <PaperNoise opacity={0.1} />
      </div>

      {/* pop trung tâm */}
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ transform: `scale(${popScale}) rotate(-3deg)`, textAlign: "center", color: "#fff", fontWeight: 900, fontSize: 190, lineHeight: 0.92, letterSpacing: -4, textTransform: "uppercase", textShadow: "0 10px 30px rgba(0,0,0,0.35)" }}>
          LEARN<br />ENGLISH
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ---------- Pha 2: huy hiệu ----------
const Phase2: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // Badge "slam" đúng cú whoosh f78 (≈2.60s); icon hiện theo cụm nhấn f96–102.
  const enter = interpolate(frame, [0, 6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const out = interpolate(frame, [44, 50], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const badge = spring({ frame, fps, config: { damping: 12, stiffness: 200, mass: 0.6 } });
  const badgeScale = interpolate(badge, [0, 1], [0.2, 1]);
  const ringRot = interpolate(frame, [0, 52], [-40, 20]);
  const iconIn = interpolate(frame, [24, 34], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const textIn = interpolate(frame, [8, 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const icons: Array<["book" | "chat" | "head" | "mic", number]> = [
    ["book", -90], ["chat", -20], ["mic", 50], ["head", 130],
  ];
  const R = 300;

  return (
    <AbsoluteFill style={{ opacity: enter * out, background: PAPER, fontFamily: FONT_DISPLAY, overflow: "hidden" }}>
      <PaperNoise opacity={0.13} />
      <Splatter opacity={0.35} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ position: "relative", width: 760, height: 760, transform: `scale(${badgeScale})` }}>
          {/* vòng cọ cam */}
          <div style={{ position: "absolute", inset: 90, borderRadius: "50%", border: `26px solid ${ACCENT}`, transform: `rotate(${ringRot}deg)`, filter: "blur(0.3px)", opacity: 0.92, borderRightColor: "rgba(224,123,42,0.35)", borderTopColor: "rgba(224,123,42,0.7)" }} />
          {/* icon quanh vòng */}
          {icons.map(([kind, deg], i) => {
            const rad = (deg * Math.PI) / 180;
            const x = 380 + R * Math.cos(rad) - 34;
            const y = 380 + R * Math.sin(rad) - 34;
            return (
              <div key={i} style={{ position: "absolute", left: x, top: y, opacity: iconIn }}>
                <RingIcon kind={kind} size={68} />
              </div>
            );
          })}
          {/* đĩa trắng giữa */}
          <div style={{ position: "absolute", inset: 210, borderRadius: "50%", background: "#fbfaf7", boxShadow: "0 18px 50px rgba(0,0,0,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ opacity: textIn, textAlign: "center", color: CHARCOAL, fontWeight: 900, fontSize: 58, lineHeight: 0.98, letterSpacing: 1, textTransform: "uppercase" }}>
              THE<br />ENGLISH<br />NOOK
            </div>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ---------- Pha 3: studio + tagline ----------
const BOKEH: Array<[number, number, number]> = [
  [0.12, 0.3, 10], [0.2, 0.6, 7], [0.08, 0.8, 12], [0.85, 0.25, 9],
  [0.9, 0.55, 6], [0.8, 0.75, 11], [0.5, 0.15, 8], [0.7, 0.85, 7],
];

const Phase3: React.FC<{ channel: string; tagline: string }> = ({ channel, tagline }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // Logo reveal đúng cú nhấn f121 (≈4.03s); tagline gõ chữ sau đó.
  const enter = interpolate(frame, [0, 6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const logo = spring({ frame: frame + 3, fps, config: { damping: 12, stiffness: 200, mass: 0.6 } });
  const logoY = interpolate(logo, [0, 1], [50, 0]);
  const logoScale = interpolate(logo, [0, 1], [0.85, 1]);
  const brushW = interpolate(frame, [8, 26], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const chars = Math.floor(interpolate(frame, [16, 44], [0, tagline.length], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));

  const lines = channel.toUpperCase().split(" ");

  return (
    <AbsoluteFill style={{ opacity: enter, fontFamily: FONT_DISPLAY, overflow: "hidden", background: "radial-gradient(120% 120% at 30% 20%, #f4f3f1 0%, #e6e5e2 55%, #d9d8d4 100%)" }}>
      {/* ánh sáng cửa sổ chéo */}
      <div style={{ position: "absolute", top: "-20%", left: "-10%", width: "55%", height: "90%", background: "linear-gradient(135deg, rgba(255,255,255,0.55), rgba(255,255,255,0))", transform: "rotate(8deg)" }} />
      {/* hạt bokeh */}
      {BOKEH.map(([x, y, r], i) => (
        <div key={i} style={{ position: "absolute", left: `${x * 100}%`, top: `${y * 100}%`, width: r * 3, height: r * 3, borderRadius: "50%", background: "rgba(224,123,42,0.35)", filter: "blur(4px)", opacity: interpolate(frame, [10 + i * 3, 40 + i * 3], [0, 0.9], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }} />
      ))}

      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ position: "relative", transform: `translateY(${logoY}px) scale(${logoScale})`, textAlign: "center" }}>
          {/* vệt cọ cam sau chữ */}
          <div style={{ position: "absolute", left: "50%", top: "44%", transform: `translate(-50%,-50%) scaleX(${brushW})`, transformOrigin: "left center", zIndex: 0 }}>
            <BrushStroke width={720} height={240} />
          </div>
          <div style={{ position: "relative", zIndex: 1, color: CHARCOAL, fontWeight: 900, fontSize: 150, lineHeight: 0.9, letterSpacing: -1, textTransform: "uppercase", textShadow: "0 6px 18px rgba(0,0,0,0.18)" }}>
            {lines.map((w, i) => (<div key={i}>{w}</div>))}
          </div>
          <div style={{ position: "relative", zIndex: 1, marginTop: 28, color: "#4a4a4a", fontWeight: 700, fontSize: 46, letterSpacing: 2, fontFamily: '"Segoe UI", system-ui, sans-serif' }}>
            {tagline.slice(0, chars)}
            <span style={{ opacity: chars < tagline.length ? 1 : 0 }}>|</span>
          </div>
        </div>
      </AbsoluteFill>
      {/* sparkle góc phải dưới */}
      <div style={{ position: "absolute", right: "12%", bottom: "18%", color: ACCENT, fontSize: 40, opacity: interpolate(frame, [30, 44], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>✦</div>
    </AbsoluteFill>
  );
};

export const Intro: React.FC<IntroProps> = ({
  channel = "The English Nook",
  tagline = "New Lesson Every Day",
}) => {
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {/* Mốc chuyển pha canh theo onset nhạc: pop f33, badge f78, logo f121. */}
      <Sequence from={0} durationInFrames={84} name="Phase 1 — paper">
        <Phase1 />
      </Sequence>
      <Sequence from={72} durationInFrames={52} name="Phase 2 — badge">
        <Phase2 />
      </Sequence>
      <Sequence from={116} durationInFrames={64} name="Phase 3 — studio">
        <Phase3 channel={channel} tagline={tagline} />
      </Sequence>
    </AbsoluteFill>
  );
};
