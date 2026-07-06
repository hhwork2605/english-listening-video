/**
 * Sinh giọng đọc hội thoại bằng GenMax API (https://genmax.io) — gateway TTS
 * cho ElevenLabs / MiniMax / CapCut, tính phí theo credit.
 *
 * Luồng API (async):
 *   POST https://api.genmax.io/v1/text-to-speech/{voice_id}  (header xi-api-key)
 *     -> 202 { id, status: "pending" }
 *   GET  https://api.genmax.io/v1/history/{id}
 *     -> { status: pending|processing|completed|failed, result: { audio_url } }
 *   Tải audio_url về public/audio/<project>/d<id>.mp3
 *
 * KHÔNG trả mốc từng từ -> sau đó chạy: npm run dialogue:align -- --data <file>
 *
 * CẦN trong .env (gốc):
 *   GENMAX_API_KEY        (bắt buộc; lấy trong trang API Keys của genmax.io)
 *   GENMAX_PROVIDER       (tuỳ chọn: elevenlabs | minimax | capcut; mặc định elevenlabs)
 *   GENMAX_MODEL          (tuỳ chọn; mặc định theo provider — xem DEFAULT_MODEL)
 *   GENMAX_VOICE_A / _B   (voice_id mặc định cho speaker A/B)
 *
 * Override theo speaker trong dialogue.json:
 *   speakers[X].genmaxVoiceId / .genmaxProvider / .genmaxModel / .genmaxSpeed
 *
 * Cách dùng:
 *   node scripts/tts-genmax.mjs --data projects/<id>/dialogue.json
 *   npm run dialogue:audio:genmax -- --data projects/<id>/dialogue.json
 *   # tuỳ chọn: --limit 1 | --fresh | --provider minimax | --model <id> | --speed 0.9
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
const PACE_MS = Number(getArg("--pace", process.env.GENMAX_PACE_MS || "1000")) || 0;
const POLL_MS = 2000; // nhịp poll /v1/history/{id}
const POLL_TIMEOUT_MS = 180000; // 3 phút / lượt là quá đủ cho 1 câu

// --- nạp .env ---
const envPath = resolve(ROOT, ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const API_BASE = process.env.GENMAX_API_BASE || "https://api.genmax.io";
const API_KEY = process.env.GENMAX_API_KEY || "";
if (!API_KEY) {
  console.error("Thieu GENMAX_API_KEY trong .env. Lay tai genmax.io (menu API / API Keys).");
  process.exit(1);
}

// Model mặc định theo provider (theo docs genmax.io/app/api-docs).
const DEFAULT_MODEL = {
  elevenlabs: "eleven_multilingual_v2",
  minimax: "speech-2.8-turbo",
  capcut: "capcut",
};
// language_code: ElevenLabs/CapCut dùng mã ("en"), MiniMax dùng TÊN ngôn ngữ ("English").
const LANGUAGE_CODE = { elevenlabs: "en", minimax: "English", capcut: "en" };

const CONFIG = {
  provider: (getArg("--provider", process.env.GENMAX_PROVIDER || "elevenlabs") || "").toLowerCase(),
  model: getArg("--model", process.env.GENMAX_MODEL || ""),
  speed: Number(getArg("--speed", process.env.GENMAX_SPEED || "0")) || 0,
  voices: {
    A: process.env.GENMAX_VOICE_A || "21m00Tcm4TlvDq8ikWAM", // Rachel (nữ, ElevenLabs)
    B: process.env.GENMAX_VOICE_B || "pNInz6obpgDQGcFmaJgB", // Adam (nam, ElevenLabs)
  },
};
if (!DEFAULT_MODEL[CONFIG.provider]) {
  console.error(`Provider không hợp lệ: "${CONFIG.provider}". Chọn: elevenlabs | minimax | capcut.`);
  process.exit(1);
}

const round3 = (n) => Math.round((Number(n) || 0) * 1000) / 1000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function durationOf(buf, ext) {
  if (ext === "wav" && buf.length > 44 && buf.toString("ascii", 0, 4) === "RIFF") {
    const byteRate = buf.readUInt32LE(28);
    if (byteRate > 0) return round3((buf.length - 44) / byteRate);
  }
  // mp3 coi như CBR ~128kbps; dialogue:align sẽ dựng words[] từ audio thật.
  return round3((buf.length * 8) / (128 * 1000));
}
const extOf = (s) => (/\.wav(\?|#|$)/i.test(s || "") ? "wav" : "mp3");

async function api(path, init = {}) {
  const res = await fetch(API_BASE + path, {
    ...init,
    headers: {
      "xi-api-key": API_KEY,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = null; }
  if (!res.ok) {
    throw new Error(`GenMax ${init.method || "GET"} ${path} -> HTTP ${res.status}: ${text.slice(0, 300)}`);
  }
  return json;
}

// Gửi 1 lượt TTS, poll đến khi xong, trả về { buf, ext, taskId }.
async function synth(text, { voiceId, provider, model, speed }) {
  const body = {
    text,
    provider,
    model_id: model,
    language_code: LANGUAGE_CODE[provider],
  };
  if (speed) body.voice_settings = { speed };

  const task = await api(`/v1/text-to-speech/${encodeURIComponent(voiceId)}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!task?.id) throw new Error("GenMax không trả task id: " + JSON.stringify(task).slice(0, 200));

  const deadline = Date.now() + POLL_TIMEOUT_MS;
  let st = task;
  while (Date.now() < deadline) {
    await sleep(POLL_MS);
    st = await api(`/v1/history/${task.id}`);
    if (st.status === "completed") break;
    if (st.status === "failed") {
      throw new Error(`GenMax task ${task.id} failed: ${st.error || st.detail_error || "?"}`);
    }
  }
  const audioUrl = st?.result?.audio_url;
  if (st.status !== "completed" || !audioUrl) {
    throw new Error(`GenMax task ${task.id} chưa xong sau ${POLL_TIMEOUT_MS / 1000}s (status=${st.status}).`);
  }

  const res = await fetch(audioUrl, { headers: { "xi-api-key": API_KEY } });
  if (!res.ok) throw new Error(`Tải audio ${audioUrl} -> HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 500) throw new Error(`Audio tải về quá nhỏ (${buf.length} bytes) — nghi lỗi: ${buf.toString("utf8").slice(0, 200)}`);
  return { buf, ext: extOf(audioUrl), taskId: task.id };
}

// --- chuẩn bị file/thư mục ---
const dataPath = resolve(ROOT, dataRel);
// Namespace audio theo project (thư mục chứa file --data) để KHÔNG đè file giữa
// các project. projects/<id>/dialogue.json -> public/audio/<id>/... ; data/ giữ phẳng.
const NS = /[\\/]projects[\\/]/i.test(dirname(dataPath)) ? basename(dirname(dataPath)) : "";
const audioRel = (id, ext = "mp3") => (NS ? `audio/${NS}/d${id}.${ext}` : `audio/d${id}.${ext}`);
const audioDir = resolve(ROOT, "public", "audio", NS);
mkdirSync(audioDir, { recursive: true });
if (FRESH && !LIMIT) {
  for (const f of readdirSync(audioDir)) {
    if (/^d.*\.(wav|mp3)$/i.test(f)) rmSync(join(audioDir, f), { force: true });
  }
}

const doc = JSON.parse(readFileSync(dataPath, "utf8").replace(/^﻿/, ""));
console.log(`Nguồn kịch bản: ${dataRel} — "${doc.title || "?"}" | topic: ${doc.topic || "?"} | ${(doc.turns || []).length} lượt`);
console.log(`GenMax provider: ${CONFIG.provider} | model: ${CONFIG.model || DEFAULT_MODEL[CONFIG.provider]}${CONFIG.speed ? ` | speed: ${CONFIG.speed}` : ""}`);
const BUFFER_PATH = resolve(ROOT, "data/dialogue.json"); // buffer render của Remotion
function saveDoc(d) {
  const body = JSON.stringify(d, null, 2);
  writeFileSync(dataPath, body, "utf8");
  // tự đè buffer: data/ luôn là project đang làm, không cần chờ project:use
  if (dataPath !== BUFFER_PATH) { try { writeFileSync(BUFFER_PATH, body, "utf8"); } catch {} }
}
let turns = doc.turns || [];
if (LIMIT) turns = turns.slice(0, LIMIT);

let done = 0;
let made = 0;
for (const turn of turns) {
  done++;
  // RESUME: bỏ qua lượt đã có file audio + durationInSec hợp lệ.
  if (!FRESH && turn.audio && turn.durationInSec > 0 && existsSync(resolve(ROOT, "public", turn.audio))) {
    continue;
  }

  const sp = (doc.speakers && doc.speakers[turn.speaker]) || {};
  const provider = (sp.genmaxProvider || CONFIG.provider).toLowerCase();
  const opts = {
    voiceId: sp.genmaxVoiceId || CONFIG.voices[turn.speaker] || CONFIG.voices.A,
    provider,
    model: sp.genmaxModel || CONFIG.model || DEFAULT_MODEL[provider],
    speed: Number(sp.genmaxSpeed) || CONFIG.speed || 0,
  };
  // Ưu tiên enTts (bản có chỉnh cho TTS) — giữ turn.en SẠCH cho .srt.
  const text = turn.enTts || turn.en;

  let out, lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      out = await synth(text, opts);
      break;
    } catch (e) {
      lastErr = e;
      const s = String(e?.message || e);
      if (/HTTP 401|HTTP 403|credit|insufficient/i.test(s)) break; // hết quyền/credit thì retry vô ích
      await sleep(3000 * (attempt + 1));
    }
  }
  if (!out) {
    saveDoc(doc); // lưu tiến độ trước khi dừng
    throw new Error(`Lỗi sinh audio lượt ${turn.id} (đã lưu ${made} file mới, resume lần sau): ${lastErr?.message || lastErr}`);
  }

  const relPath = audioRel(turn.id, out.ext);
  writeFileSync(resolve(ROOT, "public", relPath), out.buf);

  turn.audio = relPath;
  turn.durationInSec = durationOf(out.buf, out.ext);
  turn.words = []; // chạy dialogue:align (Whisper) để lấy mốc từng từ
  made++;
  saveDoc(doc); // lưu sau mỗi lượt (an toàn resume)
  console.log(`[${done}/${turns.length}] d${turn.id}.${out.ext}  [${turn.speaker}/${opts.provider}/${opts.voiceId}]  ~${turn.durationInSec}s`);

  if (done < turns.length && PACE_MS) await sleep(PACE_MS);
}

saveDoc(doc);
console.log(`Da cap nhat ${dataRel} (audio tu GenMax/${CONFIG.provider}).`);
console.log("Tiep theo: chay Whisper de co karaoke ->  npm run dialogue:align -- --data " + dataRel);
