# English Listening Video (Claude + Remotion)

Tạo video "nghe thụ động tiếng Anh" cho YouTube. Claude lo nội dung,
Remotion dựng & render video. Dùng chung dữ liệu cho cả bản ngang (YouTube)
và bản dọc (Shorts/TikTok).

## Luồng dữ liệu

```
Claude  ->  data/script.json  ->  TTS  ->  public/audio/*.mp3
                  ^                              |
                  |  (measure: đo độ dài)        |
                  +------------------------------+
                                 |
                                 v
                            Remotion  ->  out/*.mp4
```

## Cài đặt

```bash
npm install
```

## Chạy nhanh (xem trước, chưa cần audio)

```bash
npm run dev
```

Mở Remotion Studio, chọn `LandscapeVideo` hoặc `PortraitVideo`. Dữ liệu mẫu
trong `data/script.json` chạy được ngay (không tiếng) để bạn xem bố cục.

## Pipeline đầy đủ

1. **Sinh nội dung** (cần `ANTHROPIC_API_KEY`):
   ```bash
   npm run generate:script -- --topic "travel" --level B1 --count 15
   ```

2. **Sinh giọng đọc** — chọn nhà cung cấp qua `TTS_PROVIDER`:
   - `manual` (mặc định): tự thu/đặt file vào `public/audio/<id>.mp3`
   - `openai`: cần `OPENAI_API_KEY`
   - `elevenlabs`: cần `ELEVENLABS_API_KEY` + `ELEVENLABS_VOICE_ID`
   ```bash
   npm run generate:audio
   ```

   **Khuyến nghị (Windows, offline, có highlight từng từ):** dùng giọng SAPI có
   sẵn của Windows. Script này sinh `wav` + tự điền `words[]` (mốc thời gian từng
   từ) vào `script.json`, nên bạn có ngay hiệu ứng karaoke mà không cần API/Whisper:
   ```bash
   npm run generate:audio:sapi
   # chọn giọng/tốc độ khác:
   # powershell -File scripts/tts-sapi.ps1 -Voice "Microsoft David Desktop" -Rate -2
   ```

3. **Đo độ dài audio** (cập nhật timing chính xác):
   ```bash
   npm run measure
   ```

   Hoặc chạy gộp cả 3 bước:
   ```bash
   npm run build:content -- --topic "travel" --level B1 --count 15
   ```

4. **Render**:
   ```bash
   npm run render:landscape   # out/landscape.mp4 (1920x1080)
   npm run render:portrait    # out/portrait.mp4 (1080x1920)
   npm run render:all
   ```

## Highlight từng từ (karaoke)

Mỗi câu trong `script.json` có thể chứa mảng `words[]`:

```json
"words": [
  { "text": "Could", "startSec": 0.151, "endSec": 0.426 },
  { "text": "you",   "startSec": 0.426, "endSec": 0.606 }
]
```

`Subtitle` sẽ tô sáng từ đang được đọc theo thời gian (reset lại ở mỗi lần lặp,
tắt trong khoảng nghỉ cuối). Nếu câu **không** có `words[]` thì hiển thị nguyên
câu, không highlight.

- Cách tạo `words[]` dễ nhất: `npm run generate:audio:sapi` (mục trên).
- Dấu câu cuối (vd "?") do SAPI không tạo mốc nên có thể không hiển thị trong
  phần highlight — chỉnh tay trong `words[]` nếu cần.

## Tùy biến

- **Nhạc nền**: đặt file vào `public/bgm/`, mở comment `bgm:` trong `src/Root.tsx`.
- **Nền**: sửa `src/components/Background.tsx` (gradient hoặc ảnh tĩnh).
- **Số lần lặp / khoảng nghỉ**: chỉnh `repeat`, `gapBetweenRepeatsSec`,
  `pauseAfterSec` trong `data/script.json`.
- **Cỡ chữ, màu, bố cục phụ đề**: `src/components/Subtitle.tsx`.

## Cấu trúc

```
data/script.json          nội dung + timing
public/audio|bgm|backgrounds   tài nguyên media
scripts/                  tự động hóa (Claude, TTS, đo độ dài)
src/Root.tsx              đăng ký 2 composition (ngang + dọc)
src/ListeningVideo.tsx    composition chính
src/components/           SentenceScene, Subtitle, ProgressBar, Background
src/timing.ts             tính số frame theo audio
```
