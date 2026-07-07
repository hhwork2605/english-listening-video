---
name: english-podcast-video
description: >-
  Tạo video học tiếng Anh dạng PODCAST cho YouTube (kiểu "Speak English With
  Class" / English Leap): một ảnh studio tĩnh + dải sóng âm chạy + transcript
  tiếng Anh karaoke làm sáng từng từ, hội thoại 2 giọng TTS luân phiên, render
  bằng Remotion; tự tạo ảnh nền + thumbnail bằng Canva. DÙNG khi người dùng muốn
  làm video/podcast/hội thoại tiếng Anh có phụ đề chạy, video luyện nghe thụ động,
  dựng conversation tiếng Anh bằng Remotion, hoặc đưa chủ đề + cấp độ nhờ dựng
  video — kể cả khi không nói rõ "Remotion"/"Canva"/"skill". MẶC ĐỊNH TỰ VIẾT
  kịch bản (KHÔNG hỏi "đã có kịch bản chưa"); nếu người dùng ĐƯA sẵn kịch bản thì
  dùng nó và TỰ suy chủ đề + cấp độ CEFR, không hỏi lại. Có biến thể phụ:
  Anh-Việt + badge, và câu đơn lặp để nghe thụ động (một giọng).
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
3. **KHÔNG hỏi "đã có kịch bản chưa" — mặc định TỰ VIẾT kịch bản.** Chỉ khi người
   dùng ĐƯA sẵn kịch bản (dán/file) thì dùng nó → TỰ suy `topic` + `level`,
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
cd "<REPO_ROOT>"                                                    # 1) repo pipeline (chứa SKILL.md này, đã npm install)
ID=$(npm run --silent project:new -- "<chủ đề>")                    # 1) tạo folder
# 2) KHÔNG hỏi kịch bản — mặc định TỰ viết (user đưa sẵn thì dùng); chỉ hỏi thông số còn thiếu
npm run --silent ledger -- check --tab video                        # 3a) chống trùng -> avoid
# 3) viết projects/$ID/dialogue.json (+ topic/level/metadata)
npm run --silent ledger -- dupe --tab video --data "projects/$ID/dialogue.json"  # 3b) too-similar? -> viết lại
npm run dialogue:audio    -- -Data  "projects/$ID/dialogue.json"    # 4)  TTS (SAPI mặc định)
npm run dialogue:align    -- --data "projects/$ID/dialogue.json"    # 4b) karaoke (bỏ nếu dùng ElevenLabs API)
npm run dialogue:speed    -- --data "projects/$ID/dialogue.json"    # 4b2) tốc độ giọng theo level (A1 0.8 … B2+ giữ nguyên)
# 4c) BẮT BUỘC: spawn agent audio-script-verifier → PASS mới được render (bắt đọc đôi/thiếu/sai)
npm run --silent project:use -- "$ID"                              # 5)  nạp buffer data/
npx remotion render Podcast "projects/$ID/podcast.mp4" --props="projects/$ID/podcast.props.json"       # 5)
npx remotion still src/index.ts Thumbnail "projects/$ID/thumbnail.png" --props="projects/$ID/thumb.props.json"  # 6)
npm run video:intro -- --video "projects/$ID/podcast.mp4" --intro public/intro.mp4 --replace   # 6b) BẮT BUỘC: ghép intro TRƯỚC finalize (không hỏi)
npm run --silent project:finalize -- "$ID"                        # 7)  gom + .srt + metadata
# 7b) BẮT BUỘC: spawn youtube-policy-checker
npm run --silent ledger -- append --tab video --data "projects/$ID/dialogue.json" --theme "<bucket>" --situation "<mô tả>"  # 7c) ghi sổ chống trùng
# 8) HỎI upload Google Drive → dùng rclone (toàn bộ, kể cả tạo subfolder)
```

> Biến thể phụ "2 nhân vật + phụ đề Anh-Việt + badge" (`PodcastVideo`, không đăng ký
> mặc định): bỏ qua trừ khi người dùng hỏi.

## Quy trình chi tiết

### 1. Chuẩn bị project
Làm việc TRỰC TIẾP trong repo pipeline (repo chứa SKILL.md này — thường là
`d:\english-listening-video`; mỗi video là một folder con `projects/<id>/`,
KHÔNG copy code đi đâu). Tạo folder (slug lấy từ chủ đề — biết chủ đề ở bước 2
mới tạo):
```bash
cd "<REPO_ROOT>"                                  # nếu chưa đứng ở repo; npm install nếu thiếu node_modules
ID=$(npm run --silent project:new -- "<chủ đề>")  # vd: animals_20260624-1340
```

`project:new` tạo sẵn `projects/$ID/PROGRESS.md` (checklist tiến độ). **Mở rộng nó
thành các việc nhỏ cụ thể cho video này rồi tick dần** (xem nguyên tắc #8).

### 2. Kịch bản: MẶC ĐỊNH TỰ VIẾT — KHÔNG hỏi "đã có kịch bản chưa"
**Không hỏi người dùng đã có kịch bản hay chưa.** Mặc định = **bạn (Claude) tự
viết kịch bản** (nhánh B). Chỉ khi người dùng **chủ động đưa** kịch bản (dán vào
tin nhắn / đưa file) thì mới theo nhánh A.

Khi cần hỏi thông số, **LUÔN hỏi DẠNG LỰA CHỌN (tool `AskUserQuestion`), KHÔNG
hỏi mở** — người dùng đã cấu hình sẵn nhiều thứ (giọng trong `.env`, mẫu ảnh…) và
chỉ muốn **bấm chọn** (luôn có "Other" để tự gõ). Đặt phương án mặc định lên đầu
+ ghi "(Recommended)". Thông số nào người dùng ĐÃ nói trong tin nhắn (chủ đề, cấp
độ, độ dài…) thì KHÔNG hỏi lại.

**A) Người dùng ĐƯA sẵn kịch bản**: **KHÔNG hỏi chủ đề/cấp độ** — tự suy:
- `topic`: cụm ngắn mô tả nội dung (vd "Talking About Money Habits").
- `level`: CEFR theo độ khó từ vựng/ngữ pháp/độ dài câu (A2 / B1 / B1-B2 / B2 /
  B2-C1 / C1). **Nói rõ cấp độ đã suy** cho người dùng biết.
- Độ dài = theo kịch bản. Chỉ còn hỏi (nếu cần) bằng LỰA CHỌN: **định dạng**
  (ngang / dọc / cả hai) và **dùng TTS nào**.

**B) TỰ VIẾT (mặc định)** — hỏi **một loạt câu LỰA CHỌN** cho các thông số còn
thiếu (gộp trong 1 lần gọi `AskUserQuestion`, mỗi tiêu chí một câu, mỗi câu vài
phương án bấm chọn), rồi TỰ viết kịch bản ở bước 3 — không cần người dùng duyệt
nháp trước:
- **Chủ đề**: đưa 3–4 gợi ý hợp cấp độ (+ "Other" để tự nhập) — dựa `ledger check`
  để gợi ý chủ đề CHƯA làm.
- **Cấp độ**: A1 / A2 / B1 / **B1-B2 (Recommended)** / B2 / B2-C1 / C1.
- **Độ dài**: ~5 phút / **~10 phút (Recommended)** / ~15 phút… (ước lượng
  **~12 lượt ≈ 1 phút** → 10 phút ≈ 120 lượt).
- **Định dạng**: cả hai / chỉ ngang / chỉ dọc.
- **Dùng TTS nào**: ElevenLabs web (v3, lái Chrome — Recommended) / SAPI (Zira/David) /
  AI Studio / ElevenLabs API / Gemini / aivideoauto (web) / GenMax API.
  **KHÔNG hỏi "giọng nào"** — mỗi TTS đã cấu hình sẵn giọng trong `.env`
  (vd `ELEVEN_WEB_VOICE_A/_B`, `AISTUDIO_VOICE_A/_B`, `ELEVEN_VOICE_A/_B`,
  `GEMINI_VOICE_A/_B`, `AIVA_VOICE_A/_B`, `GENMAX_VOICE_A/_B`…); chỉ cần người
  dùng chọn adapter, giọng tự lấy từ `.env` (xem bước 4).

### 3. Dựng `projects/$ID/dialogue.json`
Viết file NGUỒN vào **`projects/$ID/dialogue.json`** (KHÔNG phải `data/`).

**CHỐNG TRÙNG (đọc SỔ NỘI DUNG — tab `video`):** trước khi viết, chạy
`npm run --silent ledger -- check --tab video` để lấy `avoid` (topics/openings/…đã
làm) và né lặp. Sau khi ráp xong dialogue.json, kiểm:
`npm run --silent ledger -- dupe --tab video --data "projects/$ID/dialogue.json"` —
`too-similar` (cùng chủ đề / opening trùng / overlap ≥ 0.4) thì đổi góc, viết lại.
Ledger là ONLINE-ONLY: nguồn duy nhất = Google Sheet, BẮT BUỘC có webhook
(`ledger/webhook.json`; cài lần đầu: `scripts/ledger-webhook.gs`) — thiếu
webhook/mất mạng thì lệnh báo lỗi, không fallback offline.

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
   `context`, `includeVi`, **`avoid`** (từ `ledger check --tab video` ở bước 3 — để
   né trùng NGAY khi viết). Trả `{ turns: [...] }`.
3. **Nối** theo thứ tự; đánh lại `id` liên tục 3 chữ số; bảo đảm luân phiên A/B ở chỗ ghép.
4. **Spawn `dialogue-cefr-reviewer`** (truyền `level`) → `turns` chuẩn hoá + báo cáo.
5. **Spawn `youtube-metadata-writer`** → điền `title`, `topic`, metadata YouTube
   + `fileKeywords` (cụm từ khóa tiếng Anh đặt tên file — dùng ở bước 7). Agent
   tự chạy `scripts/keyword-suggest.mjs` (YouTube/Google autocomplete) để tra cụm
   từ khóa đang được tìm thật rồi mới viết tags/description.
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

> **BẮT BUỘC `--data`/`-Data`:** mọi script TTS + `dialogue:align` KHÔNG còn default
> `data/dialogue.json` (buffer đó thường chứa project CŨ) — thiếu tham số là script
> thoát lỗi ngay. Các script cũng KHÔNG có cờ `--help` — đừng chạy thử để xem usage
> (usage nằm ở comment đầu file); khi chạy, script in banner `Nguồn kịch bản: <path>
> — <title> | topic | số lượt` — liếc dòng này để chắc đúng project.
>
> **Buffer `data/` tự đồng bộ:** khi `--data` trỏ vào `projects/<id>/…`, các script
> TTS + align sau mỗi lần lưu sẽ TỰ ghi đè bản mới nhất lên `data/dialogue.json`
> (SAPI script.json → `data/script.json`). Ngoài ra, NGAY SAU khi viết xong
> `projects/$ID/dialogue.json` (bước 3), chạy luôn `npm run --silent project:use --
> "$ID"` để buffer là project hiện tại từ sớm. `project:use` trước render VẪN là
> quy tắc bắt buộc (chốt chặn cuối).

**Giọng tự nhiên hơn** (thay bước 4 — chi tiết `references/better-tts.md`):
- `dialogue:audio:eleven:web -- ... --cdp 9223` — **lái web ElevenLabs (Eleven v3,
  KHUYẾN NGHỊ)**: dùng credit tài khoản web thay API key, hỗ trợ audio tag cảm xúc.
  Cần Chrome mở cổng debug 9223 + đã đăng nhập (chạy được khi Chrome minimized —
  lệnh mở Chrome kèm cờ: xem đầu `scripts/tts-elevenlabs-web.mjs`). Giọng theo TÊN
  hiển thị (`ELEVEN_WEB_VOICE_A/_B`). KHÔNG trả mốc từ → chạy 4b.
- `dialogue:audio:eleven` — ElevenLabs API, trả LUÔN `words[]` khớp tuyệt đối →
  **bỏ qua 4b**. Cần `ELEVENLABS_API_KEY` còn hạn mức.
- `dialogue:audio:gemini` — Gemini TTS free (cần `GEMINI_API_KEY`).
- `dialogue:audio:aistudio -- ... --cdp 9222` — lái web AI Studio, không tốn quota
  (cần Chrome mở cổng debug + đã đăng nhập; xem đầu `scripts/tts-aistudio.mjs`).
- `dialogue:audio:aiva` — lái web aivideoauto Voice Studio bằng Playwright, nhiều
  model (Eleven V3, Minimax, Omnivoice; trả bằng credit nền tảng). Đăng nhập tay
  1 lần khi chạy headed, hoặc `--cdp 9222` với Chrome đã đăng nhập.
- `dialogue:audio:genmax` — GenMax API (api.genmax.io, cần `GENMAX_API_KEY`):
  gateway REST cho ElevenLabs / MiniMax / CapCut, trả bằng credit GenMax. Async
  (submit → poll `/v1/history/{id}` → tải mp3), giọng `GENMAX_VOICE_A/_B`
  (voice_id PHẢI khớp provider). KHÔNG trả mốc từ → chạy 4b.

Trừ ElevenLabs **API**, các adapter còn lại (kể cả ElevenLabs **web**) **không trả
mốc từ → chạy bước 4b**. Kiểm tra giọng SAPI có sẵn: `references/voices.md`.

> **Thẻ cảm xúc:** ElevenLabs (API + web), Gemini và AI Studio đều nhận `turn.enTts`
> (bản có tag `[...]`) nếu có, giữ `turn.en` sạch cho `.srt`. Bộ tag của Google KHÁC
> ElevenLabs và một số tag dễ bị đọc to — chỉ dùng nhóm an toàn, xem
> `references/better-tts.md`.

### 4b. (Khuyến nghị) Forced-align để highlight khớp tuyệt đối
> Chỉ cần khi TTS không trả `words[]` (SAPI/Gemini/aivideoauto/aistudio/ElevenLabs **web**).
> ElevenLabs **API** thì BỎ QUA.

SAPI chỉ cho mốc bắt đầu → highlight có thể "dính" qua khoảng nghỉ. Whisper lấy
mốc bắt đầu + kết thúc THẬT (offline, miễn phí):
```bash
pip install faster-whisper truststore   # một lần; truststore cho proxy SSL doanh nghiệp
npm run dialogue:align -- --data "projects/$ID/dialogue.json"   # ghi đè words[]
```
Bỏ bước này thì highlight vẫn chạy nhưng chỉ gần đúng.
> `dialogue:audio` (PowerShell) ghi file có BOM; align đọc `utf-8-sig` + ghi lại không BOM.

### 4b2. Tốc độ giọng theo CẤP ĐỘ (chạy SAU align, TRƯỚC verify)
Level thấp phải nghe chậm hơn. Sau khi có `words[]`, chỉnh tốc độ bằng một lệnh
(ffmpeg atempo — giữ cao độ, dùng được cho MỌI adapter TTS; tự scale
`durationInSec` + `words[]`, KHÔNG cần align lại):
```bash
npm run dialogue:speed -- --data "projects/$ID/dialogue.json"   # tempo tự theo doc.level
```
| Level | A1 | A2 | B1 | B1-B2 | B2 / B2-C1 / C1 |
|---|---|---|---|---|---|
| Tempo | 0.80 | 0.85 | 0.90 | 0.95 | 1.00 (script tự bỏ qua) |

Muốn ghi đè: `--tempo 0.9`. Script idempotent (`doc.speedTempo`) — không chạy
chồng được; đổi tốc độ thì sinh lại TTS. Với SAPI có thể thay bằng `-Rate` gốc
(vd A2 = `-Rate -3`) ngay từ bước 4 rồi BỎ bước này.

### 4c. (BẮT BUỘC) Verify audio khớp kịch bản — TRƯỚC khi render
Spawn subagent **`audio-script-verifier`** (truyền `data: projects/$ID/dialogue.json`
— cần chạy SAU 4b để có `words[]`). Agent đối chiếu từng lượt: đủ file, không đọc
đôi, không dính câu lượt trước, nội dung đúng, duration hợp lý → trả JSON
`verdict PASS/FAIL + issues[]` kèm mốc cắt ffmpeg / danh sách lượt cần sinh lại.
**FAIL thì sửa theo `issues` rồi chạy lại agent đến khi PASS mới được render**
(lỗi thật đã gặp: ElevenLabs web làm ~1/3 lượt bị đọc 2-4 lần). Sau khi render +
ghép intro cũng NÊN gọi lại agent với `video:` để verify bản final trước finalize.

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
+ query mẫu: `references/canva-bg.md`**. **Canva LỖI / hết quota AI → fallback
Gemini thủ công**: tự soạn PROMPT sinh ảnh (tiếng Anh, theo query mẫu + nêu rõ tỉ
lệ 16:9, giữa trống, không chữ/logo, chừa góc phải dưới), đưa cho người dùng dán
vào Gemini rồi NGỪNG chờ; người dùng lưu ảnh về đúng path mình chỉ định
(`public/backgrounds/scene.png`…) hoặc dán/copy ảnh cho mình tự lưu — xem
`references/canva-bg.md` mục "Fallback Gemini". KHÔNG lặng lẽ tái dùng ảnh của
chủ đề khác khi ảnh đó không hợp nội dung.

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

**Logo kênh trong VIDEO**: `Podcast`/`PodcastVertical` **LUÔN tự phủ `public/logo.jpg`**
làm watermark mờ (opacity 0.5, tròn viền trắng) ở góc PHẢI DƯỚI suốt video — không
cần truyền gì; đặt `"logo":""` trong props để ẩn. Đồng bộ với logo trên thumbnail
(bước 6). Vì vậy ảnh nền video cũng nên **chừa góc phải dưới tương đối thoáng**.

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
  DƯỚI (tròn, viền trắng, **mờ opacity 0.5 như watermark** — giống trong video) —
  không cần truyền gì; đặt `"logo":""` trong props để ẩn. Vì vậy concept/ảnh nền phải
  **chừa góc phải dưới thoáng** (agent đã lo trong query).
- `title` = danh từ chính của chủ đề (vd "Talking About Your Weekend" → `YOUR WEEKEND`),
  tránh lặp pill `kicker`. Không có Canva → bỏ `backgroundImage`, `Thumbnail` tự vẽ nền
  gradient + 2 avatar chữ cái (logo vẫn hiện).
- **Canva LỖI / hết quota AI** → như bước 5: soạn PROMPT sinh ảnh thumbnail (từ
  `canvaQuery` của agent, thêm tỉ lệ 16:9 + giữa trống + không chữ), đưa người dùng
  tạo bằng Gemini rồi chờ ảnh lưu về `public/thumbnails/scene.png` mới render still
  (xem `references/canva-bg.md` mục "Fallback Gemini"). Chỉ dùng nền gradient khi
  người dùng từ chối/không tạo được ảnh.

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
**QUY TẮC ĐẶT TÊN FILE (bắt buộc):** mọi file đầu ra cho người dùng (mp4, thumbnail,
srt…) phải có tên **TIẾNG ANH, có ý nghĩa, theo chủ đề** dạng slug SEO (vd
`learn-english-food-and-drink-a2-conversation.mp4`) — YouTube đọc tên file khi
upload nên tên tốt giúp metadata/SEO tốt. KHÔNG để tên chung chung (`podcast.mp4`,
`output.mp4`, `video1.mp4`) lọt vào bộ file cuối. LUÔN truyền cụm từ khóa SEO
(tiếng Anh, chứa chủ đề + cấp độ) cho `finalize`:
```bash
npm run --silent project:finalize -- "$ID"                                  # tên = slug(chủ đề + cấp độ)
npm run --silent project:finalize -- "$ID" "learn english animals conversation"  # từ khóa SEO riêng (khuyến nghị — dùng `fileKeywords` từ youtube-metadata-writer)
```
Việc này: copy dialogue + ảnh nền + thumbnail-bg + `audio/` (chỉ file đang dùng) +
`project.json`; **đổi tên** kết quả sang slug tiếng Anh không dấu (`<slug>.mp4`,
`<slug>-shorts.mp4`, `<slug>-thumbnail.png`); **tạo `.srt`** (timestamp tuyệt đối,
mỗi lượt 1 cue — LUÔN tạo, đính kèm khi upload để YouTube phân phối đúng); xuất
**MỘT file `youtube-metadata.txt`** chia rõ 3 phần `===== TITLE / DESCRIPTION /
TAGS =====`; dọn `*.props.json` tạm.

Báo lại: đường dẫn folder, tên file, tiêu đề/mô tả/tags, và nhắc đính kèm `.srt`.

### 7b. (BẮT BUỘC) Kiểm duyệt YouTube trước khi đăng
Sau finalize, spawn subagent **`youtube-policy-checker`** (truyền `project:
projects/$ID/`). Agent rà title/description/tags (giới hạn ký tự, ≤15 hashtag,
tag stuffing, metadata gây hiểu lầm), XEM thumbnail + vài frame video, quét kịch
bản theo advertiser-friendly, cảnh báo bản quyền (nhạc intro, gói ElevenLabs) và
rủi ro chính sách nội dung lặp (kênh TTS), khuyến nghị cờ Made-for-Kids → trả
JSON `PASS/WARN/FAIL`. `FAIL` → sửa blocker rồi chạy lại; `WARN` → báo user
quyết định. Đính kèm `uploadChecklist` của agent vào báo cáo cuối cho user.

### 7c. (BẮT BUỘC) Ghi SỔ NỘI DUNG (chống trùng lần sau)
Sau finalize + kiểm duyệt, ghi 1 dòng thẳng lên Google Sheet tab `video`
(idempotent theo `id`; ledger ONLINE-ONLY — mất mạng/thiếu webhook thì lệnh báo
lỗi, báo user rồi chạy lại, đừng bỏ qua):
```bash
npm run --silent ledger -- append --tab video --data "projects/$ID/dialogue.json" \
  --theme "<bucket: money/health/travel/…>" --situation "<mô tả ngắn>"
```

### 8. (Hỏi cuối cùng) Upload lên Google Drive
Sau khi `finalize` xong, **HỎI người dùng: "Bạn có muốn upload kết quả lên Google
Drive không?"** Nếu KHÔNG thì kết thúc. Nếu CÓ, dùng **`rclone` cho TOÀN BỘ**
(remote `gdrive` đã OAuth sẵn — KHÔNG dùng Google Drive MCP cho bước upload nữa,
kể cả tạo folder hay file text). Thư mục gốc
`https://drive.google.com/drive/folders/1TNL6whGzBi1hfGzGLf2ar_kW0sQzpaLL`
chia 2 mục theo LOẠI video — upload vào đúng mục:
- **Podcast** (skill này) → folder `podcast`, id = `1Vc9ecRm6DBNuHxZ-oHGfCQBj7yohB2if`
- **Reel/Shorts** (skill english-reel-video) → folder `reels`, id = `1jUUnNCDT8q_se6bH9BrusWRho4MN9_CE`

1. **Upload một phát** — rclone TỰ TẠO subfolder `<slug>` qua đường dẫn đích,
   không cần tạo folder trước; `--include` lọc đúng các file cần đăng (bỏ audio/
   lượt lẻ, background trung gian, PROGRESS.md):
   ```bash
   rclone copy "projects/$ID" "gdrive:<slug>" --drive-root-folder-id <id-mục> \
     --include "*.mp4" --include "*.srt" --include "youtube-metadata.txt" \
     --include "project.json" --include "*-thumbnail.png"
   ```
2. **Xác nhận đủ file** (theo `project.json`: `<slug>.mp4`, `<slug>-shorts.mp4`,
   `<slug>-thumbnail.png`, `<slug>.srt`, `youtube-metadata.txt`, `project.json`):
   ```bash
   rclone lsf "gdrive:<slug>" --drive-root-folder-id <id-mục>
   ```
3. **Báo link subfolder** cho người dùng — lấy ID bằng lsf định dạng `ip`:
   ```bash
   rclone lsf gdrive: --drive-root-folder-id <id-mục> --dirs-only --format "ip"
   ```
   → dòng `<id>;<slug>/` → link `https://drive.google.com/drive/folders/<id>`.
- Remote `gdrive` ĐÃ cấu hình OAuth sẵn (config: `%APPDATA%\rclone\rclone.conf`,
  token tự refresh; hỏng chỉ khi người dùng thu hồi quyền — khi đó chạy
  `rclone config reconnect gdrive:`). Nếu shell mới cài chưa có `rclone` trong
  PATH, exe ở: `%LOCALAPPDATA%\Microsoft\WinGet\Packages\Rclone.Rclone_*\rclone-*\rclone.exe`.
- Nếu máy khác/chưa có remote: `winget install Rclone.Rclone` rồi
  `rclone config create gdrive drive scope=drive` (mở trình duyệt cho người dùng
  bấm Allow — chạy background và báo người dùng xác nhận OAuth).

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
- `references/better-tts.md` — ElevenLabs / Gemini / aivideoauto / OpenAI cho giọng thật.
- `references/canva-bg.md` — tạo ảnh nền studio + thumbnail bằng Canva MCP.
- `references/youtube-metadata.md` — công thức title / description / tags.
