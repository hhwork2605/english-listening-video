# Định dạng dữ liệu Reel (`dialogue.json`)

Reel dùng CHUNG file `dialogue.json` với podcast (nên chạy được toàn bộ pipeline
TTS/align/speed/finalize), chỉ thêm các trường hiển thị cấp document + `role` cho
mỗi lượt. Composition đọc file này là `Reel` (`src/reel/Reel.tsx`).

## Trường cấp document
| Trường | Bắt buộc | Ý nghĩa |
|---|---|---|
| `title` | ✔ | Tên nội bộ, vd "English Reel | Break the ice". |
| `level` | ✔ | CEFR (A2/B1/B1-B2/B2…) — `dialogue:speed` dùng để chọn tempo. |
| `topic` | ✔ | Cụm từ/chủ đề — dùng đặt tên file & metadata; KHÔNG hiện trên video. |
| `phrase` | ✔ | Cụm mục tiêu hiện chữ lớn ở segment `phrase`, sau đó dock lên đầu. |
| `phonetic` | – | IPA hiện dưới `phrase` (vd `/breɪk ðə aɪs/`). |
| `hook` | – | Câu mở đầu hiện ở segment `hook` (nếu bỏ trống → dùng `en` của lượt đó). |
| `kicker` | – | Chip trên cùng. Mặc định `PHRASE OF THE DAY`. |
| `cta` | – | Câu CTA hiện ở segment `cta` (nếu bỏ trống → dùng `en` của lượt đó). |
| `accent` | – | Màu nhấn `#RRGGBB` (chip/karaoke/sóng âm/glow nền). Mặc định `#ffd23f`. Cũng truyền được qua `--props`. |
| `youtubeTitle` / `youtubeDescription` / `tags` | – | Metadata YouTube; `finalize` xuất ra `youtube-metadata.txt`. |
| `fps` | ✔ | Khung hình/giây (30). |
| `speakers` | ✔ | Map A/B → { name, voice, side, color }. `voice` là giọng SAPI (hoặc bị adapter khác bỏ qua). |
| `turns` | ✔ | Mảng các lượt (xem dưới). |

> `accent` nên là hex 6 số (`#ffd23f`) vì nền gradient nối thêm alpha (`accent + "22"`).

## Trường mỗi lượt (`turns[]`)
Giống `DialogueTurn` của podcast + `role`:
| Trường | Ai điền | Ý nghĩa |
|---|---|---|
| `id` | bạn | "001", "002"… (đặt tên file audio). |
| `role` | bạn | `hook` \| `phrase` \| `meaning` \| `example` \| `tip` \| `cta` (mặc định `example`). |
| `speaker` | bạn | "A" hoặc "B" — chọn giọng đọc. |
| `en` | bạn | Câu tiếng Anh được ĐỌC + hiển thị (karaoke ở `example`). |
| `enTts` | tùy | Bản có thẻ cảm xúc `[...]` cho ElevenLabs/Gemini (giữ `en` sạch cho `.srt`). |
| `audio` | TTS | File wav trong `public/` (script tự điền). Để `""`. |
| `durationInSec` | TTS | Độ dài audio (script tự điền). Để `0`. |
| `pauseAfterSec` | bạn | Nghỉ sau lượt (giây). Reel nên ngắn: 0.3–0.5. |
| `words` | align | Mốc từng từ cho karaoke (`dialogue:align` điền). |

## Cấu trúc chuẩn của một reel (thứ tự `role`)
1. `hook` — 1 lượt, câu tò mò ngắn (3–6 từ). Vd "Do you know this phrase?"
2. `phrase` — 1 lượt, đọc chính cụm từ.
3. `meaning` — 1 lượt, giải nghĩa tự nhiên (không quá học thuật).
4. `example` — 1–2 lượt, câu đời thường CHỨA cụm từ (karaoke làm nổi).
5. `tip` — (tùy chọn) 1 lượt mẹo dùng (formal/casual, giới từ đi kèm…).
6. `cta` — 1 lượt kêu gọi follow.

Tổng **6–9 lượt** để clip **≤ 60s**. Với `pauseAfterSec` ~0.4 và câu ngắn, mỗi
reel thường ~30–50s.

## Mẹo viết
- **Hook** phải chạm curiosity gap: câu hỏi ("Ever said this wrong?"), con số
  ("3 ways to say sorry"), hoặc lỗi thường gặp. Giữ 3–6 từ để chữ lớn dễ đọc.
- **Phrase** đọc chậm, rõ. Nếu là idiom khó → cân nhắc `phonetic`.
- **Meaning** viết như giải thích cho bạn bè, tránh định nghĩa từ điển khô khan.
- **Example** dùng ngữ cảnh cụ thể, đời thường; nên có 2 ví dụ ở 2 tình huống khác
  nhau để người xem nhớ cách dùng.
- **CTA** ngắn, một hành động ("Follow for daily English!").
- Tận dụng `pauseAfterSec` để câu "thở" — reel dồn dập quá khó theo.

## Nhiều reel hàng loạt
Mỗi reel một `$ID` (`project:new`) và một `dialogue.json`. Muốn sản xuất loạt:
lặp mục 3–7 cho từng cụm từ, hoặc spawn nhiều `english-dialogue-writer` song song
(mỗi agent viết turns cho một cụm từ), rồi finalize từng project.

## Kiểm tra nhanh trước render
```bash
npm run --silent project:use -- "$ID"
npx remotion compositions src/index.ts   # dòng "Reel" -> xem số giây, nên ≤ 60s
```
