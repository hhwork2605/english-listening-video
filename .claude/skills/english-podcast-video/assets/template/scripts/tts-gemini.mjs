/**
 * Sinh giọng đọc hội thoại bằng Gemini TTS (Google AI Studio) — FREE tier.
 *
 * Model: gemini-2.5-flash-preview-tts (env GEMINI_TTS_MODEL).
 * Trả về PCM 24kHz, 16-bit, mono (base64) -> script tự bọc WAV header.
 * KHÔNG trả mốc từng từ -> sau đó chạy: npm run dialogue:align -- --data <file>
 *
 * CẦN trong .env (gốc):
 *   GEMINI_API_KEY        (bắt buộc; lấy tại https://aistudio.google.com/apikey)
 *   GEMINI_TTS_MODEL      (tuỳ chọn; mặc định gemini-2.5-flash-preview-tts)
 *   GEMINI_VOICE_A / _B   (tên giọng prebuilt, vd Kore / Puck / Charon / Aoede ...)
 *
 * Giọng có thể override theo speaker: speakers[X].geminiVoice trong dialogue.json.
 *
 * Cách dùng:
 *   node scripts/tts-gemini.mjs --data projects/<id>/dialogue.json
 *   npm run dialogue:audio:gemini -- --data projects/<id>/dialogue.json
 *   # tuỳ chọn: --limit 1 (chỉ làm N lượt đầu để test) | --model <name>
 */
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { resolve, dirname, join, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { GoogleGenAI } from "@google/genai";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const argv = process.argv.slice(2);
const getArg = (n, d) => {
  const i = argv.indexOf(n);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};
const dataRel = getArg("--data", "");
if (!dataRel) {
  console.error("LỖI: thiếu --data <path>. Truyền rõ file của project, vd: --data projects/<id>/dialogue.json");
  console.error("(Không còn default data/dialogue.json — buffer đó thường chứa project CŨ, chạy nhầm là tốn credit TTS.)");
  process.exit(1);
}
const LIMIT = Number(getArg("--limit", "0")) || 0;
const FRESH = argv.includes("--fresh"); // xoá audio cũ + làm lại từ đầu
const PACE_MS = Number(getArg("--pace", process.env.GEMINI_PACE_MS || "20000")) || 20000;

// --- nạp .env ---
const envPath = resolve(ROOT, ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

// Quota 3 RPM là "PerProjectPerModel" -> luân phiên NHIỀU model để cộng dồn throughput.
const MODELS = (getArg("--models", process.env.GEMINI_TTS_MODELS || "gemini-2.5-flash-preview-tts,gemini-3.1-flash-tts-preview"))
  .split(",").map((s) => s.trim()).filter(Boolean);
const CONFIG = {
  apiKey: process.env.GEMINI_API_KEY || "",
  models: MODELS,
  voices: {
    A: process.env.GEMINI_VOICE_A || "Kore",
    B: process.env.GEMINI_VOICE_B || "Puck",
  },
};
// Mỗi model ~3 req/phút -> nhịp = 21s / số model (vd 2 model => ~10.5s/lượt => ~6 RPM).
const DEFAULT_PACE = Math.ceil(21000 / Math.max(1, MODELS.length));

if (!CONFIG.apiKey) {
  console.error("Thieu GEMINI_API_KEY trong .env. Lay tai https://aistudio.google.com/apikey.");
  process.exit(1);
}

const round3 = (n) => Math.round((Number(n) || 0) * 1000) / 1000;

// Bọc PCM (mono, 16-bit) thành file WAV.
function pcmToWav(pcm, sampleRate = 24000, channels = 1, bitsPerSample = 16) {
  const byteRate = (sampleRate * channels * bitsPerSample) / 8;
  const blockAlign = (channels * bitsPerSample) / 8;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

// Đọc sampleRate từ mimeType kiểu "audio/L16;rate=24000".
function rateFromMime(mime, fallback = 24000) {
  const m = /rate=(\d+)/.exec(mime || "");
  return m ? Number(m[1]) : fallback;
}

const ai = new GoogleGenAI({ apiKey: CONFIG.apiKey });

async function synth(text, voiceName, model) {
  const res = await ai.models.generateContent({
    model,
    contents: [{ parts: [{ text }] }],
    config: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName } },
      },
    },
  });
  const part = res?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
  if (!part) {
    throw new Error("Khong co audio trong response Gemini: " + JSON.stringify(res).slice(0, 250));
  }
  const pcm = Buffer.from(part.inlineData.data, "base64");
  const rate = rateFromMime(part.inlineData.mimeType, 24000);
  return { pcm, rate };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Bóc số giây retry từ thông điệp lỗi 429 (RetryInfo "retryDelay":"46s" hoặc "retry in 46.3s").
function retryDelayMs(err) {
  const s = String(err?.message || err);
  const m = /retry(?:Delay)?["':\s]+(?:in\s+)?(\d+(?:\.\d+)?)s/i.exec(s) || /"(\d+(?:\.\d+)?)s"/.exec(s);
  return m ? Math.ceil(parseFloat(m[1]) * 1000) + 2000 : 0;
}
const is429 = (err) => /429|RESOURCE_EXHAUSTED|quota/i.test(String(err?.message || err));

// --- chạy ---
const dataPath = resolve(ROOT, dataRel);
// Namespace audio theo project (thư mục chứa file --data) để KHÔNG đè file giữa
// các project. projects/<id>/dialogue.json -> public/audio/<id>/... ; data/ giữ phẳng.
const NS = /[\\/]projects[\\/]/i.test(dirname(dataPath)) ? basename(dirname(dataPath)) : "";
const audioRel = (id, ext = "wav") => (NS ? `audio/${NS}/d${id}.${ext}` : `audio/d${id}.${ext}`);
const audioDir = resolve(ROOT, "public", "audio", NS);
mkdirSync(audioDir, { recursive: true });
if (FRESH && !LIMIT) {
  for (const f of readdirSync(audioDir)) {
    if (/^d.*\.(wav|mp3)$/i.test(f)) rmSync(join(audioDir, f), { force: true });
  }
}

const doc = JSON.parse(readFileSync(dataPath, "utf8").replace(/^﻿/, ""));
console.log(`Nguồn kịch bản: ${dataRel} — "${doc.title || "?"}" | topic: ${doc.topic || "?"} | ${(doc.turns || []).length} lượt`);
const BUFFER_PATH = resolve(ROOT, "data/dialogue.json"); // buffer render của Remotion
function saveDoc(d) {
  const body = JSON.stringify(d, null, 2);
  writeFileSync(dataPath, body, "utf8");
  // tự đè buffer: data/ luôn là project đang làm, không cần chờ project:use
  if (dataPath !== BUFFER_PATH) { try { writeFileSync(BUFFER_PATH, body, "utf8"); } catch {} }
}
let turns = doc.turns || [];
if (LIMIT) turns = turns.slice(0, LIMIT);

const effPace = argv.includes("--pace") || process.env.GEMINI_PACE_MS ? PACE_MS : DEFAULT_PACE;

let done = 0;
let made = 0;
let callIdx = 0; // xoay vòng model qua từng lượt
for (const turn of turns) {
  done++;
  // RESUME: bỏ qua lượt đã có file audio + durationInSec hợp lệ.
  const relPath = audioRel(turn.id);
  if (!FRESH && turn.audio && turn.durationInSec > 0 && existsSync(resolve(ROOT, "public", relPath))) {
    continue;
  }

  const sp = (doc.speakers && doc.speakers[turn.speaker]) || {};
  const voiceName = sp.geminiVoice || CONFIG.voices[turn.speaker] || "Kore";
  // Ưu tiên enTts (có tag cảm xúc) — Gemini TTS hỗ trợ tag [...]; giữ turn.en
  // SẠCH cho .srt. Chỉ dùng tag AN TOÀN (âm phi lời / style / pause) trong enTts,
  // tránh tag tính từ cảm xúc vì có thể bị đọc to. Xem references/better-tts.md.
  const text = turn.enTts || turn.en;

  let pcm, rate, usedModel, lastErr;
  const maxAttempts = CONFIG.models.length * 4;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const model = CONFIG.models[(callIdx + attempt) % CONFIG.models.length];
    try {
      ({ pcm, rate } = await synth(text, voiceName, model));
      usedModel = model;
      break;
    } catch (e) {
      lastErr = e;
      if (is429(e)) {
        // Hết quota model này -> thử NGAY model kế. Chỉ chờ khi đã xoay hết 1 vòng model.
        if ((attempt + 1) % CONFIG.models.length === 0) {
          const wait = retryDelayMs(e) || 8000;
          console.log(`  ! lượt ${turn.id}: tất cả model 429 -> chờ ${Math.round(wait / 1000)}s`);
          await sleep(wait);
        }
      } else {
        await sleep(1500 * (attempt + 1));
      }
    }
  }
  if (!pcm) {
    saveDoc(doc); // lưu tiến độ trước khi dừng
    throw new Error(`Lỗi sinh audio lượt ${turn.id} (đã lưu ${made} file mới, resume lần sau): ${lastErr?.message || lastErr}`);
  }
  callIdx++;

  const wav = pcmToWav(pcm, rate);
  writeFileSync(resolve(ROOT, "public", relPath), wav);

  turn.audio = relPath;
  turn.durationInSec = round3(pcm.length / (rate * 2)); // mono 16-bit
  turn.words = []; // chạy dialogue:align (Whisper) để lấy mốc từng từ
  made++;
  saveDoc(doc); // lưu sau mỗi lượt (an toàn resume)
  console.log(`[${done}/${turns.length}] d${turn.id}.wav  [${turn.speaker}/${voiceName}/${usedModel.replace("gemini-", "")}]  ${turn.durationInSec}s`);

  if (done < turns.length) await sleep(effPace);
}

saveDoc(doc);
console.log(`Da cap nhat ${dataRel} (audio tu Gemini: ${CONFIG.models.join(" + ")}).`);
console.log("Tiep theo: chay Whisper de co karaoke ->  npm run dialogue:align -- --data " + dataRel);
