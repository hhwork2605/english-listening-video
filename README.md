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

# 2) Soạn data/dialogue.json (Claude viết: turns + youtubeTitle/Description/tags)

# 3) Giọng đọc 2 người + mốc từ
npm run dialogue:audio

# 4) Khớp tuyệt đối (mốc từng từ thật)
npm run dialogue:align

# 5) Ảnh nền (Canva hoặc tự cung cấp) -> public/backgrounds/scene.png,
#    public/backgrounds/scene-vertical.png, public/thumbnails/scene.png

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
| `Thumbnail` | Ảnh đại diện 1280×720 (ảnh Canva + overlay chữ) |
| `LandscapeVideo` / `PortraitVideo` | Phụ — câu đơn lặp lại nghe thụ động (`data/script.json`) |

## Cấu trúc

```
data/                 dialogue.json (podcast), script.json (câu đơn)
public/               audio/ (wav), backgrounds/, thumbnails/, bgm/, characters/
scripts/              new-project, tts-dialogue (SAPI), align_whisper, finalize-project, ...
src/podcast/          SimplePodcast + components (Caption, Speaker, ...)
src/                  Root.tsx, Thumbnail.tsx, components/ (AudioWaveform, ...)
projects/             [git-ignored] mỗi video một folder kết quả
.claude/skills/english-podcast-video/   skill tự động hoá cả pipeline
```

## Giọng đọc chất lượng cao (tùy chọn)

SAPI miễn phí nhưng hơi máy móc. Để xuất bản nghiêm túc, cắm OpenAI/ElevenLabs
(adapter trong `scripts/generate-audio.ts`) rồi dùng Whisper lấy lại `words[]`.
Xem `.claude/skills/english-podcast-video/references/better-tts.md`.

## Tự động hoá bằng skill

Pipeline trên được đóng gói thành skill Claude Code tại
`.claude/skills/english-podcast-video/`. Trong phiên Claude với thư mục này, chỉ
cần yêu cầu *"tạo video [chủ đề] [cấp độ] [độ dài]"* là chạy trọn bộ.

## Ghi chú

- `projects/`, `node_modules/`, `out/`, `public/audio/*.wav` không đưa lên git.
- `@remotion/media-utils`/`media-parser` có thể cần license cho mục đích thương
  mại — xem https://remotion.dev/license.
