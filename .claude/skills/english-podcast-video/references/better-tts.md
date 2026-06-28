# Dùng TTS chất lượng cao (tùy chọn)

SAPI miễn phí & offline nhưng giọng máy móc. Khi cần giọng tự nhiên cho kênh
chính thức, thay bằng TTS đám mây. `scripts/generate-audio.ts` đã có sẵn adapter
cho định dạng câu đơn (`script.json`) với `TTS_PROVIDER = openai | elevenlabs`.

## OpenAI TTS
```bash
# PowerShell
$env:OPENAI_API_KEY="sk-..."; $env:TTS_PROVIDER="openai"
npm run generate:audio
```
Model `gpt-4o-mini-tts`, đổi giọng qua `OPENAI_TTS_VOICE` (alloy, echo, fable…).

## ElevenLabs
```bash
$env:ELEVENLABS_API_KEY="..."; $env:ELEVENLABS_VOICE_ID="..."; $env:TTS_PROVIDER="elevenlabs"
npm run generate:audio
```

## ElevenLabs cho HỘI THOẠI (dialogue.json) — tích hợp sẵn ⭐
Đã có script chuyên dụng `scripts/tts-elevenlabs.mjs` (npm: `dialogue:audio:eleven`).
Nó gọi endpoint **`/text-to-speech/{voice}/with-timestamps`** nên trả LUÔN mốc
thời gian từng ký tự → tự dựng `words[]` khớp tuyệt đối, **không cần Whisper align**.

```bash
# 1) Đặt khoá trong .env ở gốc (xem .env.example)
#    ELEVENLABS_API_KEY=sk_...
# 2) Sinh giọng + mốc từ cho file nguồn của project:
npm run dialogue:audio:eleven -- --data "projects/<id>/dialogue.json"
# tuỳ chọn: --model eleven_turbo_v2_5   --format mp3_44100_128
```
- **Chọn giọng**: thêm `elevenVoiceId` cho từng speaker trong `dialogue.json`,
  hoặc đặt env `ELEVEN_VOICE_A` (nữ/A) và `ELEVEN_VOICE_B` (nam/B). Mặc định:
  Rachel `21m00Tcm4TlvDq8ikWAM` (nữ), Adam `pNInz6obpgDQGcFmaJgB` (nam).
- Audio ghi `public/audio/d<id>.mp3`; `audio`/`durationInSec`/`words` được điền
  thẳng vào file project. Sau đó: `project:use` → render như bình thường.
- Mặc định đọc tuần tự (an toàn rate limit); ~vài phút cho video 10 phút.

## aivideoauto / gommo TTS cho HỘI THOẠI (nhiều model, gồm Eleven V3)
Adapter `scripts/tts-gommo.mjs` (npm: `dialogue:audio:gommo`) gọi API nền tảng
**`https://v2.api.gommo.net`** — cung cấp sẵn nhiều model TTS nên KHÔNG cần key
ElevenLabs riêng (trả bằng credit nền tảng).

- **Endpoint**: tạo job `POST /ai/jobs/tts/{model}` → poll `POST /ai/jobs/{id}` →
  tải URL audio. Liệt kê model/giọng: `GET /ai/models?type=tts`.
- **Model** (env `GOMMO_TTS_MODEL`, mặc định `eleven_v3`): `eleven_v3`,
  `eleven_flash_v2_5`, `minimax_speech_2_8_hd|turbo`, `minimax_speech_2_6_hd|turbo`,
  `omnivoice_v1` (voice design/clone), `autoai_speech_1`.
- **Auth**: cần `GOMMO_ACCESS_TOKEN` (+ thường `GOMMO_DOMAIN`) trong `.env` — lấy
  từ tài khoản nền tảng. Giọng: `gommoVoiceId` cho từng speaker, hoặc env
  `GOMMO_VOICE_A`/`GOMMO_VOICE_B`.

```bash
npm run dialogue:audio:gommo -- --data "projects/<id>/dialogue.json"   # --verbose nếu cần dò
npm run dialogue:align -- --data "projects/<id>/dialogue.json"          # Whisper -> words[] (karaoke)
```
- API này **bất đồng bộ** (create→poll) và (theo khảo sát) **không trả mốc từng
  từ** → chạy `dialogue:align` (Whisper) sau để có `words[]`.
- `enTts` (tag cảm xúc) vẫn được ưu tiên gửi khi dùng model `eleven_v3`.
- Lưu ý: body tạo job/response mỗi deployment có thể khác; script dùng deep-search
  để bắt job id + URL audio, chạy `--verbose` để xem raw và chỉnh `CONFIG` nếu cần.

## Áp dụng OpenAI cho hội thoại
`generate-audio.ts` hiện xử lý `script.json` (câu đơn). Muốn dùng OpenAI cho
hội thoại thì viết một biến thể đọc `dialogue.json` tương tự script ElevenLabs ở
trên (lặp `turns`, chọn giọng theo `speakers[turn.speaker]`), rồi dùng Whisper
(bước 4b) để lấy `words[]`.

## Highlight từng từ khi dùng TTS đám mây
TTS đám mây thường không trả mốc từ như SAPI. Để có `words[]`:
- Dùng **Whisper** (vd `whisper-1` của OpenAI hoặc `whisper.cpp` offline) với
  chế độ timestamp cấp từ trên từng file audio, rồi map kết quả vào `words[]`
  (`{text, startSec, endSec}`).
- Nếu không cần highlight, cứ bỏ `words[]` — phụ đề vẫn hiển thị nguyên câu.

## Đo lại độ dài
Sau khi thay audio, chạy đo độ dài để timing khớp:
```bash
node scripts/probe.mjs    # hoặc viết bước measure tương tự cho dialogue
```
