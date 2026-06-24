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

## Áp dụng cho hội thoại (dialogue.json)
`generate-audio.ts` hiện xử lý `script.json`. Để dùng cho hội thoại, hoặc:
1. Viết một biến thể đọc `dialogue.json` (lặp qua `turns`, chọn giọng theo
   `speakers[turn.speaker]`, ghi `public/audio/d<id>.<ext>` rồi cập nhật
   `audio`/`durationInSec`), hoặc
2. Tạo audio bằng công cụ bên ngoài rồi đặt thủ công vào `public/audio/` và điền
   trường `audio` cho từng lượt.

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
