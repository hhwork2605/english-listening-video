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

## ElevenLabs WEB cho HỘI THOẠI (lái web elevenlabs.io, Eleven v3) — KHUYẾN NGHỊ ⭐
Adapter `scripts/tts-elevenlabs-web.mjs` (npm: `dialogue:audio:eleven:web`) **LÁI WEB
`elevenlabs.io/app/speech-synthesis/text-to-speech`** bằng Playwright — dùng CREDIT
của tài khoản web (kể cả gói free), KHÔNG cần API key. Tự chọn model **Eleven v3**
(hỗ trợ audio tag `[laughs]` `[whispers]`…), tự chọn giọng, tự đóng popup.

```bash
# 1) Mở Chrome profile riêng + cổng debug (đăng nhập elevenlabs.io MỘT lần; các cờ
#    phía sau cho phép Chrome chạy MINIMIZED — không cần giữ cửa sổ active):
& "C:\Program Files\Google\Chrome\Application\chrome.exe" `
  --remote-debugging-port=9223 --user-data-dir="$env:USERPROFILE\eleven-chrome" `
  --disable-backgrounding-occluded-windows --disable-renderer-backgrounding `
  --disable-background-timer-throttling --disable-features=CalculateNativeWinOcclusion
# 2) Sinh giọng (test 2 lượt đầu bằng --limit 2 trước cho đỡ tốn credit):
npm run dialogue:audio:eleven:web -- --data "projects/<id>/dialogue.json" --cdp 9223
npm run dialogue:align -- --data "projects/<id>/dialogue.json"   # Whisper -> words[] (karaoke)
```
- **Giọng = TÊN HIỂN THỊ trên web** (khác API dùng voice ID): env `ELEVEN_WEB_VOICE_A/_B`
  (ưu tiên) hoặc `elevenWebVoice` từng speaker trong `dialogue.json`, vd
  `"Victoria - Warm, Trustworthy, and Relatable"`. Script search ở tab Explore
  (My Voices thường trống); giọng premium (modal Upgrade) → giữ giọng cũ + cảnh báo.
- Model qua `ELEVEN_WEB_MODEL` (mặc định `Eleven v3`); tuỳ chọn
  `ELEVEN_WEB_STABILITY=Creative|Natural|Robust`, `ELEVEN_WEB_FORMAT="MP3 44.1 kHz (192kbps)"`.
- Audio lấy từ thẻ `<audio>` (data:/blob:) hoặc nút Download — download được chuyển
  hướng vào thư mục tạm, KHÔNG rơi vào Downloads. Mỗi speaker 1 tab, tái sử dụng tab
  giữa các lần chạy; tự RESUME lượt thiếu, `--fresh` làm lại, `--limit N` để test.
- **Không trả mốc từng từ** → LUÔN chạy `dialogue:align` sau. `enTts` (tag cảm xúc)
  được ưu tiên gửi. Mỗi lượt generate TỐN CREDIT theo số ký tự (retry cũng tốn).
- KHÔNG thao tác trong cửa sổ Chrome automation lúc script chạy (script tự đảo tab);
  thu nhỏ cửa sổ / làm việc app khác thì thoải mái.

## aivideoauto Voice Studio cho HỘI THOẠI (lái web bằng Playwright, gồm Eleven V3)
Adapter `scripts/tts-aivideoauto.mjs` (npm: `dialogue:audio:aiva`) **LÁI WEB
`https://aivideoauto.com/audio`** (tab "Văn bản thành giọng nói") bằng Playwright —
API gommo cũ đã ngừng hoạt động nên chuyển sang tự động hoá UI; vẫn KHÔNG cần key
ElevenLabs riêng (trả bằng credit nền tảng).

- **Provider/model** (env `AIVA_PROVIDER` / `AIVA_MODEL`, mặc định
  `ElevenLabs` / `Eleven V3`; tên đúng như dropdown trên web) — giới hạn ký tự/lượt:
  Omnivoice (10.000) · Eleven V3 (1.500) · Eleven V2.5 (3.000) · Auto TTS v1 (5.000) ·
  Minimax v2.8 HD (5.000) / v2.8 Turbo (10.000) / v2.6 HD·Turbo (3.000).
  Script tự kiểm giới hạn trước khi tốn credit.
- **Đăng nhập**: lần đầu chạy headed → cửa sổ trình duyệt mở ra, đăng nhập tay
  (phiên lưu vào `.pw-profile/`, các lần sau tự vào); hoặc gắn vào Chrome thật đã
  đăng nhập: `--cdp 9222` (mở Chrome với `--remote-debugging-port=9222`).
- **Giọng**: env `AIVA_VOICE_A`/`AIVA_VOICE_B` (ưu tiên) hoặc `aivaVoice` cho từng
  speaker trong `dialogue.json` — là TỪ KHÓA TÌM trong "Thư viện giọng" (tên hoặc
  ID). ⚠ Giọng PHẢI khớp provider (dùng bộ lọc "Nguồn" trong thư viện để xem),
  không thì web báo lỗi kiểu "Upload reference audio lên OmniVoice thất bại".

```bash
npm run dialogue:audio:aiva -- --data "projects/<id>/dialogue.json"   # --verbose để dò UI
npm run dialogue:align -- --data "projects/<id>/dialogue.json"        # Whisper -> words[] (karaoke)
```
- Tự **RESUME** các lượt còn thiếu; `--fresh` làm lại từ đầu, `--limit N` để test
  vài lượt trước khi chạy cả video.
- **Không trả mốc từng từ** → luôn chạy `dialogue:align` (Whisper) sau để có `words[]`.
- `enTts` (tag cảm xúc) vẫn được ưu tiên gửi khi dùng model Eleven V3.
- Selector bám theo text tiếng Việt + role (trang không có id/data-testid ổn định);
  UI đổi thì chạy `--verbose` và chỉnh các hàm `select*` trong script.

## GenMax API cho HỘI THOẠI (gateway ElevenLabs / MiniMax / CapCut)
Adapter `scripts/tts-genmax.mjs` (npm: `dialogue:audio:genmax`) gọi REST
`https://api.genmax.io` — gateway TTS trả phí theo **credit GenMax**, không cần
key ElevenLabs riêng. Docs: https://genmax.io/app/api-docs (SPA — nội dung nằm
trong các chunk YAML của bundle).

- **Auth**: header `xi-api-key: $GENMAX_API_KEY` (lấy ở trang API Keys sau khi
  đăng nhập genmax.io).
- **Luồng async**: `POST /v1/text-to-speech/{voice_id}` → `202 {id}` →
  poll `GET /v1/history/{id}` đến `status=completed` → tải `result.audio_url`
  (mp3). Script tự poll 2s/lần, timeout 3 phút/lượt.
- **Provider** (`GENMAX_PROVIDER` / `--provider` / `speakers[X].genmaxProvider`):
  `elevenlabs` (mặc định, model `eleven_multilingual_v2`) · `minimax`
  (`speech-2.8-turbo`, `language_code` là TÊN ngôn ngữ, script tự xử) · `capcut`.
- **Giọng**: `GENMAX_VOICE_A/_B` hoặc `speakers[X].genmaxVoiceId` — voice_id
  PHẢI khớp provider (ElevenLabs: ID thư viện, vd Rachel `21m00Tcm4TlvDq8ikWAM`;
  MiniMax: uniq_id kiểu `English_ManWithDeepVoice`; CapCut: xem
  `GET /v1/capcut-voices`). Duyệt giọng: `GET /v1/default-voices?search=...`.
- **Speed**: `GENMAX_SPEED` / `--speed` / `speakers[X].genmaxSpeed`
  (ElevenLabs 0.7–1.2; MiniMax/CapCut 0.5–2.0) — thường KHÔNG cần vì đã có
  bước `dialogue:speed` theo level.

```bash
npm run dialogue:audio:genmax -- --data "projects/<id>/dialogue.json" --limit 2  # test trước
npm run dialogue:align -- --data "projects/<id>/dialogue.json"                   # Whisper -> words[]
```
- Tự **RESUME**; `--fresh` làm lại từ đầu. Gửi `enTts` nếu có (ElevenLabs v3 hiểu tag).
- **Không trả mốc từng từ** → luôn chạy `dialogue:align` sau.
- API còn `POST /v1/dialogue` (nguyên hội thoại nhiều speaker → MỘT file audio) —
  KHÔNG dùng cho pipeline này vì cần audio TÁCH TỪNG LƯỢT để karaoke/verify.

## Thẻ cảm xúc cho Gemini / AI Studio (KHÁC ElevenLabs)
`tts-gemini.mjs` và `tts-aistudio.mjs` gửi `turn.enTts` nếu có (fallback `turn.en`),
nên bạn có thể chèn tag cảm xúc vào `enTts` — GIỮ `turn.en` SẠCH (phụ đề `.srt`
dùng `turn.en`). Google điều khiển biểu cảm KHÁC ElevenLabs:

- **Kênh chính = style prompt**, không phải tag. Ở AI Studio đó là chip
  **Style / Accent / Pace** (script set sẵn Newscaster / American / Natural). Cảm
  xúc tổng thể nên đặt ở đây, không nhét vào từng câu.
- **Tag inline `[...]` tự do** (chấp cả `[speaking slowly]`, `[like a cartoon dog]`),
  nhưng hành vi chia 4 nhóm — chỉ 3 nhóm đầu AN TOÀN, nhóm cảm-xúc-tính-từ dễ bị
  **đọc to** thay vì diễn:

| Nhóm | Ví dụ tag | An toàn? |
|---|---|---|
| Âm phi lời (chèn tiếng) | `[sigh]` `[laughs]` `[giggles]` `[gasp]` `[clears throat]` `[uhm]` | ✅ |
| Style/delivery | `[whispering]` `[shouting]` `[speaking slowly]` `[extremely fast]` `[robotic]` `[sarcasm]` | ✅ |
| Nghỉ | `[short pause]` `[medium pause]` `[long pause]` | ✅ |
| Cảm xúc (tính từ) | `[scared]` `[curious]` `[bored]` `[excited]` `[angry]` `[serious]` | ⚠️ dễ bị đọc to → dùng style prompt thay thế |

- **Không làm được**: `[crowd laughing]` / tiếng môi trường; chèn file audio.
- **SSML** (`<break>`, `<prosody>`, `<emphasis>`, `<phoneme ipa>`…) chỉ chạy trên
  **Google Cloud TTS**; bề mặt Gemini API / AI Studio (các script này) KHÔNG hỗ trợ
  → chỉ dùng tag `[...]` + style prompt.
### Thời gian tag phải được tính vào highlight (QUAN TRỌNG)
Tag tạo âm (cười/thở/`[long pause]`) chiếm thời gian THẬT trong audio. Highlight
(`Caption.tsx`) hiển thị `turn.words[].text` và bám timing của `words[]`, mà `words[]`
LUÔN dựng từ audio thật → thời gian cảm xúc tự động được tính:
- **ElevenLabs API**: `buildWords` lấy mốc từng ký tự thật rồi mới lọc tag → từ sau tiếng
  cười bắt đầu đúng sau khi cười xong (khoảng cười nằm giữa 2 từ).
- **ElevenLabs web/Gemini/AI Studio/aivideoauto**: `dialogue:align` (Whisper) đặt mỗi từ
  vào đúng vị trí vang lên; tiếng cười/pause là khoảng trống → lúc đó KHÔNG từ nào sáng (đúng ý).

Vì vậy: **LUÔN chạy `dialogue:align` sau khi sinh bằng `enTts`** (trừ ElevenLabs API đã có
mốc thật). Bỏ align → `words[]` rỗng → mất karaoke (không sai giờ nhưng không highlight).
KHÔNG được chia đều thời gian theo `turn.en` (sẽ lệch vì bỏ qua thời lượng tag).
Phụ đề `.srt` vẫn lấy từ `turn.en` sạch nên không dính tag.

(ElevenLabs v3 dùng bộ tag riêng, ổn định hơn và tự lọc tag khỏi `words[]` — xem mục trên.)

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
