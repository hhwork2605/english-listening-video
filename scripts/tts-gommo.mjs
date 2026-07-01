/**
 * Sinh giọng đọc hội thoại qua API TTS của nền tảng gommo (Create Audio).
 *
 * Theo tài liệu chính thức Gommo AI API:
 *   - URL:           POST https://api.gommo.net/ai/audio
 *   - Content-Type:  application/x-www-form-urlencoded
 *   - Auth:          access_token + domain TRONG BODY
 *   - action_type:   "create"
 *   - Trả về ĐỒNG BỘ: audioInfo.file_url + audioInfo.duration (KHÔNG cần poll job).
 *
 * Model: eleven_v3 | eleven_flash_v2_5 (xem danh sách: action_type=create cần model hợp lệ).
 * Giọng: speakers[X].gommoVoiceId trong dialogue.json, hoặc env GOMMO_VOICE_A/B
 *        (phải là voice_id mà TÀI KHOẢN gommo truy cập được — xem searchVoices).
 *
 * API này KHÔNG trả mốc từng từ → sau khi sinh audio, chạy bước 4b (Whisper):
 *   npm run dialogue:align -- --data projects/<id>/dialogue.json
 *
 * CẦN trong .env (gốc):
 *   GOMMO_ACCESS_TOKEN  (bắt buộc; lấy tại https://gommo.net/pages/account/apikeys)
 *   GOMMO_DOMAIN        (bắt buộc; vd "gommo.net")
 *   GOMMO_VOICE_A / GOMMO_VOICE_B  (voice_id cho speaker A/B)
 *   GOMMO_TTS_MODEL     (tuỳ chọn; mặc định eleven_v3)
 *
 * Cách dùng:
 *   node scripts/tts-gommo.mjs --data projects/<id>/dialogue.json
 *   npm run dialogue:audio:gommo -- --data projects/<id>/dialogue.json
 *   # tuỳ chọn: --model eleven_flash_v2_5 | --verbose
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

// --- tham số dòng lệnh ---
const argv = process.argv.slice(2);
const has = (n) => argv.includes(n);
const getArg = (n, d) => {
  const i = argv.indexOf(n);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};
const dataRel = getArg("--data", "data/dialogue.json");
const VERBOSE = has("--verbose");

// --- nạp .env ---
const envPath = resolve(ROOT, ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const CONFIG = {
  base: getArg("--base", process.env.GOMMO_API_BASE || "https://api.gommo.net"),
  model: getArg("--model", process.env.GOMMO_TTS_MODEL || "eleven_v3"),
  token: process.env.GOMMO_ACCESS_TOKEN || "",
  domain: process.env.GOMMO_DOMAIN || "gommo.net",
  projectId: process.env.GOMMO_PROJECT_ID || "default",
  voices: {
    A: process.env.GOMMO_VOICE_A || "",
    B: process.env.GOMMO_VOICE_B || "",
  },
};

if (!CONFIG.token) {
  console.error(
    "Thieu GOMMO_ACCESS_TOKEN. Dat trong .env (GOMMO_ACCESS_TOKEN=...) + GOMMO_DOMAIN=gommo.net.\n" +
      "Lay token tai https://gommo.net/pages/account/apikeys."
  );
  process.exit(1);
}

const round3 = (n) => Math.round((Number(n) || 0) * 1000) / 1000;

// Tìm sâu URL audio đầu tiên trong response (phòng khi key đổi tên).
const isAudioUrl = (s) =>
  typeof s === "string" && /^https?:\/\/\S+\.(mp3|wav|m4a|ogg|aac)(\?|#|$)/i.test(s);
function deepFindAudioUrl(obj, seen = new Set()) {
  if (obj == null || typeof obj !== "object" || seen.has(obj)) return undefined;
  seen.add(obj);
  for (const v of Object.values(obj)) {
    if (isAudioUrl(v)) return v;
    if (v && typeof v === "object") {
      const r = deepFindAudioUrl(v, seen);
      if (r) return r;
    }
  }
  return undefined;
}

// POST application/x-www-form-urlencoded -> JSON
async function apiPost(path, params) {
  const body = new URLSearchParams(params).toString();
  const res = await fetch(CONFIG.base + path, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { _raw: text };
  }
  if (VERBOSE) console.log(`  ${path} -> ${res.status}: ${text.slice(0, 400)}`);
  if (!res.ok) throw new Error(`gommo ${res.status} ${path}: ${text.slice(0, 300)}`);
  return json;
}

// Create Audio (TTS) — trả về audioInfo { status, duration, file_url }.
async function createAudio(text, voiceId) {
  const params = {
    access_token: CONFIG.token,
    domain: CONFIG.domain,
    action_type: "create",
    model: CONFIG.model,
    text,
    project_id: CONFIG.projectId,
  };
  if (voiceId) params.voice_id = voiceId;
  const json = await apiPost("/ai/audio", params);

  // Lỗi: { error: true|1, message: "..." }
  if (json.error) {
    const detail = json.data ? ` ${JSON.stringify(json.data).slice(0, 200)}` : "";
    throw new Error(`gommo create audio loi: ${json.message || "unknown"}.${detail}`);
  }
  const info = json.audioInfo || json;
  const url = info.file_url || deepFindAudioUrl(json);
  if (!url) {
    throw new Error(
      `Khong tim thay file_url trong response. Chay --verbose de xem. ${JSON.stringify(json).slice(0, 250)}`
    );
  }
  return { url, duration: Number(info.duration) || 0 };
}

// --- chạy ---
const dataPath = resolve(ROOT, dataRel);
// Namespace audio theo project (thư mục chứa file --data) để KHÔNG đè file giữa
// các project. projects/<id>/dialogue.json -> public/audio/<id>/... ; data/ giữ phẳng.
const NS = /[\\/]projects[\\/]/i.test(dirname(dataPath)) ? basename(dirname(dataPath)) : "";
const audioRel = (id, ext = "wav") => (NS ? `audio/${NS}/d${id}.${ext}` : `audio/d${id}.${ext}`);
const audioDir = resolve(ROOT, "public", "audio", NS);
mkdirSync(audioDir, { recursive: true });
// Dọn audio cũ CỦA RIÊNG project này (thư mục namespace) cho khớp dialogue hiện tại.
for (const f of readdirSync(audioDir)) {
  if (/^d.*\.(wav|mp3)$/i.test(f)) rmSync(join(audioDir, f), { force: true });
}

const doc = JSON.parse(readFileSync(dataPath, "utf8").replace(/^﻿/, ""));
const turns = doc.turns || [];

for (const turn of turns) {
  const sp = (doc.speakers && doc.speakers[turn.speaker]) || {};
  const voiceId = sp.gommoVoiceId || CONFIG.voices[turn.speaker] || "";
  const text = turn.enTts || turn.en; // enTts (kèm tag cảm xúc) ưu tiên cho v3

  const { url, duration } = await createAudio(text, voiceId);

  const ab = await fetch(url);
  if (!ab.ok) throw new Error(`Tai audio that bai ${ab.status}: ${url}`);
  const buf = Buffer.from(await ab.arrayBuffer());
  const ext = /\.wav(\?|#|$)/i.test(url) ? "wav" : "mp3";
  const rel = audioRel(turn.id, ext);
  writeFileSync(resolve(ROOT, "public", rel), buf);

  turn.audio = rel;
  // duration THẬT từ API; nếu thiếu thì ước lượng từ kích thước mp3 (~128kbps).
  turn.durationInSec = duration > 0 ? round3(duration) : round3((buf.length * 8) / (128 * 1000));
  turn.words = []; // chạy dialogue:align (Whisper) để lấy mốc từng từ
  console.log(`d${turn.id}.${ext}  [${turn.speaker}]  ${turn.durationInSec}s  (model ${CONFIG.model}${voiceId ? ", voice " + voiceId : ""})`);
}

writeFileSync(dataPath, JSON.stringify(doc, null, 2), "utf8");
console.log(`Da cap nhat ${dataRel} (audio tu gommo ${CONFIG.model}).`);
console.log("Tiep theo: chay Whisper de co karaoke ->  npm run dialogue:align -- --data " + dataRel);
