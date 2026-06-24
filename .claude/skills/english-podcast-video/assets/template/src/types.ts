export type WordTiming = {
  /** Từ hiển thị. */
  text: string;
  /** Thời điểm bắt đầu đọc (giây, tính từ đầu file audio). */
  startSec: number;
  /** Thời điểm kết thúc (giây). */
  endSec: number;
};

export type ScriptItem = {
  /** Mã định danh, dùng cho tên file audio (vd "001"). */
  id: string;
  /** Câu tiếng Anh hiển thị + được đọc. */
  en: string;
  /** Nghĩa tiếng Việt. */
  vi: string;
  /** Phiên âm IPA (tùy chọn). */
  phonetic?: string;
  /** Chủ đề của câu (tùy chọn). */
  topic?: string;
  /**
   * Đường dẫn file audio trong thư mục public/ (vd "audio/001.mp3").
   * Để rỗng "" thì cảnh sẽ chạy không tiếng (dùng để preview trước khi có TTS).
   */
  audio: string;
  /** Độ dài audio (giây). measure-duration.ts sẽ tự cập nhật khi có file thật. */
  durationInSec: number;
  /** Số lần lặp lại câu. */
  repeat: number;
  /** Khoảng nghỉ giữa các lần lặp (giây). */
  gapBetweenRepeatsSec?: number;
  /** Khoảng nghỉ sau lần lặp cuối, trước khi sang câu kế (giây). */
  pauseAfterSec: number;
  /**
   * Mốc thời gian từng từ (tương đối so với đầu file audio), dùng cho hiệu ứng
   * highlight. Nếu không có thì phụ đề hiển thị nguyên câu, không highlight.
   */
  words?: WordTiming[];
};

export type Script = {
  title: string;
  level: string;
  /** Khung hình/giây dùng cho toàn video. */
  fps: number;
  items: ScriptItem[];
};
