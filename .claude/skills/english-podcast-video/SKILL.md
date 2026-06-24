---
name: english-podcast-video
description: >-
  Tạo video học tiếng Anh dạng PODCAST cho YouTube theo phong cách kênh "Speak
  English With Class" / English Leap Podcast: MỘT ảnh studio tĩnh (hai người
  trò chuyện) xuyên suốt + dải sóng âm chạy + transcript TIẾNG ANH hiện theo
  từng cụm và làm sáng từ đang đọc (karaoke), hội thoại hai giọng TTS luân
  phiên, render bằng Remotion; tự tạo
  ảnh nền bằng Canva và xuất cả thumbnail. HÃY DÙNG skill này mỗi khi người dùng
  muốn: làm video/kênh học tiếng Anh kiểu podcast hội thoại hai người, "video
  giống Speak English With Class / English Leap", podcast/hội thoại tiếng Anh có
  phụ đề chạy, video luyện nghe tiếng Anh thụ động, dựng video conversation
  tiếng Anh bằng Remotion, hoặc đưa một chủ đề + cấp độ và nhờ tạo video — kể cả
  khi họ không nói rõ chữ "Remotion", "Canva" hay "skill". Có thêm biến thể phụ:
  "2 nhân vật + phụ đề Anh-Việt + badge" và "câu đơn lặp lại để nghe thụ động"
  (một giọng).
---

# English Podcast Video

Dựng video học tiếng Anh kiểu podcast (giống kênh *Speak English With Class*)
bằng pipeline **Claude → TTS → Remotion**. Claude (chính bạn, trong phiên này)
viết kịch bản hội thoại; Windows SAPI tạo giọng đọc + mốc thời gian từng từ
hoàn toàn offline; Remotion render ra MP4.

**Định dạng chính (đúng kênh gốc):** MỘT ảnh tĩnh xuyên suốt + dải sóng âm
chuyển động + transcript **tiếng Anh** hiện theo từng cụm, **làm sáng từ đang
đọc** theo mốc thời gian (composition `Podcast`/`PodcastVertical`). Không avatar,
không badge, không tiếng Việt trên màn hình — audio vẫn là hội thoại 2 giọng.
Đây là mặc định của `render:podcast`. (Highlight tự bật khi `turns[].words` có
dữ liệu — `dialogue:audio` sinh sẵn; chạy thêm `dialogue:align` (bước 4b) để
khớp tuyệt đối; không có `words` thì hiện chữ thường.)

Đầu ra: **ngang 1920×1080** (YouTube) và **dọc 1080×1920** (Shorts/TikTok),
dùng chung dữ liệu.

**Mỗi lần gọi = một project folder riêng.** Tạo `projects/<slug>_<thoigian>/`
(vd `talking-about-animals_20260624-1340/`) và render thẳng vào đó; cuối cùng
gom dialogue + ảnh nền + thumbnail + audio + video kết quả vào folder này để mỗi
video độc lập, dễ lưu trữ. Ảnh nền/tiêu đề truyền qua `--props` lúc render nên
**không phải sửa code mỗi lần**.

> Còn một biến thể "2 nhân vật + phụ đề Anh-Việt + badge" (`PodcastVideo`,
> không đăng ký mặc định) nếu người dùng muốn kiểu đó — bỏ qua trừ khi được hỏi.

## Quy trình (làm theo thứ tự)

### 1. Chuẩn bị project
Mỗi video nên là một thư mục riêng. Hỏi người dùng nơi đặt (mặc định gợi ý một
thư mục con cạnh chỗ họ đang làm), rồi copy template:

```bash
cp -r "<SKILL_DIR>/assets/template" "<TARGET_DIR>"
cd "<TARGET_DIR>"
npm install     # chỉ lần đầu mỗi project; mất ~1 phút
```

`<SKILL_DIR>` là thư mục chứa file SKILL.md này. Nếu người dùng đã có sẵn một
project tạo từ template trước đó, dùng lại, bỏ qua bước copy + install.

Sau đó tạo **project folder cho video lần này** (lấy id để dùng ở bước render):
```bash
ID=$(npm run --silent project:new -- "<chủ đề>")   # vd: animals_20260624-1340
```

### 2. Hỏi thông số (ngắn gọn, gộp 1 lần)
- **Chủ đề** (vd "Talking About Your Favorite Food", "Dealing With Stress").
- **Cấp độ** (mặc định `B1-B2`).
- **Độ dài** mong muốn theo phút (mặc định ~10 phút). Ước lượng:
  **~12 lượt thoại ≈ 1 phút** (giọng SAPI, mỗi lượt ~4–5s + nghỉ). Vậy
  10 phút ≈ 120 lượt, 15 phút ≈ 180 lượt.
- **Giọng 2 người** (mặc định Zira nữ / David nam — chỉ là giọng đọc, không
  hiện trên màn hình ở định dạng chính).
- **Ảnh nền tĩnh**: mặc định **tự tạo bằng Canva** hợp chủ đề (bước 5). Chỉ hỏi
  người dùng nếu họ muốn mô tả nhân vật riêng hoặc đã có sẵn ảnh.
- **Định dạng**: ngang, dọc, hay cả hai.

Ở định dạng chính, màn hình **chỉ hiện transcript tiếng Anh** — không cần tiếng
Việt. (Trường `vi` là tùy chọn, chỉ dùng nếu sau này muốn biến thể Anh-Việt.)

### 3. Viết kịch bản hội thoại → `data/dialogue.json`
**Bạn tự viết** nội dung (không cần API key — bạn chính là model sinh nội dung).
Đây là phần quyết định chất lượng, hãy đầu tư:
- Hội thoại tự nhiên, đời thường, **luân phiên A/B**, bắt đầu bằng A.
- Mỗi lượt 1–2 câu, đúng cấp độ, dùng từ/cụm thông dụng; có câu hỏi nối để
  mạch trò chuyện trôi chảy (giống podcast thật, không cứng như sách giáo khoa).
- **Không cần tiếng Việt** ở định dạng chính (`vi` để rỗng hoặc bỏ). Chỉ viết
  `vi` nếu người dùng yêu cầu biến thể Anh-Việt.
- Với video dài, **viết theo từng cụm ~30–40 lượt** quanh các khía cạnh nhỏ của
  chủ đề rồi nối lại trong mảng `turns`, giữ mạch liên tục, cho tới khi đủ số
  lượt mục tiêu. Đừng cố nhồi tất cả vào một lần nếu thấy nội dung lặp.

Cấu trúc file (xem `references/data-format.md` để biết đầy đủ các trường):

```json
{
  "title": "English Podcast | <chủ đề>",
  "level": "B1-B2",
  "topic": "<chủ đề ngắn — dùng cho thumbnail & tên file, KHÔNG hiện trên video>",
  "youtubeTitle": "<tiêu đề móc tò mò, < 50 ký tự — xem mục dưới>",
  "youtubeDescription": "<mô tả 2-4 câu + CTA + 3-5 hashtag ở cuối>",
  "tags": ["learn english", "english podcast", "...", "b1 english"],
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

Để `audio`/`durationInSec`/`words` cho bước TTS điền. `id` đánh số `001`, `002`…

**Tiêu đề YouTube (`youtubeTitle`) — móc tò mò, < 50 ký tự.** Đây là tiêu đề khi
ĐĂNG (metadata), khác chữ trên thumbnail. Viết tiếng Anh, đánh vào tâm lý người
học bản xứ, dùng các công thức:
- Mệnh lệnh + thói quen: *"Listen To This Every Night Before Bed…"*
- Lợi ích + thời hạn: *"Fix Your English Pronunciation In 1 Week"*
- Hứa hẹn dễ dàng: *"Improve Your English Without Even Trying"*
- Khơi tò mò: *"The English Trick Natives Never Tell You"*
Bám chủ đề/cấp độ, ≤ 50 ký tự. `finalize` sẽ xuất ra `youtube-title.txt` +
`project.json` để dễ copy khi upload.

**Mô tả (`youtubeDescription`) + tags (`tags`).**
- `youtubeDescription`: 2-4 câu (hook → video có gì → lợi ích → CTA subscribe),
  rồi 3-5 hashtag ở cuối (vd `#LearnEnglish #EnglishPodcast #EnglishListening`).
  Dùng `\n` để xuống dòng trong chuỗi JSON.
- `tags`: mảng ~8-12 từ khóa tìm kiếm (vd "learn english", "english listening
  practice", "<chủ đề> in english", "<cấp độ> english"…).
`finalize` xuất `youtube-description.txt` + `youtube-tags.txt` (ngăn bằng dấu phẩy).

### 4. Sinh giọng đọc + mốc từng từ
```bash
npm run dialogue:audio
```
Script `tts-dialogue.ps1` đọc mỗi lượt bằng giọng của speaker tương ứng, ghi
`public/audio/d<id>.wav` và tự điền `durationInSec` + `words[]` (mốc thời gian
từng từ) vào `dialogue.json`. Giọng có sẵn trên Windows thường là
`Microsoft David Desktop` (nam) và `Microsoft Zira Desktop` (nữ) — kiểm tra
bằng lệnh trong `references/voices.md` nếu cần.

### 4b. (Khuyến nghị) Forced-align để highlight KHỚP TUYỆT ĐỐI
SAPI chỉ cho mốc **bắt đầu** mỗi từ, không cho mốc kết thúc → highlight có thể
"dính" sáng qua khoảng nghỉ. Để khớp chuẩn từng từ, chạy Whisper lấy mốc
bắt đầu + kết thúc THẬT (offline, miễn phí, không cần ffmpeg/key):

```bash
pip install faster-whisper truststore   # một lần; truststore qua proxy SSL doanh nghiệp
npm run dialogue:align                   # ghi đè words[] bằng mốc thật
```
`align_whisper.py` đọc `dialogue.json`, nhận diện lại từng file audio kèm
word-timestamps rồi ghi đè `words[]`. `Caption` tự dùng mốc kết thúc thật này →
highlight bám tiếng nói chính xác (lúc nghỉ không từ nào sáng). Bỏ qua bước này
thì highlight vẫn chạy nhưng chỉ gần đúng (ước lượng độ dài từ).

> Lưu ý: file do `dialogue:audio` ghi có BOM (PowerShell); script đã đọc bằng
> `utf-8-sig` và ghi lại không BOM — Remotion vẫn đọc bình thường.

### 5. Kiểm tra độ dài rồi render
```bash
npx remotion compositions src/index.ts     # xem Podcast dài bao nhiêu giây
```
Nếu lệch nhiều so với mục tiêu, thêm/bớt lượt trong `dialogue.json` rồi chạy lại
bước 4 (chỉ các lượt mới được sinh thêm; lượt cũ vẫn giữ).

**Gắn ảnh nền cố định** (cái tạo nên "1 ảnh xuyên suốt" giống kênh). Nếu có
Canva MCP, tự tạo ảnh studio 2 host hợp chủ đề (xem `references/canva-bg.md`):
1. `generate-design` với `design_type: "desktop_wallpaper"`, query mô tả cảnh
   studio 2 người (nữ trái / nam phải, mic, tai nghe, kệ sách, cây xanh, tường
   tối), **chừa giữa trống cho caption, không chữ/logo**.
2. `create-design-from-candidate` cho candidate ưng → lấy `design_id`.
3. `export-design` PNG `width:1920, height:1080` → URL có chữ ký.
4. Tải file bằng PowerShell `Invoke-WebRequest` (Bash bị chặn mạng) về
   `public/backgrounds/scene.png`.
5. Bật `backgroundImage: "backgrounds/scene.png"` trong defaultProps của
   `Podcast` tại `src/Root.tsx` (và ảnh dọc cho `PodcastVertical`).

Không có Canva thì đặt ảnh của người dùng vào `public/` rồi làm bước 5. Lưu ý
bản quyền: dùng ảnh tự tạo/của người dùng, không tái dùng ảnh kênh khác.

Khi ưng, render **thẳng vào project folder**, truyền ảnh nền qua file `--props`:
```bash
printf '{"backgroundImage":"backgrounds/scene.png"}' > "projects/$ID/podcast.props.json"
npx remotion render Podcast "projects/$ID/podcast.mp4" --props="projects/$ID/podcast.props.json"
```

**Bản dọc (Shorts/TikTok)** cần ảnh nền KHUNG DỌC riêng (ảnh ngang ép vào sẽ cắt
mất 2 nhân vật ở mép). Tạo bằng Canva `design_type: "phone_wallpaper"` (1080×1920),
mô tả 2 nhân vật ở **NỬA DƯỚI**, **nửa trên để trống** cho caption; tải về
`public/backgrounds/scene-vertical.png`. Rồi:
```bash
printf '{"backgroundImage":"backgrounds/scene-vertical.png"}' > "projects/$ID/podcast-vertical.props.json"
npx remotion render PodcastVertical "projects/$ID/podcast-portrait.mp4" --props="projects/$ID/podcast-vertical.props.json"
```
(Ở khung dọc, sóng âm tự dời lên vùng trống phía trên; caption ở ~16% trên.)

### 6. Thumbnail (LUÔN tạo mỗi video mới, dùng Canva)
Thumbnail kiểu kênh = **ảnh minh hoạ 2 nhân vật từ Canva** (chừa giữa trống) +
Remotion **phủ chữ lên giữa** (pill "TALK ABOUT" + tiêu đề lớn + badge cấp độ +
tên kênh góc trên). Mỗi lần render video mới hãy tạo thumbnail mới như sau:

1. **Canva tạo ảnh nền thumbnail** — `generate-design` với
   `design_type: "youtube_thumbnail"`, mô tả 2 nhân vật ở **hai mép trái/phải
   quay vào giữa**, studio ấm, **CHÍNH GIỮA để trống hoàn toàn**, **không
   chữ/logo**. Tạo nhiều candidate → export PNG `1280x720` → tải bằng PowerShell
   `Invoke-WebRequest` về `public/thumbnails/scene.png`. (Chi tiết:
   `references/canva-bg.md`.)
2. Render vào project folder, truyền `title` + `backgroundImage` qua `--props`:
   ```bash
   printf '{"backgroundImage":"thumbnails/scene.png","title":"ANIMALS"}' > "projects/$ID/thumb.props.json"
   npx remotion still src/index.ts Thumbnail "projects/$ID/thumbnail.png" --props="projects/$ID/thumb.props.json"
   ```
   `title` = cụm ngắn & mạnh, **danh từ chính** của chủ đề (vd "Talking About
   Your Weekend" → `YOUR WEEKEND`), để không lặp với pill "TALK ABOUT".

Không có Canva / chưa có ảnh: bỏ `--props` → `Thumbnail` tự vẽ nền gradient +
2 avatar chữ cái (vẫn ra ảnh dùng được).

### 7. Gom mọi thứ + đặt tên file theo từ khóa
```bash
npm run --silent project:finalize -- "$ID"                 # tên file = slug(chủ đề + cấp độ)
# hoặc đặt từ khóa SEO tùy ý (tiếng Anh, không dấu):
npm run --silent project:finalize -- "$ID" "learn english animals conversation"
```
Việc này:
- Copy `dialogue.json`, `background.png`, `background-vertical.png`,
  `thumbnail-bg.png`, `audio/` (chỉ file đang dùng) và ghi `project.json`.
- **Đổi tên file kết quả** sang từ khóa tiếng Anh không dấu, nối gạch ngang:
  `<slug>.mp4` (ngang), `<slug>-shorts.mp4` (dọc), `<slug>-thumbnail.png`.
  Mặc định `<slug>` = chủ đề + cấp độ (vd `talking-about-animals-b1`); truyền
  tham số thứ 2 để dùng cụm từ khóa riêng.
- **Tạo phụ đề mềm `<slug>.srt`** — timestamp tuyệt đối khớp video (mỗi lượt 1
  cue, text tiếng Anh). LUÔN tạo. Khi upload YouTube, đính kèm file này
  (Subtitles/CC → English) để YouTube quét hiểu nội dung, phân phối đúng người.
- Xuất metadata upload: `youtube-title.txt`, `youtube-description.txt`,
  `youtube-tags.txt` + `project.json`.
- Dọn các file `*.props.json` tạm.

Báo lại cho người dùng: đường dẫn folder, tên file kết quả, tiêu đề/mô tả/tags,
và nhắc đính kèm `.srt` khi upload.

## Sóng âm chạy xuyên suốt (tự động — chống trùng nội dung)
Mọi composition đã có **dải sóng âm chuyển động liên tục**, phản ứng theo
audio đang phát cộng một sàn dao động luôn chạy (kể cả lúc nghỉ). Vì sóng bám
theo nội dung âm thanh riêng của từng video nên mỗi video có chuyển động khác
nhau — giúp tránh việc YouTube gắn cờ nội dung lặp/đồng nhất. Không cần thao
tác gì thêm; muốn đổi màu/độ cao thì sửa `src/components/AudioWaveform.tsx`.

## Tùy biến (khi người dùng muốn)
- **Ảnh nhân vật**: đặt PNG vào `public/characters/` rồi thêm `"image":
  "characters/emma.png"` vào speaker. Không có ảnh thì hiển thị avatar chữ cái
  (vẫn đẹp). Đây là cách giống kênh gốc nhất nếu có bộ nhân vật riêng.
- **Nhạc nền**: bỏ file vào `public/bgm/`, truyền `bgm` qua defaultProps trong
  `src/Root.tsx` (đã có chỗ comment sẵn) — để âm lượng thấp (~0.08).
- **Màu nhấn / vị trí** từng nhân vật: trường `color`, `side` trong `speakers`.
- **Giọng tự nhiên hơn** (xuất bản chính thức): SAPI hơi máy móc. Có thể thay
  bằng OpenAI/ElevenLabs — xem adapter trong `scripts/generate-audio.ts` và
  `references/better-tts.md`. Khi đó cần Whisper để lấy lại `words[]` cho
  highlight.

## Định dạng phụ: nghe thụ động câu đơn (1 giọng)
Project còn 2 composition `LandscapeVideo`/`PortraitVideo` cho kiểu "một câu,
lặp lại, có khoảng nghỉ" dùng `data/script.json`. Quy trình tương tự nhưng:
viết `script.json` → `npm run generate:audio:sapi` → `npm run render:landscape`.
Chi tiết trong `references/data-format.md`.

## Lưu ý trung thực
- Giọng SAPI miễn phí, offline, đủ tốt để test/đăng thử nhưng nghe máy móc.
  Nói rõ điều này với người dùng nếu họ định làm kênh nghiêm túc.
- Dấu câu cuối câu (vd `?`) đôi khi không có mốc từ từ SAPI nên không nằm trong
  phần highlight — phụ đề chính vẫn hiển thị đủ. Chỉnh tay `words[]` nếu cần.
- `@remotion/media-parser` (dùng ở `scripts/measure-duration.ts`) có thể yêu cầu
  license cho mục đích thương mại — xem remotion.dev/license.

## Tham khảo
- `references/data-format.md` — đầy đủ các trường của `dialogue.json` và `script.json`.
- `references/voices.md` — liệt kê & chọn giọng SAPI; cài thêm giọng.
- `references/better-tts.md` — cắm OpenAI/ElevenLabs khi cần giọng thật.
- `references/canva-bg.md` — tạo ảnh nền studio 2 host bằng Canva MCP.
