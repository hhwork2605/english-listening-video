/**
 * Chỉnh TỐC ĐỘ giọng đọc theo CẤP ĐỘ CEFR (sau TTS + align, trước render).
 * Dùng ffmpeg atempo (giữ nguyên cao độ) trên từng file audio của dialogue,
 * rồi scale lại durationInSec + words[] tương ứng — KHÔNG cần align lại.
 * Hoạt động với MỌI adapter TTS (SAPI/ElevenLabs/Gemini/AI Studio/aiva).
 *
 * Tốc độ theo level (mặc định, tự lấy doc.level nếu không truyền --tempo):
 *   A1: 0.80   A2: 0.85   B1: 0.90   B1-B2: 0.95   B2/B2-C1/C1: 1.00 (bỏ qua)
 *
 * Dùng:
 *   node scripts/adjust-speed.mjs --data projects/<id>/dialogue.json            # tempo theo doc.level
 *   node scripts/adjust-speed.mjs --data projects/<id>/dialogue.json --tempo 0.9
 * Idempotent: đã áp tempo rồi (doc.speedTempo) thì từ chối chạy lại để không
 * chậm chồng chậm (muốn đổi: sinh lại TTS hoặc tự tính tempo tương đối).
 */
import { readFileSync, writeFileSync, existsSync, renameSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const argv = process.argv.slice(2);
const getArg = (n, d) => {
  const i = argv.indexOf(n);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};
const dataRel = getArg("--data", "");
if (!dataRel) {
  console.error("LỖI: thiếu --data <path> (vd --data projects/<id>/dialogue.json)");
  process.exit(1);
}
const dataPath = resolve(ROOT, dataRel);
const doc = JSON.parse(readFileSync(dataPath, "utf8").replace(/^﻿/, ""));

const LEVEL_TEMPO = { A1: 0.8, A2: 0.85, B1: 0.9, "B1-B2": 0.95, B2: 1, "B2-C1": 1, C1: 1 };
const tempo = Number(getArg("--tempo", "")) || LEVEL_TEMPO[(doc.level || "").toUpperCase().replace(/\s/g, "")] || 1;

console.log(`Nguồn: ${dataRel} — level ${doc.level || "?"} -> tempo ${tempo}`);
if (doc.speedTempo) {
  console.error(`Đã áp tempo ${doc.speedTempo} trước đó — không chạy chồng. Muốn đổi hãy sinh lại TTS.`);
  process.exit(1);
}
if (Math.abs(tempo - 1) < 0.01) {
  console.log("tempo = 1.0 -> không cần chỉnh, bỏ qua.");
  process.exit(0);
}

const round3 = (n) => Math.round(n * 1000) / 1000;
let done = 0;
for (const t of doc.turns || []) {
  if (!t.audio || !t.durationInSec) continue;
  const f = resolve(ROOT, "public", t.audio);
  if (!existsSync(f)) {
    console.log(`  bỏ qua (thiếu file): ${t.audio}`);
    continue;
  }
  const tmp = f.replace(/(\.[a-z0-9]+)$/i, ".tempo$1");
  execFileSync("ffmpeg", ["-y", "-v", "error", "-i", f, "-filter:a", `atempo=${tempo}`, tmp]);
  renameSync(tmp, f);
  t.durationInSec = round3(t.durationInSec / tempo);
  if (Array.isArray(t.words)) {
    for (const w of t.words) {
      w.startSec = round3(w.startSec / tempo);
      w.endSec = round3(w.endSec / tempo);
    }
  }
  done++;
}
doc.speedTempo = tempo;
writeFileSync(dataPath, JSON.stringify(doc, null, 2));
// tự đè buffer render như các script TTS
const BUFFER = resolve(ROOT, "data/dialogue.json");
if (dataPath !== BUFFER) {
  try {
    writeFileSync(BUFFER, JSON.stringify(doc, null, 2));
  } catch {}
}
const total = (doc.turns || []).reduce((s, t) => s + (t.durationInSec || 0) + (t.pauseAfterSec || 0), 0);
console.log(`Đã chỉnh ${done} file về tempo ${tempo}. Tổng thời lượng mới ~${Math.floor(total / 60)}ph ${Math.round(total % 60)}s.`);
