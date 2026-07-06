import type { Dialogue, DialogueTurn } from "../podcast/types";

/**
 * Vai trò của một lượt trong reel micro-lesson — quyết định layout của segment
 * đó trong composition `Reel`. Các script TTS/align/speed/finalize KHÔNG quan tâm
 * tới trường này (chúng chỉ đọc en/audio/durationInSec/words), nên reel dùng
 * CHUNG schema dialogue.json với podcast, chỉ thêm vài trường tùy chọn.
 */
export type ReelRole =
  | "hook" // câu mở đầu gây tò mò
  | "phrase" // đọc cụm/idiom mục tiêu (hiện chữ lớn)
  | "meaning" // giải nghĩa ngắn
  | "example" // câu ví dụ (karaoke highlight)
  | "tip" // mẹo dùng / lưu ý nhỏ
  | "cta"; // kêu gọi follow/subscribe cuối video

export type ReelTurn = DialogueTurn & {
  /** Vai trò của lượt (mặc định "example" nếu bỏ trống). */
  role?: ReelRole;
};

/**
 * Reel = Dialogue (giữ nguyên title/level/topic/fps/speakers/turns để tương thích
 * toàn bộ pipeline) + các trường hiển thị riêng của định dạng reel micro-lesson.
 */
export type Reel = Omit<Dialogue, "turns"> & {
  /** Cụm/idiom mục tiêu, hiện chữ lớn + dock lên đầu sau khi giới thiệu. */
  phrase?: string;
  /** Phiên âm IPA tùy chọn, hiện dưới phrase. */
  phonetic?: string;
  /** Câu mở đầu (nếu muốn banner hook riêng; thường trùng turn role "hook"). */
  hook?: string;
  /** Chữ chip trên cùng, mặc định "PHRASE OF THE DAY". */
  kicker?: string;
  /** Câu CTA cuối (thường trùng turn role "cta"). */
  cta?: string;
  /** Màu nhấn dạng #RRGGBB (chip, highlight, sóng âm, glow nền). */
  accent?: string;
  turns: ReelTurn[];
};
