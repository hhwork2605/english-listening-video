# Định dạng dữ liệu

## dialogue.json (podcast 2 người — định dạng chính)

| Trường | Kiểu | Ý nghĩa |
|---|---|---|
| `title` | string | Tiêu đề video (đặt tên file/ghi chú). |
| `level` | string | Hiện trên badge, vd `"B1-B2"`. |
| `topic` | string | Chủ đề ngắn (dùng cho thumbnail + tên file). |
| `youtubeTitle` | string | (tùy chọn) Tiêu đề khi đăng YouTube, móc tò mò < 50 ký tự. `finalize` xuất ra `youtube-title.txt`. |
| `youtubeDescription` | string | (tùy chọn) Mô tả + CTA + hashtag. `finalize` → `youtube-description.txt`. |
| `tags` | string[] | (tùy chọn) Từ khóa cho ô Tags YouTube. `finalize` → `youtube-tags.txt`. |
| `fps` | number | Khung hình/giây, để `30`. |
| `speakers.A` / `.B` | object | Thông tin 2 người nói (xem dưới). |
| `turns[]` | array | Các lượt thoại, luân phiên A/B. |

**speakers.A / speakers.B**
| Trường | Ý nghĩa |
|---|---|
| `name` | Tên hiển thị (vd "Emma"). |
| `voice` | Giọng SAPI, vd `"Microsoft Zira Desktop"` / `"Microsoft David Desktop"`. |
| `elevenVoiceId` | (tùy chọn) Voice ID ElevenLabs, dùng khi chạy `dialogue:audio:eleven`. |
| `gommoVoiceId` | (tùy chọn) Voice ID nền tảng aivideoauto/gommo, dùng khi chạy `dialogue:audio:gommo`. |
| `side` | `"left"` hoặc `"right"` — vị trí trên sân khấu. |
| `color` | Mã màu nhấn (badge, viền khi đang nói, dải phụ đề). |
| `image` | (tùy chọn) ảnh nhân vật trong public/, vd `"characters/emma.png"`. |

**turns[] — mỗi lượt**
| Trường | Ai điền | Ý nghĩa |
|---|---|---|
| `id` | bạn | `"001"`, `"002"`… |
| `speaker` | bạn | `"A"` hoặc `"B"`, luân phiên. |
| `en` | bạn | Câu tiếng Anh (SẠCH, không tag) — hiện trên phụ đề/karaoke/.srt. |
| `enTts` | bạn | (tùy chọn, ElevenLabs v3) Bản `en` có chèn audio tag cảm xúc (`[laughs]`, `[excited]`…) để TTS đọc. `dialogue:audio:eleven` ưu tiên dùng trường này; tag được lọc khỏi `words[]`. |
| `vi` | bạn | Nghĩa tiếng Việt. |
| `pauseAfterSec` | bạn | Nghỉ sau lượt (mặc định `0.4`). |
| `audio` | TTS | `"audio/d001.wav"`. |
| `durationInSec` | TTS | Độ dài audio. |
| `words[]` | TTS | `[{text, startSec, endSec}]` cho highlight. |

Ước lượng độ dài: ~12 lượt ≈ 1 phút (mỗi lượt ~4–5s + nghỉ).

## script.json (định dạng phụ — câu đơn lặp, 1 giọng)

| Trường | Ý nghĩa |
|---|---|
| `title`, `level`, `fps` | Như trên. |
| `items[].id/en/vi/phonetic/topic` | Nội dung 1 câu. |
| `items[].repeat` | Số lần lặp câu (vd 2). |
| `items[].gapBetweenRepeatsSec` | Nghỉ giữa các lần lặp (vd 0.6). |
| `items[].pauseAfterSec` | Nghỉ trước câu kế (vd 1.5). |
| `items[].audio/durationInSec/words` | TTS điền (`npm run generate:audio:sapi`). |

Render: `npm run render:landscape` / `npm run render:portrait`.
