import React from "react";
import { staticFile, random, useCurrentFrame, useVideoConfig } from "remotion";
import { useAudioData, visualizeAudio } from "@remotion/media-utils";

type BarsProps = {
  heights: number[]; // 0..1
  color: string;
  maxHeight: number;
  width: number | string;
  barWidth?: number;
};

/** Phần hiển thị các thanh sóng. Đối xứng nhẹ, bo tròn. */
const WaveBars: React.FC<BarsProps> = ({ heights, color, maxHeight, width, barWidth = 6 }) => {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: barWidth * 0.9,
        width,
        height: maxHeight,
      }}
    >
      {heights.map((h, i) => (
        <div
          key={i}
          style={{
            width: barWidth,
            height: Math.max(barWidth, h * maxHeight),
            background: color,
            borderRadius: barWidth,
            opacity: 0.9,
          }}
        />
      ))}
    </div>
  );
};

/** Chuyển động nền liên tục (deterministic) để video luôn có thay đổi từng frame. */
const idleHeights = (frame: number, fps: number, bars: number): number[] => {
  const t = frame / fps;
  return Array.from({ length: bars }, (_, i) => {
    const phase = random(`wf-${i}`) * Math.PI * 2;
    const speed = 2.2 + random(`wf-s-${i}`) * 2.5;
    return 0.16 + 0.12 * Math.abs(Math.sin(t * speed + phase));
  });
};

type Props = {
  /** File audio trong public/ (vd "audio/d001.wav"). Bỏ trống -> chỉ chuyển động nền. */
  src?: string;
  color?: string;
  bars?: number;
  maxHeight?: number;
  width?: number | string;
  barWidth?: number;
};

/** Sóng âm phản ứng theo audio đang phát, cộng với một sàn chuyển động luôn chạy. */
export const AudioWaveform: React.FC<Required<Pick<Props, "src">> & Props> = ({
  src,
  color = "#ffd86b",
  bars = 32,
  maxHeight = 90,
  width = 700,
  barWidth = 6,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const audioData = useAudioData(staticFile(src));

  const idle = idleHeights(frame, fps, bars);
  let heights = idle;

  if (audioData) {
    // numberOfSamples bắt buộc là lũy thừa 2; lấy 64 rồi ánh xạ về số thanh mong muốn.
    const SAMPLES = 64;
    const values = visualizeAudio({
      fps,
      frame,
      audioData,
      numberOfSamples: SAMPLES,
      optimizeFor: "speed",
    });
    heights = idle.map((base, i) => {
      const v = values[Math.floor((i / bars) * SAMPLES)] ?? 0;
      return Math.min(1, base + Math.min(1, v * 4) * 0.85);
    });
  }

  return (
    <WaveBars heights={heights} color={color} maxHeight={maxHeight} width={width} barWidth={barWidth} />
  );
};

/** Biến thể không có audio (preview / cảnh không tiếng): chỉ chuyển động nền. */
export const IdleWaveform: React.FC<Omit<Props, "src">> = ({
  color = "#ffd86b",
  bars = 32,
  maxHeight = 90,
  width = 700,
  barWidth = 6,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <WaveBars
      heights={idleHeights(frame, fps, bars)}
      color={color}
      maxHeight={maxHeight}
      width={width}
      barWidth={barWidth}
    />
  );
};
