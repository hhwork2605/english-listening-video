/**
 * SỔ NỘI DUNG chống trùng kịch bản — ONLINE, nguồn duy nhất = Google Sheet
 * (qua webhook Apps Script, KHÔNG cần MCP connector). Mỗi video/reel = 1 dòng
 * trên tab Sheet để: (a) bước writer tránh lặp, (b) chấm điểm trùng trước render.
 *
 * BẮT BUỘC có webhook: ledger/webhook.json { url, token } (cài: scripts/ledger-webhook.gs).
 * Không có webhook / mất mạng → lệnh BÁO LỖI, không fallback offline.
 * Cột: date,id,format,level,topic,theme,situation,key_phrase,opening_line,youtube_title,script
 *
 * Dùng:
 *   node scripts/ledger.mjs check  --tab reels
 *   node scripts/ledger.mjs dupe   --tab reels --data projects/<id>/dialogue.json
 *   node scripts/ledger.mjs append --tab reels --data projects/<id>/dialogue.json [--format B] [--theme workplace] [--situation "job interview Q&A"] [--id <id>]
 *   node scripts/ledger.mjs push   --tab reels   # seed 1 lần từ CSV cũ (nếu còn)
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const argv = process.argv.slice(2);
const cmd = argv[0];
const getArg = (n, d = "") => {
  const i = argv.indexOf(n);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};
const tab = getArg("--tab", "reels");
const HEADER = ["date", "id", "format", "level", "topic", "theme", "situation", "key_phrase", "opening_line", "youtube_title", "script"];
const ledgerPath = resolve(ROOT, "ledger", `${tab}.csv`);

// Webhook Google Sheet (BẮT BUỘC) — cấu hình qua ledger/webhook.json {url,token},
// hoặc env LEDGER_WEBHOOK_URL/_TOKEN, hoặc cờ --url/--token.
const webhookCfg = (() => {
  const p = resolve(ROOT, "ledger", "webhook.json");
  if (existsSync(p)) { try { return JSON.parse(readFileSync(p, "utf8")); } catch { return {}; } }
  return {};
})();
const WEBHOOK_URL = getArg("--url") || process.env.LEDGER_WEBHOOK_URL || webhookCfg.url || "";
const WEBHOOK_TOKEN = getArg("--token") || process.env.LEDGER_WEBHOOK_TOKEN || webhookCfg.token || "";

// Gọi HTTP qua PowerShell Invoke-WebRequest (dùng cert hệ điều hành → qua được
// proxy/cert doanh nghiệp; node fetch và curl-Git hay bị chặn TLS ở môi trường này).
const psRun = (psCmd) => {
  try {
    return execFileSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", psCmd], { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 });
  } catch (e) { return String(e.stdout || e.message || ""); }
};
const getJson = (url) => {
  const out = psRun(`try { (Invoke-WebRequest -Uri '${url}' -UseBasicParsing -TimeoutSec 45).Content } catch { $_.Exception.Message }`);
  try { return JSON.parse(out); } catch { return { status: "error", error: (out || "empty").trim().slice(0, 200) }; }
};
const postJson = (url, obj) => {
  const tmp = resolve(ROOT, "ledger", ".post.json");
  mkdirSync(dirname(tmp), { recursive: true });
  writeFileSync(tmp, JSON.stringify(obj), "utf8");
  const out = psRun(`try { $b=[IO.File]::ReadAllBytes('${tmp}'); (Invoke-WebRequest -Uri '${url}' -Method Post -ContentType 'application/json; charset=utf-8' -Body $b -UseBasicParsing -TimeoutSec 45).Content } catch { $_.Exception.Message }`);
  try { return JSON.parse(out); } catch { return { status: "error", error: (out || "empty").trim().slice(0, 200) }; }
};
// Lấy tập id đang có trên Sheet (để chống trùng phía client, chạy được cả khi
// Apps Script chưa redeploy bản idempotent). null = không đọc được Sheet.
const sheetRows = () => {
  if (!WEBHOOK_URL) return null;
  const j = getJson(`${WEBHOOK_URL}?tab=${encodeURIComponent(tab)}&token=${encodeURIComponent(WEBHOOK_TOKEN)}`);
  return j.status === "ok" && Array.isArray(j.rows) ? j.rows : null;
};
const sheetIds = () => {
  const rows = sheetRows();
  return rows ? new Set(rows.map((r) => String(r.id))) : null;
};
// Nguồn DUY NHẤT = Google Sheet (online). Không có webhook / không đọc được
// Sheet → lỗi cứng, không fallback offline.
const requireWebhook = () => {
  if (!WEBHOOK_URL) {
    console.error("LỖI: ledger chạy online-only, cần webhook. Tạo ledger/webhook.json {url,token} — cài đặt: xem đầu file scripts/ledger-webhook.gs.");
    process.exit(1);
  }
};
const loadRows = () => {
  requireWebhook();
  const online = sheetRows();
  if (online === null) {
    console.error("LỖI: không đọc được Google Sheet (mạng/webhook?). Ledger online-only — thử lại khi có mạng.");
    process.exit(1);
  }
  return { rows: online, source: "sheet" };
};

const norm = (s) => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();
const wordsOf = (s) => norm(s).replace(/[^a-z0-9' ]/g, "").split(" ").filter(Boolean);

// ---- CSV tối giản (có xử lý dấu ngoặc kép / xuống dòng) ----
const csvEscape = (v) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};
const parseCsv = (text) => {
  const rows = [];
  let row = [], field = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += c;
    } else {
      if (c === '"') q = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else if (c === "\r") { /* skip */ }
      else field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
};

const readRows = () => {
  if (!existsSync(ledgerPath)) return [];
  const rows = parseCsv(readFileSync(ledgerPath, "utf8").replace(/^﻿/, ""));
  if (!rows.length) return [];
  const head = rows[0];
  return rows.slice(1).filter((r) => r.length && r.some((c) => c !== "")).map((r) => {
    const o = {};
    head.forEach((h, i) => (o[h] = r[i] ?? ""));
    return o;
  });
};

const loadDialogue = () => {
  const dataRel = getArg("--data");
  if (!dataRel) { console.error("LỖI: thiếu --data <path>"); process.exit(1); }
  const p = resolve(ROOT, dataRel);
  const doc = JSON.parse(readFileSync(p, "utf8").replace(/^﻿/, ""));
  const turns = doc.turns || [];
  return {
    doc,
    id: getArg("--id") || basename(dirname(p)),
    turns,
    lines: turns.map((t) => t.en).filter(Boolean),
    sentSet: new Set(turns.map((t) => norm(t.en)).filter(Boolean)),
    opening: norm(turns[0]?.en),
    topic: norm(doc.topic),
  };
};

if (cmd === "check") {
  const { rows, source } = loadRows();
  const uniq = (a) => [...new Set(a.filter(Boolean))];
  const topics = uniq(rows.map((r) => norm(r.topic)));
  const situations = uniq(rows.map((r) => norm(r.situation)));
  const phrases = uniq(rows.map((r) => norm(r.key_phrase)));
  const openings = uniq(rows.map((r) => norm(r.opening_line)));
  const recentLines = uniq(
    rows.slice(-8).flatMap((r) => String(r.script || "").split("|").map(norm))
  ).slice(-60);
  // 3 reel gần nhất dùng format gì (tầng chống-repetitive đọc từ đây, không mở CSV)
  const recentFormats = rows.slice(-3).map((r) => ({ id: r.id, format: r.format, theme: r.theme }));
  console.log(JSON.stringify({ status: rows.length ? "ok" : "empty", source, tab, count: rows.length, recentFormats, avoid: { topics, situations, phrases, openings, recentLines } }, null, 2));
} else if (cmd === "dupe") {
  const d = loadDialogue();
  const { rows, source } = loadRows();
  let worst = { id: "", overlap: 0 };
  let topicClash = false;
  for (const r of rows) {
    if (norm(r.topic) && norm(r.topic) === d.topic) topicClash = true;
    const prev = new Set(String(r.script || "").split("|").map(norm).filter(Boolean));
    if (!prev.size || !d.sentSet.size) continue;
    let inter = 0;
    for (const s of d.sentSet) if (prev.has(s)) inter++;
    const overlap = inter / Math.min(prev.size, d.sentSet.size);
    if (overlap > worst.overlap) worst = { id: r.id, overlap: +overlap.toFixed(2) };
  }
  const openingClash = rows.some((r) => norm(r.opening_line) && norm(r.opening_line) === d.opening);
  const tooSimilar = topicClash || openingClash || worst.overlap >= 0.4;
  console.log(JSON.stringify({ verdict: tooSimilar ? "too-similar" : "ok", source, topicClash, openingClash, maxOverlap: worst.overlap, worstMatchId: worst.id, hint: tooSimilar ? "Đổi chủ đề/tình huống/câu mở đầu rồi viết lại." : "Không trùng đáng kể." }, null, 2));
} else if (cmd === "append") {
  requireWebhook();
  const d = loadDialogue();
  const today = getArg("--date") || new Date().toISOString().slice(0, 10);
  const row = {
    date: today,
    id: d.id,
    format: getArg("--format"),
    level: d.doc.level || "",
    topic: d.doc.topic || "",
    theme: getArg("--theme"),
    situation: getArg("--situation"),
    key_phrase: d.doc.phrase || "",
    opening_line: d.turns[0]?.en || "",
    youtube_title: d.doc.youtubeTitle || "",
    script: d.lines.join(" | "),
  };
  // Ghi thẳng lên Google Sheet (idempotent theo id — Apps Script tự bỏ qua nếu đã có).
  const ids = sheetIds();
  if (ids === null) { console.error("LỖI: không đọc được Google Sheet — append thất bại, chạy lại khi có mạng."); process.exit(1); }
  let status;
  if (ids.has(String(row.id))) status = "exists";
  else {
    const j = postJson(WEBHOOK_URL, { token: WEBHOOK_TOKEN, tab, row });
    if (j.status !== "appended" && j.status !== "exists") { console.error(`LỖI: Sheet trả ${j.status} ${j.error || ""}`.trim()); process.exit(1); }
    status = j.status;
  }
  console.log(JSON.stringify({ status, tab, id: row.id, topic: row.topic, source: "sheet" }, null, 2));
} else if (cmd === "push") {
  // Đẩy MỌI dòng local hiện có lên Google Sheet (đồng bộ ban đầu). KHÔNG tự chống
  // trùng trên Sheet — chỉ chạy một lần khi Sheet đang trống.
  if (!WEBHOOK_URL) { console.error("Cần webhook (ledger/webhook.json hoặc --url/--token)."); process.exit(1); }
  const rows = readRows();
  const ids = sheetIds();
  if (ids === null) { console.error("Không đọc được Sheet (kiểm tra webhook)."); process.exit(1); }
  let ok = 0, skip = 0, fail = 0; const errs = [];
  for (const r of rows) {
    if (ids.has(String(r.id))) { skip++; continue; }        // đã có trên Sheet -> bỏ qua
    const j = postJson(WEBHOOK_URL, { token: WEBHOOK_TOKEN, tab, row: r });
    if (j.status === "appended") { ok++; ids.add(String(r.id)); }
    else if (j.status === "exists") skip++;
    else { fail++; errs.push(j.error || j.status); }
  }
  console.log(JSON.stringify({ status: "pushed", tab, ok, skip, fail, errors: errs.slice(0, 3) }, null, 2));
} else if (cmd === "dedupe") {
  // Xoá dòng trùng id trên Google Sheet (giữ dòng đầu). Cần Apps Script đã redeploy
  // bản có action=dedupe.
  if (!WEBHOOK_URL) { console.error("Cần webhook."); process.exit(1); }
  const j = getJson(`${WEBHOOK_URL}?action=dedupe&tab=${encodeURIComponent(tab)}&token=${encodeURIComponent(WEBHOOK_TOKEN)}`);
  console.log(JSON.stringify(j, null, 2));
} else {
  console.error("Dùng: node scripts/ledger.mjs <check|dupe|append|push|dedupe> --tab reels [--data ...] [--format B] [--theme ...] [--situation ...]");
  process.exit(1);
}
