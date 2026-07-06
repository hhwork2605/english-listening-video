# English Listening Video

Tạo video học tiếng Anh cho YouTube theo phong cách kênh podcast hội thoại
(*Speak English With Class* / English Leap), bằng pipeline **Claude → TTS →
Remotion**. Mỗi lần chạy cho ra một **bộ upload hoàn chỉnh** (video ngang + dọc,
thumbnail, phụ đề `.srt`, tiêu đề/mô tả/tags) gom trong một project folder.

> Định dạng chính: **MỘT ảnh studio tĩnh + sóng âm chạy + transcript tiếng Anh
> highlight từng từ**. Audio là hội thoại 2 giọng. Không hiện tiếng Việt trên màn hình.

## Tính năng

- 🎙️ **Hội thoại 2 người** (Emma/Mike) — Claude tự viết kịch bản theo chủ đề + cấp độ.
- 🗣️ **Giọng đọc offline** qua Windows SAPI (miễn phí, không API key); 2 giọng luân phiên.
- ✨ **Highlight từng từ khớp tuyệt đối** — forced-align bằng Whisper (offline).
- 📊 **Sóng âm phản ứng theo audio** chạy xuyên suốt (chống YouTube gắn cờ trùng lặp).
- 🖼️ **Thumbnail kiểu kênh** — ảnh 2 nhân vật (Canva) + overlay tiêu đề/badge.
- 📐 **Hai khung**: ngang 1920×1080 (YouTube) + dọc 1080×1920 (Shorts/TikTok).
- 📦 **Mỗi video một folder**: `projects/<slug>_<thoigian>/` đủ video + thumbnail +
  `.srt` + `youtube-title/description/tags` + nguồn.

## Cài đặt

```bash
npm install
# Cho bước highlight khớp tuyệt đối (một lần):
pip install faster-whisper truststore
```

Yêu cầu: Node 18+, Windows (giọng SAPI), Python 3.9+ (Whisper align). Render
dùng Chrome Headless do Remotion tự tải.

## Quy trình (định dạng podcast — chính)

```bash
# 1) Tạo project folder cho video
ID=$(node scripts/new-project.mjs "Talking About Animals")

# 2) Soạn projects/$ID/dialogue.json (Claude viết: turns + youtubeTitle/Description/tags)
#    (data/ chỉ là vùng đệm render; nguồn thật nằm trong project folder)

# 3) Giọng đọc 2 người + mốc từ (ghi words[] vào file project)
npm run dialogue:audio -- -Data "projects/$ID/dialogue.json"

# 4) Khớp tuyệt đối (mốc từng từ thật)
npm run dialogue:align -- --data "projects/$ID/dialogue.json"

# 5) Ảnh nền (Canva hoặc tự cung cấp) -> public/backgrounds/scene.png,
#    public/backgrounds/scene-vertical.png, public/thumbnails/scene.png

# 5b) Nạp dữ liệu nguồn của project vào data/ để Remotion render
node scripts/use-project.mjs "$ID"

# 6) Render vào project folder (ảnh nền/tiêu đề qua --props)
printf '{"backgroundImage":"thumbnails/scene.png","title":"ANIMALS"}' > "projects/$ID/thumb.props.json"
npx remotion still src/index.ts Thumbnail "projects/$ID/thumbnail.png" --props="projects/$ID/thumb.props.json"

printf '{"backgroundImage":"backgrounds/scene.png"}' > "projects/$ID/podcast.props.json"
npx remotion render Podcast "projects/$ID/podcast.mp4" --props="projects/$ID/podcast.props.json"

printf '{"backgroundImage":"backgrounds/scene-vertical.png"}' > "projects/$ID/pv.props.json"
npx remotion render PodcastVertical "projects/$ID/podcast-portrait.mp4" --props="projects/$ID/pv.props.json"

# 7) Gom + đặt tên từ khóa + tạo .srt + metadata
node scripts/finalize-project.mjs "$ID"        # hoặc kèm từ khóa: "$ID" "learn english animals"
```

Xem trước trực quan: `npm run dev` (Remotion Studio).

## Compositions

| ID | Mô tả |
|---|---|
| `Podcast` / `PodcastVertical` | **Chính** — 1 ảnh tĩnh + sóng âm + transcript EN highlight (`data/dialogue.json`) |
| `ReelDialogueList` / `ReelComicScene` / `Reel` | **Shorts/TikTok dọc** — 3 dạng reel: (A) danh sách hội thoại tô sáng từng câu, (B) cảnh tĩnh + bong bóng thoại + end-card Subscribe, (C) micro-lesson 1 idiom (hook→phrase→nghĩa→ví dụ→CTA); skill `english-reel-video` |
| `Thumbnail` | Ảnh đại diện 1280×720 (ảnh Canva + overlay chữ) |
| `LandscapeVideo` / `PortraitVideo` | Phụ — câu đơn lặp lại nghe thụ động (`data/script.json`) |

## Cấu trúc

```
data/                 vùng đệm render (Remotion đọc ở đây); project:use nạp vào
public/               audio/ (wav), backgrounds/, thumbnails/, bgm/, characters/
scripts/              new-project, use-project, tts-dialogue (SAPI), align_whisper, finalize-project, ...
src/podcast/          SimplePodcast + components (Caption, Speaker, ...)
src/                  Root.tsx, Thumbnail.tsx, components/ (AudioWaveform, ...)
projects/             [git-ignored] mỗi video một folder: dialogue.json NGUỒN + kết quả
.claude/skills/english-podcast-video/   skill tự động hoá cả pipeline
```

## Giọng đọc chất lượng cao (tùy chọn)

SAPI miễn phí nhưng hơi máy móc. Để xuất bản nghiêm túc, dùng một trong các adapter
hội thoại: `dialogue:audio:eleven:web` (lái web ElevenLabs, Eleven v3 + tag cảm xúc,
dùng credit web — khuyến nghị), `dialogue:audio:eleven` (API, trả sẵn `words[]`),
`dialogue:audio:gemini` / `dialogue:audio:aistudio` / `dialogue:audio:aiva`; các
adapter không trả mốc từ thì chạy Whisper (`dialogue:align`) lấy lại `words[]`.
Xem `.claude/skills/english-podcast-video/references/better-tts.md`.

## Tự động hoá bằng skill

Pipeline trên được đóng gói thành skill Claude Code tại
`.claude/skills/english-podcast-video/`. Trong phiên Claude với thư mục này, chỉ
cần yêu cầu *"tạo video [chủ đề] [cấp độ] [độ dài]"* là chạy trọn bộ.

## Ghi chú

- `projects/`, `node_modules/`, `out/`, `public/audio/*.wav` không đưa lên git.
- `@remotion/media-utils`/`media-parser` có thể cần license cho mục đích thương
  mại — xem https://remotion.dev/license.
