/**
 * Sinh giọng đọc hội thoại bằng ElevenLabs (giọng tự nhiên, chất lượng cao).
 *
 * Mặc định model "eleven_v3" — hỗ trợ AUDIO TAGS cảm xúc trong văn bản, vd:
 *   [laughs] [whispers] [excited] [sighs] [sarcastic] [curious] [happy] [sad]
 * Dùng endpoint /with-timestamps để LẤY LUÔN mốc thời gian từng KÝ TỰ rồi dựng
 * words[] (mốc từng từ) — KHÔNG cần Whisper. Token là audio tag (vd "[laughs]")
 * được LỌC BỎ khỏi words[] để phụ đề/karaoke không hiện tag.
 *
 * Văn bản gửi đi = turn.enTts (nếu có, bản kèm tag) NGƯỢC LẠI turn.en. Hãy giữ
 * turn.en SẠCH (không tag) vì phụ đề .srt dùng turn.en; bỏ tag vào turn.enTts.
 *
 * Cần ELEVENLABS_API_KEY (đặt trong .env ở gốc project, hoặc biến môi trường).
 * Giọng: speakers[X].elevenVoiceId; nếu trống dùng mặc định (env ELEVEN_VOICE_A/B).
 *
 * Cách dùng:
 *   node scripts/tts-elevenlabs.mjs --data projects/<id>/dialogue.json
 *   npm run dialogue:audio:eleven -- --data projects/<id>/dialogue.json
 *   # tuỳ chọn: --model eleven_multilingual_v2   --format mp3_44100_128
 */
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// --- tham số dòng lệnh ---
const argv = process.argv.slice(2);
const getArg = (name, def) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : def;
};
const dataRel = getArg("--data", "data/dialogue.json");
const model = getArg("--model", process.env.ELEVENLABS_MODEL || "eleven_v3");
const outputFormat = getArg("--format", process.env.ELEVENLABS_FORMAT || "mp3_44100_128");
// Độ ổn định v3: 0.0 = Creative (biểu cảm nhất), 0.5 = Natural (mặc định), 1.0 = Robust.
const stability = Number(getArg("--stability", process.env.ELEVENLABS_STABILITY || "0.5"));

// --- nạp .env ở gốc (đơn giản, không phụ thuộc thư viện) ---
const envPath = resolve(ROOT, ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}

const API_KEY = process.env.ELEVENLABS_API_KEY;
if (!API_KEY) {
  console.error(
    "Thieu ELEVENLABS_API_KEY. Tao file .env o goc voi dong:\n" +
      "  ELEVENLABS_API_KEY=sk_...\n" +
      "hoac dat bien moi truong roi chay lai."
  );
  process.exit(1);
}

// Giọng mặc định (ID voice ElevenLabs). Ghi đè bằng speakers[X].elevenVoiceId
// trong dialogue.json, hoặc env ELEVEN_VOICE_A / ELEVEN_VOICE_B.
const DEFAULT_VOICES = {
  A: process.env.ELEVEN_VOICE_A || "21m00Tcm4TlvDq8ikWAM", // Rachel (nữ)
  B: process.env.ELEVEN_VOICE_B || "pNInz6obpgDQGcFmaJgB", // Adam (nam)
};

const round3 = (n) => Math.round((Number(n) || 0) * 1000) / 1000;
const stripTags = (s) => s.replace(/\[[^\]]*\]/g, "").trim();

// Gom mốc ký tự thành mốc từng TỪ; LỌC BỎ token là audio tag (vd "[laughs]").
function buildWords(alignment) {
  const chars = alignment?.characters || [];
  const st = alignment?.character_start_times_seconds || [];
  const en = alignment?.character_end_times_seconds || [];
  const raw = [];
  let cur = null;
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    if (/\s/.test(c)) {
      if (cur) {
        raw.push(cur);
        cur = null;
      }
      continue;
    }
    if (!cur) cur = { text: c, startSec: round3(st[i]), endSec: round3(en[i]) };
    else {
      cur.text += c;
      cur.endSec = round3(en[i]);
    }
  }
  if (cur) raw.push(cur);
  // Bỏ tag cảm xúc khỏi text; loại token rỗng (vd "[laughs]" -> "").
  const words = [];
  for (const w of raw) {
    const text = stripTags(w.text);
    if (!text) continue;
    words.push({ text, startSec: w.startSec, endSec: w.endSec });
  }
  return words;
}

// Ước lượng độ dài khi model không trả alignment (vd v3 trên vài cấu hình).
function estimateDuration(buf, fmt) {
  if (fmt.startsWith("mp3")) {
    const kbps = parseInt(fmt.split("_")[2] || "128", 10);
    return round3((buf.length * 8) / (kbps * 1000));
  }
  if (fmt.startsWith("pcm")) {
    const sr = parseInt(fmt.split("_")[1] || "44100", 10);
    return round3(buf.length / (sr * 2)); // 16-bit mono
  }
  return 0;
}

async function synth(text, voiceId) {
  const url =
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps` +
    `?output_format=${encodeURIComponent(outputFormat)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "xi-api-key": API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      model_id: model,
      voice_settings: { stability, use_speaker_boost: true },
    }),
  });
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${await res.text()}`);
  return res.json(); // { audio_base64, alignment, normalized_alignment }
}

const dataPath = resolve(ROOT, dataRel);
const audioDir = resolve(ROOT, "public", "audio");
mkdirSync(audioDir, { recursive: true });
// Dọn audio hội thoại cũ (wav từ SAPI hoặc mp3 từ lần trước) cho khớp dialogue hiện tại.
for (const f of readdirSync(audioDir)) {
  if (/^d.*\.(wav|mp3)$/i.test(f)) rmSync(join(audioDir, f), { force: true });
}

const ext = outputFormat.startsWith("pcm") ? "wav" : "mp3";
const doc = JSON.parse(readFileSync(dataPath, "utf8").replace(/^﻿/, ""));
const turns = doc.turns || [];
let missingTimings = 0;

for (const turn of turns) {
  const sp = (doc.speakers && doc.speakers[turn.speaker]) || {};
  const voiceId = sp.elevenVoiceId || DEFAULT_VOICES[turn.speaker] || DEFAULT_VOICES.A;
  const text = turn.enTts || turn.en; // enTts = bản có audio tag (nếu có)

  const out = await synth(text, voiceId);
  const buf = Buffer.from(out.audio_base64, "base64");
  const rel = `audio/d${turn.id}.${ext}`;
  writeFileSync(resolve(ROOT, "public", rel), buf);

  const align = out.alignment || out.normalized_alignment || {};
  const words = buildWords(align);
  const lastEnd = (align.character_end_times_seconds || []).slice(-1)[0];
  const dur = lastEnd != null ? round3(lastEnd) : estimateDuration(buf, outputFormat);
  if (!words.length) missingTimings++;

  turn.audio = rel;
  turn.durationInSec = dur;
  turn.words = words;
  console.log(`d${turn.id}.${ext}  [${turn.speaker}]  ${dur}s  ${words.length} tu  (voice ${voiceId})`);
}

writeFileSync(dataPath, JSON.stringify(doc, null, 2), "utf8");
console.log(`Da cap nhat ${dataRel} (audio + words tu ElevenLabs ${model}). Gio render duoc roi.`);
if (missingTimings) {
  console.warn(
    `Luu y: ${missingTimings} luot khong co moc tu (model khong tra alignment). ` +
      `Highlight se hien chu thuong; chay buoc 4b (dialogue:align) de co karaoke.`
  );
}
