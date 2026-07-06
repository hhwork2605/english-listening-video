---
name: english-reel-video
description: >-
  Tạo REEL / YouTube Shorts học tiếng Anh dọc 1080×1920 bằng Remotion, có 3 định
  dạng: (A) DANH SÁCH HỘI THOẠI đọc theo — nền trơn + tiêu đề + cả hội thoại 2
  người dạng list, tô sáng từng câu; (B) CẢNH HOẠT HÌNH + BONG BÓNG THOẠI — 1 ảnh
  cảnh tĩnh, bong bóng đổi câu theo lượt, end-card Subscribe; (C) MICRO-LESSON —
  dạy 1 idiom/phrase theo hook → phrase → nghĩa → ví dụ (karaoke) → CTA. Giọng TTS
  2 người + sóng âm/logo kênh. DÙNG khi người dùng muốn làm reel/short/tiktok tiếng
  Anh, video hội thoại ngắn, "phrase of the day", conversation practice, hay cắt
  nội dung học tiếng Anh thành clip dọc ≤60s — kể cả khi không nói rõ "Remotion".
  Tái dùng TOÀN BỘ pipeline của english-podcast-video (TTS, align, speed, finalize),
  chỉ khác composition hiển thị. Fan-out việc cho các agent chuyên trách. LUÔN hỏi
  đã có nội dung chưa; nếu có thì tự suy topic + level.
---

# English Reel Video (YouTube Shorts / TikTok)

Dựng **reel tiếng Anh** dọc 1080×1920 bằng pipeline **Claude → TTS → Remotion**.
Đầu ra: một MP4 dọc ≤ 60s + `.srt` + metadata (+ thumbnail nếu cần), gom trong một
project folder. Việc chuyên môn giao cho **agent** (như skill `english-podcast-video`).

> Chung hạ tầng với `english-podcast-video`: `project:new`, TTS (`dialogue:audio*`),
> `dialogue:align`, `dialogue:speed`, `project:use`, `project:finalize`. Reel chỉ
> khác **composition render**.

## 3 định dạng (hỏi người dùng chọn ở bước 2)
| # | Composition | Mô tả | Data | Cần ảnh cảnh? |
|---|---|---|---|---|
| **A** | `ReelDialogueList` | Nền trơn + tiêu đề + **cả hội thoại dạng list, tô sáng CÂU đang đọc**. Dễ làm hàng loạt. | dialogue.json chuẩn (KHÔNG cần `role`) | Không |
| **B** | `ReelComicScene` | **1 ảnh cảnh tĩnh + bong bóng thoại** đổi câu theo lượt + **end-card Subscribe**. | dialogue.json chuẩn | **Có** (Canva) |
| **C** | `Reel` | **Micro-lesson** 1 idiom/phrase: hook → phrase → nghĩa → ví dụ (karaoke) → CTA. | dialogue.json + `role` mỗi lượt | Không |

A/B dùng dialogue.json **giống hệt podcast** (2 giọng, `turns` có `speaker`/`en`).

## Các agent dùng trong pipeline (bộ agent RIÊNG cho reel + 1 dùng chung)
- **`reel-dialogue-writer`** — viết turns cho reel (A/B hội thoại ngắn, hoặc C micro-lesson). *(bước 3)*
- **`reel-scene-designer`** — thiết kế query Canva + `heads` cho ảnh cảnh dạng B. *(bước 5, chỉ B)*
- **`reel-cefr-reviewer`** — rà cấp độ/tự nhiên/độ ngắn gọn; giữ `role` cho dạng C. *(bước 3, tùy chọn)*
- **`reel-metadata-writer`** — title/description/tags tối ưu Shorts (+ `#Shorts`) + fileKeywords. *(bước 3)*
- **`reel-policy-checker`** — kiểm duyệt Shorts trước đăng (thumbnail tùy chọn, không auto-flag hoạt hình). *(bước 7b, BẮT BUỘC)*
- **Chống trùng = `npm run ledger`** (qua webhook Apps Script, KHÔNG cần MCP connector): `check` (lấy `avoid` NGAY Ở BƯỚC WRITER), `dupe` (chấm điểm trùng sau khi viết), `append` (ghi sau khi xong, idempotent theo `id`). **Nguồn chuẩn = Google Sheet online** (tab `reels`); `ledger/reels.csv` chỉ là **cache dự phòng** khi mất mạng. Cài webhook: `scripts/ledger-webhook.gs` + `ledger/webhook.json`.
- **`audio-script-verifier`** — verify audio khớp kịch bản, bắt đọc đôi. *DÙNG CHUNG với podcast* (thuần dữ liệu, không phụ thuộc định dạng). *(bước 4c, BẮT BUỘC)*

## Pipeline (TL;DR)
```bash
ID=$(npm run --silent project:new -- "<chủ đề reel>")               # 1) tạo folder
# 2) HỎI: đã có nội dung chưa? + ĐỊNH DẠNG (A/B/C) + topic/level
npm run --silent ledger -- check --tab reels                       # 3a) avoid (chống trùng)
# 3) spawn reel-dialogue-writer(+avoid) (+ reel-metadata-writer) -> ráp projects/$ID/dialogue.json
npm run --silent ledger -- dupe --tab reels --data "projects/$ID/dialogue.json"  # 3b) too-similar? -> viết lại
npm run --silent project:use -- "$ID"                               # nạp buffer sớm
npm run dialogue:audio -- -Data  "projects/$ID/dialogue.json"       # 4)  TTS
npm run dialogue:align -- --data "projects/$ID/dialogue.json"       # 4b) words[] (bỏ nếu ElevenLabs API)
npm run dialogue:speed -- --data "projects/$ID/dialogue.json"       # 4b2) tốc độ theo level
# 4c) BẮT BUỘC: spawn audio-script-verifier -> PASS mới render
# 5) (chỉ B) spawn reel-scene-designer -> tạo ảnh cảnh Canva -> public/backgrounds/<scene>.png (+ heads)
npm run --silent project:use -- "$ID"                               # 5) nạp buffer
# 5) RENDER theo định dạng (LUÔN xuất podcast-portrait.mp4):
#   A) printf '{"header":"<Tiêu đề>"}'                                    > "projects/$ID/reel.props.json"; npx remotion render ReelDialogueList "projects/$ID/podcast-portrait.mp4" --props="projects/$ID/reel.props.json"
#   B) printf '{"backgroundImage":"backgrounds/<scene>.png","heads":{...}}'> "projects/$ID/reel.props.json"; npx remotion render ReelComicScene   "projects/$ID/podcast-portrait.mp4" --props="projects/$ID/reel.props.json"
#   C) printf '{"accent":"#ffd23f"}'                                      > "projects/$ID/reel.props.json"; npx remotion render Reel             "projects/$ID/podcast-portrait.mp4" --props="projects/$ID/reel.props.json"
npm run --silent project:finalize -- "$ID" "learn english <chủ đề> shorts"   # 7) gom + .srt + metadata -> <slug>-shorts.mp4
# 7b) BẮT BUỘC: spawn reel-policy-checker
npm run --silent ledger -- append --tab reels --data "projects/$ID/dialogue.json" --format B --theme "<bucket>" --situation "<tình huống>"  # 7c) ghi sổ chống trùng
# 8) HỎI upload Google Drive
```

## Nguyên tắc bất biến
1. **Mỗi reel = 1 project folder** `projects/$ID/`. Nguồn thật = `projects/$ID/dialogue.json`.
2. `data/` chỉ là buffer → **LUÔN `project:use` trước render** và sau mỗi lần sửa dialogue.
3. **Hỏi TRƯỚC: đã có nội dung chưa.** Có → tự suy `topic` + `level` (nói rõ mức CEFR đã suy).
4. Reel **NGẮN**, mục tiêu **≤ 60s** (≈ 6–14 lượt).
5. Màn hình **chỉ tiếng Anh** (trừ khi user yêu cầu song ngữ).
6. Tham số hiển thị (header, backgroundImage, heads, accent) truyền qua `--props` — **KHÔNG sửa code mỗi video**.
7. Bản quyền: chỉ ảnh tự tạo/của user; giọng TTS theo gói đang dùng.
8. **Theo dõi tiến độ trong `projects/$ID/PROGRESS.md`** (`project:new` tạo sẵn); tick `[x]` khi xong.

## Quy trình chi tiết

### 1. Tạo project
```bash
ID=$(npm run --silent project:new -- "<chủ đề reel>")   # vd: coffee-shop_20260706-1010
```
Mở rộng `PROGRESS.md` thành việc nhỏ cho reel này, tick dần.

### 2. Hỏi ĐẦU TIÊN (dùng `AskUserQuestion`, dạng LỰA CHỌN, gộp 1 lần gọi)
- **Đã có nội dung chưa?** *Đã có* | *Chưa, để Claude viết*.
- **Định dạng?** **A — danh sách hội thoại (Recommended)** | B — cảnh + bong bóng | C — micro-lesson.
- Nếu **chưa có**: **chủ đề/ngữ cảnh** (quán cà phê / khách sạn / sân bay / bác sĩ / phỏng vấn…),
  **cấp độ** (**A2 Recommended** / B1 / B1-B2 / B2), **dùng TTS nào** (ElevenLabs web Recommended / SAPI / …).

**ĐÃ CÓ** → KHÔNG hỏi topic/level, tự suy, giữ nguyên câu chữ.

### 3. Viết `projects/$ID/dialogue.json` (fan-out AGENT)
- **CHỐNG TRÙNG trước (đọc Google Sheet online; fallback cache local):**
  ```bash
  npm run --silent ledger -- check --tab reels    # -> avoid + "source":"sheet" (hoặc "local" nếu mất mạng)
  ```
- **Spawn `reel-dialogue-writer`** (truyền `format`, `topic`, `level`, `turns`,
  `speakerNames`, `emotive`, **`avoid`** = kết quả `check`): trả `{ turns, [reelFields], notes }`.
  Agent sẽ chọn tình huống/khuôn/câu mở đầu KHÁC những gì đã có trong `avoid`.
- **Cổng kiểm trùng** (sau khi ráp dialogue.json):
  ```bash
  npm run --silent ledger -- dupe --tab reels --data "projects/$ID/dialogue.json"
  ```
  `verdict:"too-similar"` (cùng topic / opening trùng / overlap ≥ 0.4) → yêu cầu
  `reel-dialogue-writer` viết lại góc khác rồi kiểm lại tới khi `ok`.
  - Dạng **A/B**: turns hội thoại 2 người, KHÔNG `role`. Ráp `speakers` (A trái /
    B phải, đặt `color` cho tên dạng A, `side` cho bong bóng dạng B), `topic` (tiêu đề dạng A).
  - Dạng **C**: turns có `role`; đưa `reelFields` (`phrase`/`phonetic`/`hook`/`cta`/`kicker`) lên cấp document.
- (Tùy chọn) **`reel-cefr-reviewer`** rà lại turns theo `level` (giữ `role` cho dạng C).
- **`reel-metadata-writer`** → `youtubeTitle`/`youtubeDescription`/`tags` + `fileKeywords` (tối ưu Shorts, có `#Shorts`).
- Ráp tất cả vào `projects/$ID/dialogue.json` (+ `fps`, `speakers`). Để
  `audio`/`durationInSec`/`words` trống. Mẫu: `assets/reel-conversation-example.json`
  (A/B), `assets/reel-example.json` (C); trường đầy đủ: `references/reel-format.md`.
- Chạy `npm run --silent project:use -- "$ID"` để buffer sớm.

### 4. TTS + align + tốc độ (GIỐNG podcast)
```bash
npm run dialogue:audio -- -Data "projects/$ID/dialogue.json"    # SAPI mặc định; hoặc dialogue:audio:eleven:web …
npm run dialogue:align -- --data "projects/$ID/dialogue.json"   # words[] (bỏ nếu ElevenLabs API)
npm run dialogue:speed -- --data "projects/$ID/dialogue.json"   # tempo theo doc.level
```
Adapter TTS + thẻ cảm xúc: `../english-podcast-video/references/better-tts.md`; giọng SAPI:
`../english-podcast-video/references/voices.md`. Karaoke: A tô mức câu, C tô từng từ (nên có words), B không cần words.

### 4c. (BẮT BUỘC) Verify audio — TRƯỚC render
Spawn **`audio-script-verifier`** (`data: projects/$ID/dialogue.json`, sau align).
FAIL → sửa (cắt ffmpeg / sinh lại lượt) rồi chạy lại tới khi PASS.

### 5. (Chỉ định dạng B) Ảnh cảnh + Nạp + Render
**Ảnh cảnh (B):** trước hết xem thư viện `assets/scenes/` — có sẵn cảnh hợp thì copy
vào `public/backgrounds/`. Nếu chưa: **spawn `reel-scene-designer`** (truyền `topic`,
`speakers`) → nhận `{ canvaQuery, sceneName, heads, props }`. Dùng `canvaQuery` tạo
ảnh Canva (`design_type: phone_wallpaper`, 1080×1920), tải về
`public/backgrounds/<sceneName>.png`, lưu bản gốc vào `assets/scenes/<sceneName>.png`.
Luồng Canva chi tiết: `../english-podcast-video/references/canva-bg.md`.

**Nạp buffer + render** (LUÔN `project:use` trước; xuất `podcast-portrait.mp4`):
```bash
npm run --silent project:use -- "$ID"
npx remotion compositions src/index.ts     # xem composition -> số giây (nên ≤ 60s)
```

**A) `ReelDialogueList`:**
```bash
printf '{"header":"At the Coffee Shop"}' > "projects/$ID/reel.props.json"
npx remotion render ReelDialogueList "projects/$ID/podcast-portrait.mp4" --props="projects/$ID/reel.props.json"
```
Props: `header` (bỏ trống → `dialogue.topic`), `headerEmoji` (👉), `background`, `headerColor`, `textColor`, `highlightColor`, `logo`. Cỡ chữ tự co theo số lượt.

**B) `ReelComicScene`:**
```bash
printf '{"backgroundImage":"backgrounds/<scene>.png","heads":{"leftXPct":24,"leftYPct":45,"rightXPct":77,"rightYPct":50}}' > "projects/$ID/reel.props.json"
npx remotion render ReelComicScene "projects/$ID/podcast-portrait.mp4" --props="projects/$ID/reel.props.json"
```
Props: `backgroundImage` (NÊN có), **`heads`** (canh bong bóng lên đầu — số từ `reel-scene-designer`, tinh chỉnh bằng render still), `accent` (màu end-card), `endcard` (mặc định true), `logo`. Mũi bong bóng theo `speakers[].side`.

**C) `Reel`:**
```bash
printf '{"accent":"#ffd23f"}' > "projects/$ID/reel.props.json"
npx remotion render Reel "projects/$ID/podcast-portrait.mp4" --props="projects/$ID/reel.props.json"
```
Props: `accent` (#RRGGBB), `backgroundImage` (nếu muốn nền ảnh), `logo`.

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
coi thumbnail là tùy chọn, kiểm `#Shorts`, và không tự flag hoạt hình là kids.)

### 7c. (BẮT BUỘC) Ghi SỔ NỘI DUNG (chống trùng lần sau)
Sau khi finalize + kiểm duyệt xong, ghi 1 dòng vào sổ local (tự lấy topic/level/
opening/script từ dialogue.json):
```bash
npm run --silent ledger -- append --tab reels --data "projects/$ID/dialogue.json" \
  --format <A|B|C> --theme "<bucket: workplace/travel/food/…>" --situation "<tình huống>"
```
Lưu ở `ledger/reels.csv`. Lần sau bước 3 `check`/`dupe` sẽ đọc lại để tránh lặp.
> **Đồng bộ Google Sheet (không cần MCP connector):** nếu đã cài webhook Apps Script
> (`scripts/ledger-webhook.gs` + `ledger/webhook.json`), lệnh `append` TỰ POST dòng
> lên đúng tab Sheet. Muốn kéo dòng thêm tay trên Sheet về local: `npm run ledger --
> pull --tab reels`. Chưa cài webhook → chỉ lưu local (vẫn chống trùng bình thường);
> muốn đưa lên Sheet thủ công thì File→Import `ledger/reels.csv`. (Cài webhook: xem đầu file `scripts/ledger-webhook.gs`.)

### 8. (Hỏi cuối) Upload Google Drive
**HỎI: "Upload kết quả lên Google Drive không?"** Nếu CÓ → Google Drive MCP upload
folder `projects/$ID/` (chi tiết luồng `create_file`/base64/parentId ở
`../english-podcast-video/SKILL.md` mục 8).

## Tham chiếu
- `references/reel-format.md` — đầy đủ trường dialogue.json (hội thoại A/B + micro-lesson C).
- `assets/reel-conversation-example.json` (A/B) · `assets/reel-example.json` (C) — mẫu chạy được.
- `assets/scenes/` — thư viện ảnh cảnh dạng B (vd `hospital-reception.png`).
- Code: `src/reel/ReelDialogueList.tsx` (A), `src/reel/ReelComicScene.tsx` (B), `src/reel/Reel.tsx` (C); đăng ký ở `src/Root.tsx`.
- `../english-podcast-video/references/` — better-tts, voices, canva-bg, youtube-metadata.
