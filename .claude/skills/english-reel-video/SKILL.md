---
name: english-reel-video
description: >-
  Tạo REEL / YouTube Shorts học tiếng Anh dọc 1080×1920 bằng Remotion, có 2 định
  dạng: (A) STORYBOOK — ảnh cảnh hoạt hình 3D trên cùng ĐỔI THEO DIỄN BIẾN hội
  thoại (kiểu "Easy English Conversation") + cả hội thoại 2 người dạng list, câu
  tô màu theo người nói, font serif viền trắng; (B) CẢNH HOẠT HÌNH + BONG BÓNG
  THOẠI — 1 ảnh cảnh tĩnh, bong bóng đổi câu theo lượt, end-card Subscribe. Giọng
  TTS 2 người + logo kênh. DÙNG khi người dùng muốn làm reel/short/tiktok tiếng
  Anh, video hội thoại ngắn, conversation practice, hay cắt nội dung học tiếng Anh
  thành clip dọc ≤60s — kể cả khi không nói rõ "Remotion". Tái dùng TOÀN BỘ
  pipeline của english-podcast-video (TTS, align, speed, finalize), chỉ khác
  composition hiển thị. Fan-out việc cho các agent chuyên trách. MẶC ĐỊNH TỰ VIẾT
  nội dung (KHÔNG hỏi "đã có nội dung chưa") và TỰ GỢI Ý chủ đề chưa làm (dựa
  ledger) cho người dùng bấm chọn; nếu người dùng ĐƯA sẵn nội dung thì dùng nó và
  tự suy topic + level.
---

# English Reel Video (YouTube Shorts / TikTok)

Dựng **reel tiếng Anh** dọc 1080×1920 bằng pipeline **Claude → TTS → Remotion**.
Đầu ra: một MP4 dọc ≤ 60s + `.srt` + metadata (+ thumbnail nếu cần), gom trong một
project folder. Việc chuyên môn giao cho **agent** (như skill `english-podcast-video`).

> Chung hạ tầng với `english-podcast-video`: `project:new`, TTS (`dialogue:audio*`),
> `dialogue:align`, `dialogue:speed`, `project:use`, `project:finalize`. Reel chỉ
> khác **composition render**.

## 2 định dạng (hỏi người dùng chọn ở bước 2)
| # | Composition | Mô tả | Data | Ảnh cảnh |
|---|---|---|---|---|
| **A** | `ReelDialogueList` (`preset:"storybook"`) | **Ảnh cảnh hoạt hình trên cùng ĐỔI THEO DIỄN BIẾN hội thoại** + cả hội thoại dạng list, câu tô màu đen/đỏ theo người nói, font serif viền trắng (kiểu "Easy English Conversation"). | dialogue.json chuẩn | **2–4 ảnh** (Canva) |
| **B** | `ReelComicScene` | **1 ảnh cảnh tĩnh + bong bóng thoại** đổi câu theo lượt + **end-card Subscribe**. | dialogue.json chuẩn | **1 ảnh** (Canva) |

Cả hai dùng dialogue.json **giống hệt podcast** (2 giọng, `turns` có `speaker`/`en`,
KHÔNG cần `role`).

## Các agent dùng trong pipeline (bộ agent RIÊNG cho reel + 1 dùng chung)
- **`reel-dialogue-writer`** — viết turns hội thoại ngắn cho reel (A/B). *(bước 3)*
- **`reel-scene-designer`** — thiết kế query Canva + `heads` cho ảnh cảnh dạng B. *(bước 5, chỉ B)*
- **`reel-cefr-reviewer`** — rà cấp độ/tự nhiên/độ ngắn gọn. *(bước 3, tùy chọn)*
- **`reel-metadata-writer`** — title/description/tags tối ưu Shorts (+ `#shorts`; hashtag TOÀN chữ thường) + fileKeywords. *(bước 3)*
- **`reel-policy-checker`** — kiểm duyệt Shorts trước đăng (thumbnail tùy chọn, không auto-flag hoạt hình). *(bước 7b, BẮT BUỘC)*
- **Chống trùng = `npm run ledger`** (qua webhook Apps Script, KHÔNG cần MCP connector): `check` (lấy `avoid` NGAY Ở BƯỚC WRITER), `dupe` (chấm điểm trùng sau khi viết), `append` (ghi sau khi xong, idempotent theo `id`). **ONLINE-ONLY: nguồn duy nhất = Google Sheet** (tab `reels`) — thiếu webhook/mất mạng thì lệnh báo lỗi, KHÔNG có fallback offline. Cấu hình: `ledger/webhook.json` (cài lần đầu: `scripts/ledger-webhook.gs`).
- **`audio-script-verifier`** — verify audio khớp kịch bản, bắt đọc đôi. *DÙNG CHUNG với podcast* (thuần dữ liệu, không phụ thuộc định dạng). *(bước 4c, BẮT BUỘC)*

## Pipeline (TL;DR)
```bash
ID=$(npm run --silent project:new -- "<chủ đề reel>" --type reels)  # 1) tạo folder (ID = reels/<slug>_<ts>)
npm run --silent ledger -- check --tab reels                       # 2) avoid (chống trùng) — chạy TRƯỚC để gợi ý chủ đề
npm run --silent trends -- competitors --shorts --max 20           # 2b) BẮT BUỘC: shorts đang hot trong niche (chủ đề + khuôn) — YT_API_KEY
# 2) KHÔNG hỏi nội dung — mặc định TỰ viết; GỢI Ý 3-4 chủ đề chưa làm (né avoid) + hỏi ĐỊNH DẠNG (A/B)/level/TTS
#    (2 reel trước đều A -> Recommended chuyển sang B — xen kẽ chống repetitive)
# 3) spawn reel-dialogue-writer(+avoid) (+ reel-metadata-writer) -> ráp projects/$ID/dialogue.json
#    GenMax: chọn cặp giọng từ assets/genmax-voice-pool.json KHÁC reel trước -> speakers[X].genmaxVoiceId
npm run --silent ledger -- dupe --tab reels --data "projects/$ID/dialogue.json"  # 3b) too-similar? -> viết lại
npm run --silent project:use -- "$ID"                               # nạp buffer sớm
npm run dialogue:audio -- -Data  "projects/$ID/dialogue.json"       # 4)  TTS
npm run dialogue:align -- --data "projects/$ID/dialogue.json"       # 4b) words[] (bỏ nếu ElevenLabs API)
npm run dialogue:speed -- --data "projects/$ID/dialogue.json"       # 4b2) tốc độ theo level
# 4c) BẮT BUỘC: spawn audio-script-verifier -> PASS mới render
# 5) ẢNH CẢNH: A = tách hội thoại thành 2-4 cảnh theo diễn biến -> tạo ảnh Canva từng cảnh (xem mục render);
#              B = spawn reel-scene-designer -> 1 ảnh cảnh Canva -> public/backgrounds/<scene>.png (+ heads)
npm run --silent project:use -- "$ID"                               # 5) nạp buffer
# 5) RENDER theo định dạng (LUÔN xuất podcast-portrait.mp4):
#   A) printf '{"preset":"storybook","header":"","sceneImages":["backgrounds/<slug>-s1.png",...],"sceneTurns":[0,...],"sceneHeight":600}' > "projects/$ID/reel.props.json"; npx remotion render ReelDialogueList "projects/$ID/podcast-portrait.mp4" --props="projects/$ID/reel.props.json"
#   B) printf '{"backgroundImage":"backgrounds/<scene>.png","heads":{...}}'> "projects/$ID/reel.props.json"; npx remotion render ReelComicScene   "projects/$ID/podcast-portrait.mp4" --props="projects/$ID/reel.props.json"
npm run --silent project:finalize -- "$ID" "learn english <chủ đề> shorts"   # 7) gom + .srt + metadata -> <slug>-shorts.mp4
# 7b) BẮT BUỘC: spawn reel-policy-checker
npm run --silent ledger -- append --tab reels --data "projects/$ID/dialogue.json" --format A --theme "<bucket>" --situation "<tình huống>"  # 7c) ghi sổ chống trùng
# 8) HỎI upload Google Drive
```

## Nguyên tắc bất biến
1. **Mỗi reel = 1 project folder** `projects/$ID/`. Nguồn thật = `projects/$ID/dialogue.json`.
2. `data/` chỉ là buffer → **LUÔN `project:use` trước render** và sau mỗi lần sửa dialogue.
3. **KHÔNG hỏi "đã có nội dung chưa" — mặc định TỰ VIẾT.** Chỉ khi người dùng ĐƯA
   sẵn nội dung thì dùng nó → tự suy `topic` + `level` (nói rõ mức CEFR đã suy).
   Chủ đề: TỰ tra ledger + GỢI Ý phương án chưa làm cho người dùng bấm chọn.
4. Reel **NGẮN**, mục tiêu **≤ 60s** (≈ 6–14 lượt).
5. Màn hình **chỉ tiếng Anh** (trừ khi user yêu cầu song ngữ).
6. Tham số hiển thị (header, backgroundImage, heads, accent) truyền qua `--props` — **KHÔNG sửa code mỗi video**.
7. Bản quyền: chỉ ảnh tự tạo/của user; giọng TTS theo gói đang dùng.
8. **Theo dõi tiến độ trong `projects/$ID/PROGRESS.md`** (`project:new` tạo sẵn); tick `[x]` khi xong.
9. **CHỐNG "REPETITIVE CONTENT"** (YPP soi kênh TTS + layout lặp): mỗi reel phải
   KHÁC các reel gần nhất ít nhất ở tầng hình (bộ ảnh cảnh riêng theo chủ đề) +
   tầng giọng (cặp voice) — xem mục "Chống repetitive content" bên dưới.

## Chống "repetitive content" (BẮT BUỘC — nhất là dạng A)

YouTube không phạt vì 1 video, mà phạt khi **cả kênh nhìn như máy dập khuôn**.
Ba tầng phải biến hóa, làm TỰ ĐỘNG không cần hỏi user:

**Tầng hình:** dạng A mỗi reel có BỘ ẢNH CẢNH riêng theo chủ đề nên tầng hình tự
khác nhau — nhưng ĐỪNG để các reel liên tiếp trùng cả tông nền: đảo nhẹ
`background` (hồng nhạt #fdeaea ↔ kem #fbf6e9 ↔ xanh nhạt #eef6fb…) và
`speakerColors` giữa các reel (xem `background` trong `reel.props.json` của 2
reel trước: `ls -t projects/reels/*/reel.props.json | head -3`). Dạng B đổi ảnh cảnh +
bố cục nhân vật. KHÔNG tái dùng đúng một bộ ảnh cho 2 reel liên tiếp.

**Tầng giọng (TTS GenMax/ElevenLabs):** đừng video nào cũng đúng 1 cặp giọng.
Đọc `assets/genmax-voice-pool.json`, chọn cặp A/B khác cặp reel gần nhất, ghi
override vào dialogue.json: `speakers.A.genmaxVoiceId` / `speakers.B.genmaxVoiceId`.
Giọng `tested:false` PHẢI thử `--limit 1` nghe OK mới chạy cả bài (lỗi → về cặp
default, cập nhật `tested` sau khi xác nhận). Đổi cả **tên nhân vật** giữa các video.

**Tầng kênh:** xem `recentFormats` trong output `ledger check` (3 reel gần nhất,
kèm format + theme) — nếu 2 reel liền trước đều là **A** thì ở bước 2 đổi
Recommended sang **B** (ghi rõ lý do "xen kẽ định dạng chống repetitive" trong
option description). Kịch bản và
title cũng phải đổi khuôn — đã cài vào agent `reel-dialogue-writer` (nhịp/số lượt/
kiểu kết) và `reel-metadata-writer` (xoay công thức title), không cần làm thêm.

## Quy trình chi tiết

### 1. Tạo project
```bash
ID=$(npm run --silent project:new -- "<chủ đề reel>" --type reels)   # vd: reels/coffee-shop_20260706-1010
```
`$ID` đã GỒM nhánh `reels/` — cứ nối `projects/$ID/...` như cũ là ra đúng đường dẫn.
Mở rộng `PROGRESS.md` thành việc nhỏ cho reel này, tick dần.

### 2. Nội dung: MẶC ĐỊNH TỰ VIẾT — KHÔNG hỏi "đã có nội dung chưa"
**Không hỏi người dùng đã có nội dung hay chưa.** Mặc định = bạn (Claude) tự viết.
Chỉ khi người dùng **chủ động đưa** nội dung (dán/file) → dùng nguyên văn, KHÔNG
hỏi topic/level (tự suy, nói rõ mức CEFR đã suy), chỉ hỏi định dạng + TTS nếu thiếu.

**TỰ TÌM & GỢI Ý CHỦ ĐỀ:** chạy `npm run --silent ledger -- check --tab reels`
TRƯỚC khi hỏi (kết quả `avoid` dùng lại cho bước 3, không cần chạy lần nữa) →
nghĩ 3–4 chủ đề/tình huống **CHƯA có trong `avoid`**, ưu tiên tình huống đời
thường dễ viral (quán cà phê / khách sạn / sân bay / bác sĩ / phỏng vấn / mua
sắm / small talk…), đưa làm phương án bấm chọn.
**BẮT BUỘC nghiên cứu trend cùng lúc**: `npm run --silent trends -- competitors
--shorts --max 20` (shorts đang hot của các kênh cùng niche, xếp theo view/ngày —
kênh cấu hình ở `assets/competitor-channels.json`) → ưu tiên gợi ý chủ đề ĐANG
HOT mà ledger chưa có, ghi rõ "đang hot: n view/ngày ở kênh X" trong mô tả
phương án; để ý cả KHUÔN đang thắng (vd tình huống + cú hiểu lầm hài kiểu "Taxi
Misunderstanding") để dùng ở bước viết. API lỗi → gợi ý theo ledger, không chặn.

Hỏi 1 lần `AskUserQuestion` (dạng LỰA CHỌN, mặc định lên đầu + "(Recommended)";
thông số nào người dùng ĐÃ nói trong tin nhắn thì KHÔNG hỏi lại):
- **Chủ đề?** 3–4 gợi ý từ ledger ở trên (+ "Other" tự nhập).
- **Định dạng?** **A — storybook: ảnh cảnh đổi theo hội thoại (Recommended)** | B — cảnh + bong bóng.
  NGOẠI LỆ: nếu 2 reel liền trước (xem `recentFormats` của `ledger check`) đều là A →
  chuyển Recommended sang B (xen kẽ định dạng chống repetitive — nêu lý do trong description).
- **Cấp độ?** **A2 (Recommended)** / B1 / B1-B2 / B2.
- **Dùng TTS nào?** ElevenLabs web (Recommended) / SAPI / AI Studio / ElevenLabs API /
  Gemini / aivideoauto / GenMax API (giọng tự lấy từ `.env`, không hỏi giọng).

Chọn xong → TỰ viết ở bước 3, không cần người dùng duyệt nháp trước.

### 3. Viết `projects/$ID/dialogue.json` (fan-out AGENT)
- **CHỐNG TRÙNG:** dùng lại `avoid` từ `ledger check` đã chạy ở bước 2 (nếu chưa
  chạy thì chạy ngay: `npm run --silent ledger -- check --tab reels` — đọc thẳng
  Google Sheet online).
- **Spawn `reel-dialogue-writer`** (truyền `format`, `topic`, `level`, `turns`,
  `speakerNames`, `emotive`, **`avoid`** = kết quả `check`, **`trendHints`** = tóm
  tắt 3–5 shorts hot nhất liên quan từ trend-scan bước 2 — khuôn/móc/tông đang
  thắng, vd "tình huống + hiểu lầm hài đang ăn khách"; writer bám HƯỚNG, không
  copy thoại/title): trả `{ turns, [reelFields], notes }`.
  Agent sẽ chọn tình huống/khuôn/câu mở đầu KHÁC những gì đã có trong `avoid`.
- **Cổng kiểm trùng** (sau khi ráp dialogue.json):
  ```bash
  npm run --silent ledger -- dupe --tab reels --data "projects/$ID/dialogue.json"
  ```
  `verdict:"too-similar"` (cùng topic / opening trùng / overlap ≥ 0.4) → yêu cầu
  `reel-dialogue-writer` viết lại góc khác rồi kiểm lại tới khi `ok`.
- **Ráp khung dialogue:** turns hội thoại 2 người, KHÔNG `role`. Ráp `speakers`
  (A trái / B phải, `side` cho bong bóng dạng B), `topic` (dùng cho metadata;
  dạng A storybook thường ẨN header). Câu nên NGẮN (≤ ~9 từ) để dạng A mỗi câu
  1–2 dòng.
- (Tùy chọn) **`reel-cefr-reviewer`** rà lại turns theo `level`.
- **`reel-metadata-writer`** → `youtubeTitle`/`youtubeDescription`/`tags` + `fileKeywords`
  (tối ưu Shorts, có `#shorts`; MỌI hashtag chữ thường). Agent tự chạy `scripts/keyword-suggest.mjs`
  (YouTube/Google autocomplete, `--format shorts`) để tra cụm từ khóa đang được
  tìm thật rồi mới viết. Truyền kèm `youtubeTitle` của 1–2 reel gần nhất (lấy từ
  `projects/reels/*/dialogue.json` mới nhất) để agent xoay công thức title KHÁC khuôn cũ.
- Ráp tất cả vào `projects/$ID/dialogue.json` (+ `fps`, `speakers`). Để
  `audio`/`durationInSec`/`words` trống. Mẫu: `assets/reel-conversation-example.json`;
  trường đầy đủ: `references/reel-format.md` (chú ý: các trường micro-lesson C
  như `phrase`/`hook`/`kicker`/`cta`/`role` trong đó là LEGACY — dạng A/B hiện
  tại KHÔNG dùng; phần trường chung title/level/topic/speakers/turns vẫn đúng).
- **Xoay giọng (TTS GenMax):** chọn cặp voice từ `assets/genmax-voice-pool.json`
  KHÁC cặp reel gần nhất, ghi `speakers.A.genmaxVoiceId` / `speakers.B.genmaxVoiceId`
  vào dialogue.json (giọng `tested:false` → thử `--limit 1` trước; xem mục
  "Chống repetitive content"). TTS khác giữ giọng theo `.env` như cũ.
- Chạy `npm run --silent project:use -- "$ID"` để buffer sớm.

### 4. TTS + align + tốc độ (GIỐNG podcast)
```bash
npm run dialogue:audio -- -Data "projects/$ID/dialogue.json"    # SAPI mặc định; hoặc dialogue:audio:eleven:web …
npm run dialogue:align -- --data "projects/$ID/dialogue.json"   # words[] (bỏ nếu ElevenLabs API)
npm run dialogue:speed -- --data "projects/$ID/dialogue.json"   # tempo theo doc.level
```
Adapter TTS + thẻ cảm xúc: `../english-podcast-video/references/better-tts.md`; giọng SAPI:
`../english-podcast-video/references/voices.md`. Cả A lẫn B đều tô theo CÂU/lượt
(không cần `words[]`) — vẫn chạy `dialogue:align` để chuẩn `durationInSec`.

### 4c. (BẮT BUỘC) Verify audio — TRƯỚC render
Spawn **`audio-script-verifier`** (`data: projects/$ID/dialogue.json`, sau align).
FAIL → sửa (cắt ffmpeg / sinh lại lượt) rồi chạy lại tới khi PASS.

### 5. Ảnh cảnh + Nạp + Render

**Nạp buffer + render** (LUÔN `project:use` trước; xuất `podcast-portrait.mp4`):
```bash
npm run --silent project:use -- "$ID"
npx remotion compositions src/index.ts     # xem composition -> số giây (nên ≤ 60s)
```

**A) `ReelDialogueList` (storybook):** ảnh cảnh hoạt hình trên cùng ĐỔI THEO
DIỄN BIẾN hội thoại + KHÔNG hiện tên người nói (cả câu tô màu đen/đỏ theo người
nói), font serif viền trắng, nền hồng nhạt, không band tô sáng. Luồng làm:

1. **Tách cảnh:** đọc `turns` và chia hội thoại thành 2–4 cảnh theo diễn biến
   (vd Hotel Check-in 12 lượt: ①0–3 tới quầy chào hỏi ②4–6 phòng view biển
   ③7–8 bữa sáng ④9–11 trả thẻ nhận chìa khóa). Ghi lại index lượt bắt đầu mỗi
   cảnh → `sceneTurns` (vd `[0,4,7,9]`).
2. **Tạo ảnh mỗi cảnh bằng Canva** (`generate-design`, `design_type:
   "youtube_thumbnail"` — tỉ lệ 1280×720 ≈ vùng cảnh 1080×600 nên gần như không
   phải crop). Prompt: "3D Pixar-style animated movie still" + tả cảnh đúng nội
   dung lượt thoại + **MÔ TẢ NHÂN VẬT GIỐNG HỆT NHAU trong mọi cảnh** (tóc, áo,
   đạo cụ — để 4 ảnh nhìn như 1 phim) + "NO text, NO words, NO logo".
   `create-design-from-candidate` → `export-design` png 1280×720 → tải bằng
   PowerShell → `ffmpeg -vf "scale=1080:608,crop=1080:600:0:4"` →
   `public/backgrounds/<slug>-s<N>.png`, lưu bản gốc vào `assets/scenes/`.
   **Trước khi tạo mới, xem `assets/scenes/` có cảnh tái dùng được không.**
   *Quota:* Canva AI hết lượt khá nhanh (gọi TUẦN TỰ, không song song). **Canva
   LỖI / hết quota → fallback Gemini thủ công (MẶC ĐỊNH):** tự soạn PROMPT sinh
   ảnh cho TỪNG cảnh (tiếng Anh, "3D Pixar-style animated movie still" + tả cảnh
   + NHÂN VẬT GIỐNG HỆT NHAU mọi cảnh + tỉ lệ 16:9 + "No text, no words, no
   letters, no logo, no watermark"), đưa TẤT CẢ prompt cùng lúc cho người dùng
   dán vào Gemini (gemini.google.com — KHÔNG gọi Gemini API image, không có free
   quota → 429), NGỪNG CHỜ người dùng lưu ảnh về path chỉ định
   (`public/backgrounds/<slug>-sN.png`) hoặc dán lại ảnh; nhắc họ đính kèm ảnh
   cảnh 1 làm reference khi tạo cảnh 2-4 để nhân vật nhất quán. Xem thêm
   `../english-podcast-video/references/canva-bg.md` mục "Fallback Gemini".
   Người dùng từ chối → AI Studio web qua CDP (xem tts-aistudio.mjs) → tạm 1 ảnh
   + Ken Burns.
3. **Render:**
```bash
printf '{"preset":"storybook","header":"","sceneImages":["backgrounds/<slug>-s1.png","backgrounds/<slug>-s2.png","backgrounds/<slug>-s3.png","backgrounds/<slug>-s4.png"],"sceneTurns":[0,4,7,9],"sceneHeight":600}' > "projects/$ID/reel.props.json"
npx remotion render ReelDialogueList "projects/$ID/podcast-portrait.mp4" --props="projects/$ID/reel.props.json"
```

Props riêng: `preset:"storybook"`, `sceneImages[]` (public/), `sceneTurns[]`
(lượt bắt đầu mỗi cảnh, 0-based, phần tử đầu = 0; bỏ trống → chia đều thời
lượng), `sceneVideos[]` (clip mp4/webm CHUYỂN ĐỘNG — ưu tiên hơn sceneImages;
tắt tiếng, tự LẶP nếu ngắn hơn khúc của nó; clip phải do mình tạo, KHÔNG cắt từ
video người khác), `sceneHeight` (px, mặc định 640), `showNames`,
`highlightMode` (`"band"`/`"none"`), `textStroke`, `speakerColors` (vd
`{"A":"#1f1c1c","B":"#e0234e"}`). Mọi giá trị đều override được — preset chỉ đổi
mặc định (đảo `background`/`speakerColors` giữa các reel — xem mục "Chống
repetitive content"). Câu nên NGẮN (≤ ~9 từ) để mỗi câu 1–2 dòng như mẫu. Ảnh
tĩnh có sẵn zoom chậm Ken Burns trong từng cảnh; muốn chuyển động thật thì dùng
`sceneVideos`.

**B) `ReelComicScene`:** ảnh cảnh — trước hết xem thư viện `assets/scenes/`, có
cảnh hợp thì copy vào `public/backgrounds/`. Nếu chưa: **spawn
`reel-scene-designer`** (truyền `topic`, `speakers`) → nhận `{ canvaQuery,
sceneName, heads, props }`. Dùng `canvaQuery` tạo ảnh Canva (`design_type:
phone_wallpaper`, 1080×1920), tải về `public/backgrounds/<sceneName>.png`, lưu
bản gốc vào `assets/scenes/`. Luồng Canva chi tiết:
`../english-podcast-video/references/canva-bg.md`. **Canva LỖI / hết quota →
fallback Gemini thủ công:** chuyển `canvaQuery` thành prompt sinh ảnh (thêm "9:16
portrait 1080×1920, two characters in the LOWER HALF, upper half plain/empty for
speech bubbles, no text, no words, no logo, no watermark"), đưa người dùng dán
vào Gemini rồi NGỪNG CHỜ ảnh lưu về `public/backgrounds/<sceneName>.png` (xem
"Fallback Gemini" trong canva-bg.md).
```bash
printf '{"backgroundImage":"backgrounds/<scene>.png","heads":{"leftXPct":24,"leftYPct":45,"rightXPct":77,"rightYPct":50}}' > "projects/$ID/reel.props.json"
npx remotion render ReelComicScene "projects/$ID/podcast-portrait.mp4" --props="projects/$ID/reel.props.json"
```
Props: `backgroundImage` (NÊN có), **`heads`** (canh bong bóng lên đầu — số từ `reel-scene-designer`, tinh chỉnh bằng render still), `accent` (màu end-card), `endcard` (mặc định true), `logo`. Mũi bong bóng theo `speakers[].side`.

> Kiểm tra nhanh: `npx remotion still src/index.ts <Comp> "$env:TEMP/check.png" --frame=45 --props=...`.
> Dạng B: xem mũi bong bóng có chạm đầu không → chưa khớp thì chỉnh `heads` rồi render lại.

### 6. Thumbnail — MẶC ĐỊNH BỎ với reel
Shorts hiển thị dọc, thường không cần thumbnail riêng. Nếu user muốn: tái dùng
composition `Thumbnail` + agent `youtube-thumbnail-designer` như podcast. Intro 6s
cũng KHÔNG ghép cho reel (ăn quá nhiều thời lượng) trừ khi user yêu cầu.

### 7. Gom + đặt tên từ khóa + .srt + metadata
```bash
npm run --silent project:finalize -- "$ID" "learn english <chủ đề> conversation shorts"
```
Đổi tên `podcast-portrait.mp4` → **`<slug>-shorts.mp4`** (LUÔN truyền cụm từ khóa SEO
tiếng Anh — dùng `fileKeywords` từ `reel-metadata-writer`); tạo `.srt`; xuất
`youtube-metadata.txt` (TITLE/DESCRIPTION/TAGS). Reel không có bản ngang nên
`finalize` báo thiếu `podcast.mp4` — bỏ qua, file chính là `<slug>-shorts.mp4`.

### 7b. (BẮT BUỘC) Kiểm duyệt YouTube
Spawn **`reel-policy-checker`** (`project: projects/$ID/`). FAIL → sửa blocker rồi
chạy lại; WARN → báo user. Đính kèm `uploadChecklist` vào báo cáo cuối. (Agent này
coi thumbnail là tùy chọn, kiểm `#shorts` không phân biệt hoa thường, và không tự flag hoạt hình là kids.)

### 7c. (BẮT BUỘC) Ghi SỔ NỘI DUNG (chống trùng lần sau)
Sau khi finalize + kiểm duyệt xong, ghi 1 dòng thẳng lên Google Sheet (tự lấy
topic/level/opening/script từ dialogue.json; idempotent theo `id`):
```bash
npm run --silent ledger -- append --tab reels --data "projects/$ID/dialogue.json" \
  --format <A|B> --theme "<bucket: workplace/travel/food/…>" --situation "<tình huống>"
```
Lần sau bước 3 `check`/`dupe` đọc lại từ Sheet để tránh lặp. Muốn thêm/sửa dòng
thì làm thẳng trên Sheet online — không có bản local nào phải đồng bộ.
> Ledger là **online-only**: thiếu `ledger/webhook.json` hoặc mất mạng → lệnh báo
> lỗi (KHÔNG âm thầm ghi local). Báo user rồi chạy lại khi có mạng — đừng bỏ qua
> bước này. (Cài webhook lần đầu: xem đầu file `scripts/ledger-webhook.gs`.)

### 8. (Hỏi cuối) Upload Google Drive
**HỎI: "Upload kết quả lên Google Drive không?"** Nếu CÓ → upload vào mục
**`reels`** (`id mục = 1jUUnNCDT8q_se6bH9BrusWRho4MN9_CE` — folder con của thư mục
gốc, KHÔNG up thẳng vào gốc). Dùng **`rclone` cho TOÀN BỘ** (remote `gdrive` đã
OAuth sẵn — KHÔNG dùng Google Drive MCP, kể cả tạo folder hay file text; rclone
TỰ TẠO subfolder `<slug>` qua đường dẫn đích):
  ```bash
  rclone copy "projects/$ID" "gdrive:<slug>" --drive-root-folder-id 1jUUnNCDT8q_se6bH9BrusWRho4MN9_CE \
    --include "*.mp4" --include "*.srt" --include "youtube-metadata.txt" --include "project.json"
  rclone lsf "gdrive:<slug>" --drive-root-folder-id 1jUUnNCDT8q_se6bH9BrusWRho4MN9_CE   # xác nhận đủ file
  # link báo user: lấy id subfolder rồi ghép https://drive.google.com/drive/folders/<id>
  rclone lsf gdrive: --drive-root-folder-id 1jUUnNCDT8q_se6bH9BrusWRho4MN9_CE --dirs-only --format "ip"
  ```
- Chi tiết luồng + cài rclone lần đầu (winget + OAuth): `../english-podcast-video/SKILL.md` mục 8.

## Tham chiếu
- `assets/reel-conversation-example.json` — mẫu dialogue.json hội thoại chạy được (schema chuẩn cho A/B).
- `references/reel-format.md` — LEGACY: trường riêng của micro-lesson C cũ (không dùng trong workflow nữa).
- `assets/genmax-voice-pool.json` — pool giọng ElevenLabs qua GenMax để xoay cặp giọng.
- `assets/scenes/` — thư viện ảnh cảnh dùng chung A + B (bản gốc chưa crop; vd `hotel-checkin-lobby-1280x720.png`).
- Code: `src/reel/ReelDialogueList.tsx` (A — dùng `preset:"storybook"`), `src/reel/ReelComicScene.tsx` (B); đăng ký ở `src/Root.tsx`.
  (`src/reel/Reel.tsx` — micro-lesson C cũ và preset "classic" của A vẫn nằm trong code nhưng KHÔNG dùng trong workflow nữa.)
- `../english-podcast-video/references/` — better-tts, voices, canva-bg, youtube-metadata.
