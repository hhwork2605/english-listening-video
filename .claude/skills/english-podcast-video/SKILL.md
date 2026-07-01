---
name: english-podcast-video
description: >-
  Tạo video học tiếng Anh dạng PODCAST cho YouTube (kiểu "Speak English With
  Class" / English Leap): một ảnh studio tĩnh + dải sóng âm chạy + transcript
  tiếng Anh karaoke làm sáng từng từ, hội thoại 2 giọng TTS luân phiên, render
  bằng Remotion; tự tạo ảnh nền + thumbnail bằng Canva. DÙNG khi người dùng muốn
  làm video/podcast/hội thoại tiếng Anh có phụ đề chạy, video luyện nghe thụ động,
  dựng conversation tiếng Anh bằng Remotion, hoặc đưa chủ đề + cấp độ nhờ dựng
  video — kể cả khi không nói rõ "Remotion"/"Canva"/"skill". LUÔN hỏi đã có kịch
  bản chưa; nếu có thì dùng nó và TỰ suy chủ đề + cấp độ CEFR, không hỏi lại. Có
  biến thể phụ: Anh-Việt + badge, và câu đơn lặp để nghe thụ động (một giọng).
---

# English Podcast Video

Dựng video học tiếng Anh kiểu podcast bằng pipeline **Claude → TTS → Remotion**:
bạn (model) viết hội thoại; TTS sinh giọng + mốc thời gian từng từ; Remotion render
MP4. Định dạng chính = MỘT ảnh tĩnh xuyên suốt + sóng âm chạy + transcript **tiếng
Anh** hiện theo cụm, **làm sáng từ đang đọc** (composition `Podcast` /
`PodcastVertical`). Đầu ra: ngang **1920×1080** (YouTube) + dọc **1080×1920**
(Shorts/TikTok), dùng chung dữ liệu.

## Nguyên tắc bất biến (đọc trước — KHÔNG vi phạm)
1. **Mỗi lần gọi = 1 project folder.** MỌI thứ của project nằm TRONG `projects/$ID/`:
   nguồn `dialogue.json`, audio (`public/audio/$ID/` khi làm việc → `finalize` gom về
   `projects/$ID/audio/`), render thẳng vào project, video/thumbnail/srt/metadata đều ở đó.
2. **Nguồn thật = `projects/$ID/dialogue.json`.** `data/` chỉ là buffer render →
   **LUÔN `project:use` trước mỗi lần render** và sau mỗi lần sửa dialogue.
3. **LUÔN hỏi "đã có kịch bản chưa" TRƯỚC.** Nếu có → TỰ suy `topic` + `level`,
   KHÔNG hỏi lại chủ đề/cấp độ/độ dài.
4. **LUÔN tạo thumbnail + `.srt`** cho mỗi video (bước 6 + 7). **LUÔN ghép intro
   `public/intro.mp4` TRƯỚC finalize** (bước 6b) — bắt buộc, không hỏi.
5. Định dạng chính: màn hình **chỉ tiếng Anh** — không badge, không tiếng Việt.
6. Ảnh nền/tiêu đề truyền qua `--props` lúc render — **KHÔNG sửa code mỗi video**.
7. Bản quyền: chỉ dùng ảnh tự tạo/của người dùng, **KHÔNG tái dùng ảnh kênh khác**.
8. **Theo dõi tiến độ trong `projects/$ID/PROGRESS.md`** (`project:new` tạo sẵn khung).
   TRƯỚC khi bắt tay: mở rộng "Việc chính" thành các việc nhỏ cụ thể cho video này.
   Làm xong việc nào **tick `[x]`** ngay; task phát sinh + lỗi + chỗ đang dở đều ghi
   vào đó (NGẮN gọn). Nếu vào một project đang dở/lỗi: **đọc `PROGRESS.md` trước** để
   biết làm tiếp từ đâu (kết hợp trạng thái thật: file audio đã có, `turn.audio` trong
   dialogue.json…).

## Pipeline (TL;DR — chi tiết ở các bước dưới)
```bash
cp -r "<SKILL_DIR>/assets/template" "<TARGET_DIR>" && cd "<TARGET_DIR>" && npm install  # 1) chỉ lần đầu
ID=$(npm run --silent project:new -- "<chủ đề>")                                         # 1) tạo folder
# 2) HỎI: đã có kịch bản chưa?   3) viết projects/$ID/dialogue.json (+ topic/level/metadata)
npm run dialogue:audio    -- -Data  "projects/$ID/dialogue.json"    # 4)  TTS (SAPI mặc định)
npm run dialogue:align    -- --data "projects/$ID/dialogue.json"    # 4b) karaoke (bỏ nếu dùng ElevenLabs)
npm run --silent project:use -- "$ID"                              # 5)  nạp buffer data/
npx remotion render Podcast "projects/$ID/podcast.mp4" --props="projects/$ID/podcast.props.json"       # 5)
npx remotion still src/index.ts Thumbnail "projects/$ID/thumbnail.png" --props="projects/$ID/thumb.props.json"  # 6)
npm run video:intro -- --video "projects/$ID/podcast.mp4" --intro public/intro.mp4 --replace   # 6b) BẮT BUỘC: ghép intro TRƯỚC finalize (không hỏi)
npm run --silent project:finalize -- "$ID"                        # 7)  gom + .srt + metadata
# 9) HỎI upload Google Drive → dùng Google Drive MCP
```

> Biến thể phụ "2 nhân vật + phụ đề Anh-Việt + badge" (`PodcastVideo`, không đăng ký
> mặc định): bỏ qua trừ khi người dùng hỏi.

## Quy trình chi tiết

### 1. Chuẩn bị project
Copy template rồi tạo folder (slug lấy từ chủ đề — biết chủ đề ở bước 2 mới tạo):
```bash
cp -r "<SKILL_DIR>/assets/template" "<TARGET_DIR>"   # <SKILL_DIR> = thư mục chứa SKILL.md này
cd "<TARGET_DIR>" && npm install                      # ~1 phút, chỉ lần đầu mỗi project
ID=$(npm run --silent project:new -- "<chủ đề>")     # vd: animals_20260624-1340
```
Đã có project cũ từ template → dùng lại, bỏ copy + install.

`project:new` tạo sẵn `projects/$ID/PROGRESS.md` (checklist tiến độ). **Mở rộng nó
thành các việc nhỏ cụ thể cho video này rồi tick dần** (xem nguyên tắc #8).

### 2. Hỏi ĐẦU TIÊN: đã có kịch bản chưa?
**LUÔN hỏi bằng câu hỏi DẠNG LỰA CHỌN (dùng tool `AskUserQuestion`), KHÔNG hỏi mở.**
Người dùng đã cấu hình sẵn nhiều thứ (giọng trong `.env`, mẫu ảnh…) và chỉ muốn
**bấm chọn** — nên mọi câu hỏi phải kèm sẵn các phương án để chọn (luôn có sẵn
"Other" để họ tự gõ nếu cần). Đặt phương án mặc định lên đầu + ghi "(Recommended)".

Câu hỏi đầu tiên (lựa chọn): **"Bạn đã có sẵn kịch bản chưa?"** → 2 phương án:
*Đã có (mình sẽ dán/đưa file)* | *Chưa, để Claude viết*.

**A) ĐÃ CÓ** (dán nội dung / đưa file): **KHÔNG hỏi chủ đề/cấp độ** — tự suy:
- `topic`: cụm ngắn mô tả nội dung (vd "Talking About Money Habits").
- `level`: CEFR theo độ khó từ vựng/ngữ pháp/độ dài câu (A2 / B1 / B1-B2 / B2 /
  B2-C1 / C1). **Nói rõ cấp độ đã suy** cho người dùng biết.
- Độ dài = theo kịch bản. Chỉ còn hỏi (nếu cần) bằng LỰA CHỌN: **định dạng**
  (ngang / dọc / cả hai) và **dùng TTS nào**.

**B) CHƯA CÓ** — hỏi **một loạt câu LỰA CHỌN** (gộp trong 1 lần gọi `AskUserQuestion`,
mỗi tiêu chí một câu, mỗi câu vài phương án bấm chọn):
- **Chủ đề**: đưa 3–4 gợi ý hợp cấp độ (+ "Other" để tự nhập).
- **Cấp độ**: A1 / A2 / B1 / **B1-B2 (Recommended)** / B2 / B2-C1 / C1.
- **Độ dài**: ~5 phút / **~10 phút (Recommended)** / ~15 phút… (ước lượng
  **~12 lượt ≈ 1 phút** → 10 phút ≈ 120 lượt).
- **Định dạng**: cả hai / chỉ ngang / chỉ dọc.
- **Dùng TTS nào**: SAPI (Zira/David) / AI Studio / ElevenLabs / Gemini / gommo.
  **KHÔNG hỏi "giọng nào"** — mỗi TTS đã cấu hình sẵn giọng trong `.env`
  (vd `AISTUDIO_VOICE_A/_B`, `ELEVEN_VOICE_A/_B`, `GEMINI_VOICE_A/_B`…); chỉ cần
  người dùng chọn adapter, giọng tự lấy từ `.env` (xem bước 4).

### 3. Dựng `projects/$ID/dialogue.json`
Viết file NGUỒN vào **`projects/$ID/dialogue.json`** (KHÔNG phải `data/`).

**Nhánh A — đã có kịch bản:** chuyển thành `turns`, **giữ nguyên câu chữ** (chỉ
chuẩn hoá nhẹ nếu khó đọc TTS). Có nhãn người nói → map A/B đúng; đoạn văn liền →
tự tách lượt, gán A/B xen kẽ. Điền `topic`, `level`, và metadata YouTube. Để
`audio`/`durationInSec`/`words` trống → sang bước 4.

**Nhánh B — tự viết** (bạn là model sinh nội dung, không cần API key):
- Hội thoại tự nhiên, đời thường, **luân phiên A/B, bắt đầu bằng A**; mỗi lượt 1–2
  câu đúng cấp độ, có câu hỏi nối cho mạch trôi chảy (như podcast thật).
- **Không cần `vi`** ở định dạng chính (chỉ viết nếu làm biến thể Anh-Việt).
- Video dài: viết theo cụm ~30–40 lượt quanh từng khía cạnh rồi nối lại, giữ mạch.

Cấu trúc (đầy đủ trường: `references/data-format.md`):
```json
{
  "title": "English Podcast | <chủ đề>",
  "level": "B1-B2",
  "topic": "<chủ đề ngắn — dùng cho thumbnail & tên file, KHÔNG hiện trên video>",
  "youtubeTitle": "<móc tò mò, < 50 ký tự>",
  "youtubeDescription": "<2-4 câu + CTA + 3-5 hashtag>",
  "tags": ["learn english", "english podcast", "b1 english"],
  "fps": 30,
  "speakers": {
    "A": { "name": "Emma", "voice": "Microsoft Zira Desktop", "side": "left",  "color": "#f48fb1" },
    "B": { "name": "Mike", "voice": "Microsoft David Desktop", "side": "right", "color": "#64b5f6" }
  },
  "turns": [
    { "id": "001", "speaker": "A", "en": "...", "audio": "", "durationInSec": 0, "pauseAfterSec": 0.4 }
  ]
}
```
`id` đánh số `001`, `002`… **Metadata YouTube** (`youtubeTitle`/`youtubeDescription`/
`tags`) — công thức + ví dụ ở `references/youtube-metadata.md` (hoặc để agent
`youtube-metadata-writer` sinh ở 3b).

### 3b. (Khuyến nghị cho video dài) Fan-out subagent chuyên gia
Chia việc cho các subagent trong `.claude/agents/` chạy **song song** rồi nối:
1. **Chia khía cạnh**: tách `topic` thành N khía cạnh (vd 3–4 cho ~120 lượt), mỗi
   cụm ~30–40 lượt; xác định cụm mở đầu / giữa / kết.
2. **Spawn `english-dialogue-writer` song song** — mỗi agent một khía cạnh, truyền
   `topic`, `aspect`, `level`, `turns`, `startSpeaker`, `startId` (lệch nhau),
   `context`, `includeVi`. Trả `{ turns: [...] }`.
3. **Nối** theo thứ tự; đánh lại `id` liên tục 3 chữ số; bảo đảm luân phiên A/B ở chỗ ghép.
4. **Spawn `dialogue-cefr-reviewer`** (truyền `level`) → `turns` chuẩn hoá + báo cáo.
5. **Spawn `youtube-metadata-writer`** → điền `title`, `topic`, metadata YouTube.
6. Ráp vào `projects/$ID/dialogue.json` (+ `fps`, `speakers`) → bước 4.

Video ngắn: gọi lần lượt `english-dialogue-writer` → `dialogue-cefr-reviewer` →
`youtube-metadata-writer`, hoặc tự viết tay theo nhánh B. Các agent là tùy chọn.

### 4. Sinh giọng đọc + mốc từng từ
```bash
npm run dialogue:audio -- -Data "projects/$ID/dialogue.json"
```
`tts-dialogue.ps1` đọc từng lượt bằng giọng speaker tương ứng, ghi
`public/audio/$ID/d<id>.wav` (**namespace theo project — không đè project khác**) và
điền `durationInSec` + `words[]` vào `projects/$ID/dialogue.json`.

**Giọng tự nhiên hơn** (thay bước 4 — chi tiết `references/better-tts.md`):
- `dialogue:audio:eleven` — ElevenLabs, trả LUÔN `words[]` khớp tuyệt đối → **bỏ
  qua 4b**. Cần `ELEVENLABS_API_KEY`. Khuyến nghị cho kênh chính thức.
- `dialogue:audio:gemini` — Gemini TTS free (cần `GEMINI_API_KEY`).
- `dialogue:audio:aistudio -- ... --cdp 9222` — lái web AI Studio, không tốn quota
  (cần Chrome mở cổng debug + đã đăng nhập; xem đầu `scripts/tts-aistudio.mjs`).
- `dialogue:audio:gommo` — nhiều model qua nền tảng (cần `GOMMO_ACCESS_TOKEN`).

Trừ ElevenLabs, các adapter còn lại **không trả mốc từ → chạy bước 4b**. Kiểm tra
giọng SAPI có sẵn: `references/voices.md`.

> **Thẻ cảm xúc:** ElevenLabs, Gemini và AI Studio đều nhận `turn.enTts` (bản có
> tag `[...]`) nếu có, giữ `turn.en` sạch cho `.srt`. Bộ tag của Google KHÁC
> ElevenLabs và một số tag dễ bị đọc to — chỉ dùng nhóm an toàn, xem
> `references/better-tts.md`.

### 4b. (Khuyến nghị) Forced-align để highlight khớp tuyệt đối
> Chỉ cần khi TTS không trả `words[]` (SAPI/Gemini/gommo/aistudio). ElevenLabs thì BỎ QUA.

SAPI chỉ cho mốc bắt đầu → highlight có thể "dính" qua khoảng nghỉ. Whisper lấy
mốc bắt đầu + kết thúc THẬT (offline, miễn phí):
```bash
pip install faster-whisper truststore   # một lần; truststore cho proxy SSL doanh nghiệp
npm run dialogue:align -- --data "projects/$ID/dialogue.json"   # ghi đè words[]
```
Bỏ bước này thì highlight vẫn chạy nhưng chỉ gần đúng.
> `dialogue:audio` (PowerShell) ghi file có BOM; align đọc `utf-8-sig` + ghi lại không BOM.

### 5. Nạp project vào data/ rồi render
**LUÔN `project:use` trước khi render** (Remotion import tĩnh `data/`); chạy lại
mỗi khi sửa dialogue:
```bash
npm run --silent project:use -- "$ID"      # copy projects/$ID/dialogue.json -> data/
npx remotion compositions src/index.ts     # xem Podcast dài bao nhiêu giây
```
Lệch mục tiêu → thêm/bớt lượt rồi chạy lại bước 4 + `project:use` (chỉ lượt mới được sinh).

**Ảnh nền cố định** (tạo nên "1 ảnh xuyên suốt"): nếu có Canva MCP, tự tạo ảnh
studio 2 host hợp chủ đề, tải về `public/backgrounds/scene.png` — **các bước Canva
+ query mẫu: `references/canva-bg.md`**. Không có Canva → đặt ảnh của người dùng vào
`public/backgrounds/scene.png`.

Render **thẳng vào project folder**, ảnh nền qua `--props`:
```bash
printf '{"backgroundImage":"backgrounds/scene.png"}' > "projects/$ID/podcast.props.json"
npx remotion render Podcast "projects/$ID/podcast.mp4" --props="projects/$ID/podcast.props.json"
```
**Bản dọc** cần ảnh khung dọc riêng (`public/backgrounds/scene-vertical.png` — xem
`references/canva-bg.md`):
```bash
printf '{"backgroundImage":"backgrounds/scene-vertical.png"}' > "projects/$ID/podcast-vertical.props.json"
npx remotion render PodcastVertical "projects/$ID/podcast-portrait.mp4" --props="projects/$ID/podcast-vertical.props.json"
```

### 6. Thumbnail (LUÔN tạo mỗi video)
Thumbnail = ảnh 2 nhân vật (chừa giữa trống) + Remotion phủ chữ + **logo kênh góc
phải dưới**. **Khuyến nghị: spawn subagent `youtube-thumbnail-designer`** (truyền
`topic`, `level`, `speakers`, tóm tắt/turns) để nó thiết kế concept hợp hội thoại →
trả JSON `{ props: { title, kicker, channel, backgroundImage }, canvaQuery, notes }`.
Dùng `canvaQuery` tạo ảnh nền Canva `youtube_thumbnail`, tải về
`public/thumbnails/scene.png` (**chi tiết + cách tải: `references/canva-bg.md`**),
rồi render bằng `props` của agent:
```bash
printf '{"backgroundImage":"thumbnails/scene.png","title":"FOOD & DRINK","kicker":"TALK ABOUT"}' > "projects/$ID/thumb.props.json"
npx remotion still src/index.ts Thumbnail "projects/$ID/thumbnail.png" --props="projects/$ID/thumb.props.json"
```
- **Logo kênh**: composition `Thumbnail` **LUÔN tự phủ `public/logo.jpg`** ở góc PHẢI
  DƯỚI (tròn, viền trắng) — không cần truyền gì; đặt `"logo":""` trong props để ẩn.
  Vì vậy concept/ảnh nền phải **chừa góc phải dưới thoáng** (agent đã lo trong query).
- `title` = danh từ chính của chủ đề (vd "Talking About Your Weekend" → `YOUR WEEKEND`),
  tránh lặp pill `kicker`. Không có Canva → bỏ `backgroundImage`, `Thumbnail` tự vẽ nền
  gradient + 2 avatar chữ cái (logo vẫn hiện).

### 6b. Ghép intro (BẮT BUỘC — trước finalize, KHÔNG hỏi)
Luôn ghép intro `public/intro.mp4` vào đầu video **trước** khi finalize, ghép thẳng
vào `podcast.mp4` (và bản dọc nếu có) bằng `add-intro.mjs` (cần `ffmpeg`+`ffprobe`):
```bash
npm run video:intro -- --video "projects/$ID/podcast.mp4" --intro public/intro.mp4 --replace           # ngang
npm run video:intro -- --video "projects/$ID/podcast-portrait.mp4" --intro public/intro.mp4 --replace  # dọc (nếu render bản dọc)
# tuỳ chọn: --outro <path>
```
Dùng `--video <path> --replace` (KHÔNG dùng `--id`) để ghi đè thẳng file render, nhờ
đó `finalize` đổi tên bản ĐÃ có intro thành `<slug>.mp4`. Script tự chuẩn hoá
intro/outro về đúng độ phân giải/fps/SAR + audio 48k stereo rồi nối (re-encode).
Không có `public/intro.mp4` → báo người dùng đặt file vào đó rồi mới finalize.

### 7. Gom mọi thứ + đặt tên theo từ khóa
```bash
npm run --silent project:finalize -- "$ID"                                  # tên = slug(chủ đề + cấp độ)
npm run --silent project:finalize -- "$ID" "learn english animals conversation"  # hoặc từ khóa SEO riêng
```
Việc này: copy dialogue + ảnh nền + thumbnail-bg + `audio/` (chỉ file đang dùng) +
`project.json`; **đổi tên** kết quả sang slug tiếng Anh không dấu (`<slug>.mp4`,
`<slug>-shorts.mp4`, `<slug>-thumbnail.png`); **tạo `.srt`** (timestamp tuyệt đối,
mỗi lượt 1 cue — LUÔN tạo, đính kèm khi upload để YouTube phân phối đúng); xuất
**MỘT file `youtube-metadata.txt`** chia rõ 3 phần `===== TITLE / DESCRIPTION /
TAGS =====`; dọn `*.props.json` tạm.

Báo lại: đường dẫn folder, tên file, tiêu đề/mô tả/tags, và nhắc đính kèm `.srt`.

### 8. (Hỏi cuối cùng) Upload lên Google Drive
Sau khi `finalize` xong, **HỎI người dùng: "Bạn có muốn upload kết quả lên Google
Drive không?"** Nếu KHÔNG thì kết thúc. Nếu CÓ, dùng **Google Drive MCP** upload vào
thư mục đích (mặc định):
`https://drive.google.com/drive/folders/1TNL6whGzBi1hfGzGLf2ar_kW0sQzpaLL`
(folder id = `1TNL6whGzBi1hfGzGLf2ar_kW0sQzpaLL`).

1. **Tạo subfolder** cho gọn: `create_file` với `mimeType:
   "application/vnd.google-apps.folder"`, `title: "<slug>"`, `parentId:
   "1TNL6whGzBi1hfGzGLf2ar_kW0sQzpaLL"` → lấy `id` subfolder.
2. **Upload từng file** trong `projects/$ID/` vào subfolder (`parentId` = id trên):
   - Nhị phân (mp4/png): `create_file` với `base64Content` = nội dung base64,
     `contentMimeType` (`video/mp4` | `image/png`), `disableConversionToGoogleType: true`.
   - Text (.srt / youtube-metadata.txt / project.json): `textContent` +
     `disableConversionToGoogleType: true` (để không bị đổi thành Google Docs).
   - Lấy base64: `node -e "process.stdout.write(require('fs').readFileSync('<path>').toString('base64'))"`.
3. **Ưu tiên** (theo `project.json`): `<slug>.mp4`, `<slug>-shorts.mp4`,
   `<slug>-thumbnail.png`, `<slug>.srt`, `youtube-metadata.txt`, `project.json`.
4. Xong thì báo link subfolder cho người dùng.

> **Lưu ý:** (a) MCP có thể cần **re-authorize** (nếu báo token expired → nhắc người
> dùng kết nối lại Google Drive rồi thử lại). (b) MP4 dài rất lớn → upload base64 qua
> MCP có thể vượt giới hạn payload; nếu MP4 lỗi/quá lớn thì upload các file nhẹ trước
> (thumbnail, .srt, metadata, bản shorts) và báo người dùng kéo-thả MP4 lớn thủ công.

## Sóng âm chạy xuyên suốt (tự động — chống trùng nội dung)
Mọi composition đã có dải sóng âm chuyển động liên tục, phản ứng theo audio + một
sàn dao động luôn chạy. Vì bám nội dung âm thanh riêng nên mỗi video khác nhau →
tránh YouTube gắn cờ nội dung lặp. Đổi màu/độ cao: `src/components/AudioWaveform.tsx`.

## Tùy biến (khi người dùng muốn)
- **Ảnh nhân vật**: PNG vào `public/characters/` + `"image": "characters/emma.png"`
  trong speaker. Không có → avatar chữ cái.
- **Nhạc nền**: file vào `public/bgm/`, truyền `bgm` qua defaultProps `src/Root.tsx`
  (âm lượng thấp ~0.08).
- **Màu nhấn / vị trí**: trường `color`, `side` trong `speakers`.
- **Giọng tự nhiên hơn**: xem bước 4 + `references/better-tts.md`.

## Định dạng phụ: nghe thụ động câu đơn (1 giọng)
Composition `LandscapeVideo`/`PortraitVideo` cho kiểu "một câu, lặp lại, có nghỉ"
dùng `script.json`. Cùng nguyên tắc per-project:
```bash
npm run generate:audio:sapi -- -Data "projects/$ID/script.json"   # TTS + words[] (ghi public/audio/$ID/)
npm run --silent project:use -- "$ID"
npm run render:landscape
```
Chi tiết: `references/data-format.md`.

## Lưu ý trung thực
- Giọng SAPI miễn phí/offline, đủ để test nhưng máy móc — nói rõ nếu người dùng làm
  kênh nghiêm túc (khuyên ElevenLabs).
- Dấu câu cuối câu (vd `?`) đôi khi thiếu mốc từ SAPI → không nằm trong highlight;
  phụ đề vẫn đủ. Chỉnh tay `words[]` nếu cần.
- `@remotion/media-parser` (`scripts/measure-duration.ts`) có thể cần license
  thương mại — xem remotion.dev/license.

## Tham khảo
- `references/data-format.md` — đầy đủ trường của `dialogue.json` và `script.json`.
- `references/voices.md` — chọn & cài giọng SAPI.
- `references/better-tts.md` — ElevenLabs / Gemini / gommo / OpenAI cho giọng thật.
- `references/canva-bg.md` — tạo ảnh nền studio + thumbnail bằng Canva MCP.
- `references/youtube-metadata.md` — công thức title / description / tags.
