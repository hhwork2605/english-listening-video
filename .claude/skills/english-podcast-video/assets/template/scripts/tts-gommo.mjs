/**
 * Sinh giọng đọc hội thoại qua API TTS của nền tảng aivideoauto / gommo
 * (base https://v2.api.gommo.net). Cung cấp sẵn nhiều model TTS, gồm eleven_v3,
 * eleven_flash_v2_5, minimax_*, omnivoice_v1, autoai_speech_1 (xem /ai/models?type=tts).
 *
 * Khác ElevenLabs trực tiếp: API này BẤT ĐỒNG BỘ (tạo job -> poll) và (theo
 * khảo sát) KHÔNG trả mốc từng từ. Sau khi sinh audio, chạy bước 4b (Whisper)
 *   npm run dialogue:align -- --data projects/<id>/dialogue.json
 * để có words[] cho karaoke.
 *
 * CẦN auth tài khoản nền tảng:
 *   GOMMO_ACCESS_TOKEN  (bắt buộc)
 *   GOMMO_DOMAIN        (thường bắt buộc — vd "go-mmo"; xem tài khoản của bạn)
 * Đặt trong .env ở gốc (xem .env.example).
 *
 * Giọng: speakers[X].gommoVoiceId trong dialogue.json, hoặc env GOMMO_VOICE_A/B.
 * Liệt kê giọng/model:  curl "https://v2.api.gommo.net/ai/models?type=tts"
 *
 * Cách dùng:
 *   node scripts/tts-gommo.mjs --data projects/<id>/dialogue.json
 *   npm run dialogue:audio:gommo -- --data projects/<id>/dialogue.json
 *   # tuỳ chọn: --model eleven_v3 | minimax_speech_2_8_hd | omnivoice_v1 ...
 *   #           --verbose   (in raw response để dò field nếu cần)
 *
 * LƯU Ý: body tạo job và hình dạng response của từng deployment có thể khác nhau.
 * Script dùng deep-search để bắt job id + URL audio theo nhiều dạng phổ biến;
 * nếu lần đầu chưa ăn, chạy với --verbose rồi chỉnh hằng số CONFIG bên dưới.
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
  base: getArg("--base", process.env.GOMMO_API_BASE || "https://v2.api.gommo.net"),
  model: getArg("--model", process.env.GOMMO_TTS_MODEL || "eleven_v3"),
  format: getArg("--format", process.env.GOMMO_FORMAT || "mp3"),
  token: process.env.GOMMO_ACCESS_TOKEN || "",
  domain: process.env.GOMMO_DOMAIN || "go-mmo",
  voices: {
    A: process.env.GOMMO_VOICE_A || "",
    B: process.env.GOMMO_VOICE_B || "",
  },
  pollMs: Number(process.env.GOMMO_POLL_MS || 3000),
  pollMax: Number(process.env.GOMMO_POLL_MAX || 100), // số lần poll tối đa / lượt
};

if (!CONFIG.token) {
  console.error(
    "Thieu GOMMO_ACCESS_TOKEN. Dat trong .env (GOMMO_ACCESS_TOKEN=...) + GOMMO_DOMAIN.\n" +
      "Xem token trong tai khoan nen tang aivideoauto/gommo."
  );
  process.exit(1);
}

const round3 = (n) => Math.round((Number(n) || 0) * 1000) / 1000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Tìm sâu giá trị đầu tiên khớp predicate (theo key hoặc theo value).
function deepFind(obj, pred, seen = new Set()) {
  if (obj == null || typeof obj !== "object" || seen.has(obj)) return undefined;
  seen.add(obj);
  for (const [k, v] of Object.entries(obj)) {
    const hit = pred(k, v);
    if (hit !== undefined) return hit;
    if (v && typeof v === "object") {
      const r = deepFind(v, pred, seen);
      if (r !== undefined) return r;
    }
  }
  return undefined;
}
const isAudioUrl = (s) =>
  typeof s === "string" && /^https?:\/\/\S+\.(mp3|wav|m4a|ogg|aac)(\?|#|$)/i.test(s);
const findJobId = (o) =>
  deepFind(o, (k, v) =>
    /^(id_base|job_id|jobId|id)$/i.test(k) && (typeof v === "string" || typeof v === "number")
      ? String(v)
      : undefined
  );
const findStatus = (o) =>
  deepFind(o, (k, v) => (/^(status|state)$/i.test(k) && typeof v === "string" ? v.toUpperCase() : undefined));
const findAudioUrl = (o) => deepFind(o, (_k, v) => (isAudioUrl(v) ? v : undefined));

function authHeaders() {
  // Gửi cả Authorization: Bearer lẫn header token tuỳ deployment chấp nhận.
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${CONFIG.token}`,
    "x-access-token": CONFIG.token,
  };
}

async function apiPost(path, body) {
  const res = await fetch(CONFIG.base + path, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
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

async function createTtsJob(text, voiceId) {
  // domain + access_token kèm trong body (API yêu cầu domain; access_token cho chắc).
  const body = {
    text,
    domain: CONFIG.domain,
    access_token: CONFIG.token,
    format: CONFIG.format,
  };
  if (voiceId) body.voice_id = voiceId;
  return apiPost(`/ai/jobs/tts/${CONFIG.model}`, body);
}

async function pollJob(id) {
  for (let i = 0; i < CONFIG.pollMax; i++) {
    const j = await apiPost(`/ai/jobs/${id}?media=tts`, {
      domain: CONFIG.domain,
      access_token: CONFIG.token,
    });
    const status = findStatus(j) || "";
    const url = findAudioUrl(j);
    if (url) return url;
    if (/(FAIL|ERROR|CANCEL)/.test(status)) throw new Error(`Job ${id} ${status}: ${JSON.stringify(j).slice(0, 200)}`);
    await sleep(CONFIG.pollMs);
  }
  throw new Error(`Job ${id}: het thoi gian poll (${CONFIG.pollMax} lan) ma chua co audio url.`);
}

function estimateMp3Duration(buf) {
  // mp3 CBR ~128kbps mặc định; ước lượng đủ dùng (chạy align để chính xác).
  return round3((buf.length * 8) / (128 * 1000));
}

// --- chạy ---
const dataPath = resolve(ROOT, dataRel);
const audioDir = resolve(ROOT, "public", "audio");
mkdirSync(audioDir, { recursive: true });
for (const f of readdirSync(audioDir)) {
  if (/^d.*\.(wav|mp3)$/i.test(f)) rmSync(join(audioDir, f), { force: true });
}

const doc = JSON.parse(readFileSync(dataPath, "utf8").replace(/^﻿/, ""));
const turns = doc.turns || [];

for (const turn of turns) {
  const sp = (doc.speakers && doc.speakers[turn.speaker]) || {};
  const voiceId = sp.gommoVoiceId || CONFIG.voices[turn.speaker] || "";
  const text = turn.enTts || turn.en; // enTts (kèm tag cảm xúc) ưu tiên cho v3

  const created = await createTtsJob(text, voiceId);
  let url = findAudioUrl(created);
  if (!url) {
    const id = findJobId(created);
    if (!id) throw new Error(`Khong tim thay job id trong response tao job. Chay --verbose de xem. ${JSON.stringify(created).slice(0, 200)}`);
    url = await pollJob(id);
  }

  const ab = await fetch(url);
  if (!ab.ok) throw new Error(`Tai audio that bai ${ab.status}: ${url}`);
  const buf = Buffer.from(await ab.arrayBuffer());
  const ext = /\.wav(\?|#|$)/i.test(url) ? "wav" : "mp3";
  const rel = `audio/d${turn.id}.${ext}`;
  writeFileSync(resolve(ROOT, "public", rel), buf);

  turn.audio = rel;
  turn.durationInSec = estimateMp3Duration(buf);
  turn.words = []; // chạy dialogue:align (Whisper) để lấy mốc từng từ
  console.log(`d${turn.id}.${ext}  [${turn.speaker}]  ~${turn.durationInSec}s  (model ${CONFIG.model}${voiceId ? ", voice " + voiceId : ""})`);
}

writeFileSync(dataPath, JSON.stringify(doc, null, 2), "utf8");
console.log(`Da cap nhat ${dataRel} (audio tu gommo ${CONFIG.model}).`);
console.log("Tiep theo: chay Whisper de co karaoke ->  npm run dialogue:align -- --data " + dataRel);
