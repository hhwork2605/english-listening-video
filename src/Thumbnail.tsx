import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import type { Dialogue, SpeakerId } from "./podcast/types";
import { Speaker } from "./podcast/components/Speaker";

export type ThumbnailProps = {
  dialogue: Dialogue;
  /** Dòng nhãn nhỏ phía trên tiêu đề (pill "TALK ABOUT" của kênh). */
  kicker?: string;
  /** Tiêu đề lớn ở giữa. Mặc định lấy dialogue.topic; nên đặt cụm ngắn, mạnh
   *  (vd "YOUR WEEKEND") để không lặp với pill. */
  title?: string;
  /** Tên kênh hiển thị góc trên. */
  channel?: string;
  /**
   * Ảnh minh hoạ 2 nhân vật (chừa giữa trống) làm nền thumbnail, trong public/
   * (vd "thumbnails/weekend.png"). Có ảnh thì dùng ảnh + overlay chữ; không có
   * thì vẽ nền gradient + 2 avatar chữ cái.
   */
  backgroundImage?: string;
  /** Logo kênh (trong public/) — LUÔN hiện ở góc PHẢI DƯỚI. Mặc định "logo.jpg".
   *  Đặt "" để ẩn. */
  logo?: string;
  /**
   * true = ảnh nền ĐÃ CÓ SẴN CHỮ (style "dramatic" nướng chữ vào ảnh) — chỉ
   * hiện ảnh + logo, ẩn toàn bộ pill/tiêu đề/badge/tag kênh để không đè chữ.
   */
  bare?: boolean;
};

/**
 * Thumbnail YouTube 1280×720 phong cách kênh hội thoại: pill nhãn + tiêu đề lớn
 * + badge cấp độ. Khi có `backgroundImage` (ảnh 2 nhân vật từ Canva) thì phủ
 * chữ lên giữa ảnh; khi không có thì tự dựng nền + 2 avatar.
 */
export const Thumbnail: React.FC<ThumbnailProps> = ({
  dialogue,
  kicker = "TALK ABOUT",
  title,
  channel = "ENGLISH PODCAST",
  backgroundImage,
  logo = "logo.jpg",
  bare = false,
}) => {
  const headline = title ?? dialogue.topic;
  const ids = Object.keys(dialogue.speakers) as SpeakerId[];
  const leftId = ids.find((id) => dialogue.speakers[id].side === "left") ?? ids[0];
  const rightId = ids.find((id) => dialogue.speakers[id].side === "right") ?? ids[1];

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(135deg, #f6d9c2 0%, #efb9a3 45%, #d98b78 100%)",
        fontFamily: "system-ui, Segoe UI, Roboto, sans-serif",
        overflow: "hidden",
      }}
    >
      {backgroundImage ? (
        <Img
          src={staticFile(backgroundImage)}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : null}

      {/* Tên kênh góc trên phải */}
      {!bare ? (
      <div
        style={{
          position: "absolute",
          top: 28,
          right: 36,
          background: "rgba(20,30,40,0.85)",
          color: "#fff",
          fontWeight: 800,
          fontSize: 26,
          letterSpacing: 1,
          padding: "8px 18px",
          borderRadius: 12,
        }}
      >
        {channel}
      </div>
      ) : null}

      {/* Khối chữ ở giữa (pill + tiêu đề + badge) */}
      {!bare ? (
      <AbsoluteFill
        style={{
          alignItems: "center",
          justifyContent: "center",
          gap: 20,
          padding: "0 90px",
        }}
      >
        <div
          style={{
            background: "#e98aa6",
            color: "#fff",
            fontWeight: 800,
            fontSize: 30,
            letterSpacing: 4,
            padding: "8px 28px",
            borderRadius: 999,
            boxShadow: "0 6px 18px rgba(0,0,0,0.3)",
            textTransform: "uppercase",
          }}
        >
          {kicker}
        </div>

        <div
          style={{
            color: "#ffffff",
            fontSize: 86,
            fontWeight: 900,
            lineHeight: 1.0,
            textAlign: "center",
            textTransform: "uppercase",
            textShadow: "0 6px 0 #8c4636, 0 12px 30px rgba(0,0,0,0.55)",
            WebkitTextStroke: "3px #5a2e23",
            paintOrder: "stroke fill",
          }}
        >
          {headline}
        </div>

        <div
          style={{
            background: "#ffd86b",
            color: "#0f2027",
            fontWeight: 900,
            fontSize: 38,
            padding: "6px 28px",
            borderRadius: 14,
            boxShadow: "0 6px 16px rgba(0,0,0,0.3)",
          }}
        >
          {dialogue.level}
        </div>
      </AbsoluteFill>
      ) : null}

      {/* Không có ảnh nền: dựng 2 avatar chữ cái hai góc dưới */}
      {!backgroundImage && !bare ? (
        <>
          <div style={{ position: "absolute", bottom: 24, left: 48 }}>
            <Speaker info={dialogue.speakers[leftId]} active enterFrame={0} size={300} />
          </div>
          <div style={{ position: "absolute", bottom: 24, right: 48 }}>
            <Speaker info={dialogue.speakers[rightId]} active enterFrame={0} size={300} />
          </div>
        </>
      ) : null}

      {/* Logo kênh — LUÔN ở góc phải dưới (tròn, viền trắng + đổ bóng) */}
      {logo ? (
        <Img
          src={staticFile(logo)}
          style={{
            position: "absolute",
            bottom: 28,
            right: 32,
            width: 150,
            height: 150,
            borderRadius: "50%",
            objectFit: "cover",
            border: "4px solid #fff",
            boxShadow: "0 6px 20px rgba(0,0,0,0.45)",
            opacity: 0.5, // mờ 1 nửa cho đỡ chói/đỡ đè
          }}
        />
      ) : null}
    </AbsoluteFill>
  );
};
