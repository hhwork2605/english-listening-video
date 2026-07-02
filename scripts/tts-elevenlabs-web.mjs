/**
 * Sinh giọng đọc hội thoại bằng cách LÁI WEB ElevenLabs (Text to Speech, Eleven v3)
 * qua Playwright — KHÔNG dùng API key, dùng QUOTA CREDIT của tài khoản web.
 *
 * Trang:  https://elevenlabs.io/app/speech-synthesis/text-to-speech
 * Selector viết theo GUIDE đã xác minh trên UI thật (data-testid ổn định):
 *   - editor:        [data-testid="tts-editor"]        (DIV contenteditable — KHÔNG phải textarea!)
 *   - chọn giọng:    [data-testid="tts-voice-selector"] -> search "Start typing to search..." -> click hàng
 *   - chọn model:    [data-testid="tts-model-selector"] -> radio "Eleven v3"
 *   - generate:      [data-testid="tts-generate"]       (hoặc Ctrl+Enter)
 *   - player kết quả:[data-testid="audio-player"]
 *
 * Cách bắt audio: khi bấm Generate, web gọi endpoint text-to-speech trả về
 * hoặc (a) binary audio/mpeg (MP3), hoặc (b) JSON/NDJSON chứa audio_base64 +
 * alignment (mốc từng KÝ TỰ). Script NGHE response mạng, tự ghép MP3; nếu có
 * alignment thì dựng luôn words[] (karaoke) — KHÔNG cần Whisper, KHÔNG phụ
 * thuộc nút Download.
 *
 * ĐĂNG NHẬP — 2 chế độ:
 *  (A) CDP (KHUYẾN NGHỊ):
 *        1) Mở Chrome giữ profile riêng (đóng Chrome cùng profile trước nếu đang mở).
 *           Các cờ chống-ngủ-đông cho phép Chrome chạy MINIMIZED (không cần active):
 *           & "C:\Program Files\Google\Chrome\Application\chrome.exe" `
 *             --remote-debugging-port=9223 --user-data-dir="$env:USERPROFILE\eleven-chrome" `
 *             --disable-backgrounding-occluded-windows --disable-renderer-backgrounding `
 *             --disable-background-timer-throttling --disable-features=CalculateNativeWinOcclusion
 *        2) Trong Chrome đó: đăng nhập elevenlabs.io MỘT lần (profile nhớ mãi).
 *        3) Chạy script kèm:  --cdp 9223   (hoặc env ELEVEN_CDP=9223)
 *  (B) Persistent profile (.pw-profile-eleven/): chạy không cần Chrome ngoài,
 *      đăng nhập ngay trong cửa sổ Playwright lần đầu.
 *  LƯU Ý: đừng thao tác TRONG cửa sổ Chrome automation lúc script chạy (script tự
 *  đảo tab); thu nhỏ cửa sổ hoặc làm việc ở app khác thì thoải mái (nhờ cờ trên).
 *  Download của web được chuyển hướng vào thư mục tạm (%TEMP%\eleven-web-dl) và
 *  xoá sau khi đọc — KHÔNG rơi vào thư mục Downloads.
 *
 * GIỌNG (MỖI SPEAKER 1 TAB): mỗi speaker 1 tab, chọn giọng MỘT LẦN cho tab đó;
 *   mỗi lượt chỉ đổi text + Generate. Tên giọng = TÊN HIỂN THỊ trên web:
 *   env ELEVEN_WEB_VOICE_A/_B > speakers[X].elevenWebVoice > mặc định.
 *   Giọng premium sẽ hiện modal "Upgrade to access this voice" -> script đóng
 *   modal, cảnh báo và GIỮ giọng hiện tại (hãy đổi giọng khác trong .env).
 *
 * MODEL: tự chọn theo ELEVEN_WEB_MODEL (mặc định "Eleven v3"). Popup
 *   "What's new in Eleven v3" (nút Get started) được tự đóng.
 * THÔNG SỐ v3 (tuỳ chọn, chỉ set khi env có giá trị):
 *   ELEVEN_WEB_STABILITY=Creative|Natural|Robust  (slider Stability)
 *   ELEVEN_WEB_FORMAT="MP3 44.1 kHz (192kbps)"    (dropdown Output format, đúng tên option)
 *
 * TEXT: dùng turn.enTts (có audio tag [laughs] [whispers]... — v3 hỗ trợ) nếu có,
 *   ngược lại turn.en. Giữ turn.en SẠCH cho .srt.
 *
 * Cách dùng:
 *   node scripts/tts-elevenlabs-web.mjs --data projects/<id>/dialogue.json --cdp 9223
 *   npm run dialogue:audio:eleven:web -- --data projects/<id>/dialogue.json --cdp 9223
 *   # tuỳ chọn:
 *   #   --limit N          chỉ làm N lượt đầu để test
 *   #   --fresh            xoá audio cũ + làm lại từ đầu
 *   #   --headless         chạy ẩn (chế độ B, SAU khi đã đăng nhập ổn định)
 *   #   --manual-voice     dừng cho bạn tự chọn giọng/model trên từng tab rồi Enter
 *   #   --pace <ms>        nghỉ giữa các lượt (mặc định 2500)
 *   #   --retry-wait <ms>  nghỉ khi lượt lỗi trước khi thử lại (mặc định 15000)
 *   #   --max-attempts <n> số lần thử mỗi lượt (mặc định 4)
 *   #   --profile <dir>    thư mục profile (chế độ B, mặc định .pw-profile-eleven)
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
import { tmpdir } from "node:os";
import { chromium } from "playwright";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// --- nạp .env TRƯỚC khi đọc tham số (các default bên dưới lấy từ env!) ---
const envPath = resolve(ROOT, ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
    // cắt comment inline ("VAL   # ghi chú") để không dính vào giá trị
    if (m && process.env[m[1]] === undefined)
      process.env[m[1]] = m[2].replace(/\s+#.*$/, "").replace(/^["']|["']$/g, "");
  }
}

// --- tham số dòng lệnh ---
const argv = process.argv.slice(2);
const has = (n) => argv.includes(n);
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
const CDP = getArg("--cdp", process.env.ELEVEN_CDP || ""); // port hoặc URL ws/http
const LIMIT = Number(getArg("--limit", "0")) || 0;
const FRESH = has("--fresh");
const HEADLESS = has("--headless");
const VERBOSE = has("--verbose");
const MANUAL_VOICE = has("--manual-voice");
const PACE_MS = Number(getArg("--pace", process.env.ELEVEN_PACE_MS || "2500")) || 2500;
const RETRY_WAIT_MS = Number(getArg("--retry-wait", process.env.ELEVEN_RETRY_WAIT_MS || "15000")) || 15000;
const MAX_ATTEMPTS = Number(getArg("--max-attempts", process.env.ELEVEN_MAX_ATTEMPTS || "4")) || 4;
// v3 với lượt dài có thể sinh chậm -> chờ rộng tay (bắt được response là thoát sớm).
const AUDIO_WAIT_MS = Number(process.env.ELEVEN_AUDIO_WAIT_MS || "90000") || 90000;

const CONFIG = {
  profileDir: resolve(ROOT, getArg("--profile", process.env.ELEVEN_PROFILE || ".pw-profile-eleven")),
  voices: {
    A: process.env.ELEVEN_WEB_VOICE_A || "Rachel",
    B: process.env.ELEVEN_WEB_VOICE_B || "Adam",
  },
  // Tên model như hiển thị trên web; rỗng = không tự chọn, giữ model đang chọn.
  model: process.env.ELEVEN_WEB_MODEL !== undefined ? process.env.ELEVEN_WEB_MODEL : "Eleven v3",
  stability: process.env.ELEVEN_WEB_STABILITY || "", // Creative | Natural | Robust ("" = giữ nguyên)
  format: process.env.ELEVEN_WEB_FORMAT || "", // vd "MP3 44.1 kHz (192kbps)" ("" = giữ nguyên)
};
const pageUrl = "https://elevenlabs.io/app/speech-synthesis/text-to-speech";

const round3 = (n) => Math.round((Number(n) || 0) * 1000) / 1000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stripTags = (s) => s.replace(/\[[^\]]*\]/g, "").trim();
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// ============ MP3: đo duration chính xác bằng cách đếm frame MPEG ============
// (CBR/VBR đều đúng vì cộng dồn từng frame; bỏ qua tag ID3v2 ở đầu.)
const MP3_BITRATES = {
  // [MPEG1-L3, MPEG2/2.5-L3] theo bitrate index 1..14 (kbps)
  1: [32, 8], 2: [40, 16], 3: [48, 24], 4: [56, 32], 5: [64, 40], 6: [80, 48],
  7: [96, 56], 8: [112, 64], 9: [128, 80], 10: [160, 96], 11: [192, 112],
  12: [224, 128], 13: [256, 144], 14: [320, 160],
};
const MP3_RATES = { 0: [44100, 22050, 11025], 1: [48000, 24000, 12000], 2: [32000, 16000, 8000] };
function mp3DurationSec(buf) {
  let i = 0;
  // bỏ ID3v2
  if (buf.length > 10 && buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) {
    const size = ((buf[6] & 0x7f) << 21) | ((buf[7] & 0x7f) << 14) | ((buf[8] & 0x7f) << 7) | (buf[9] & 0x7f);
    i = 10 + size;
  }
  let dur = 0;
  while (i + 4 <= buf.length) {
    if (buf[i] !== 0xff || (buf[i + 1] & 0xe0) !== 0xe0) { i++; continue; }
    const verBits = (buf[i + 1] >> 3) & 3; // 3=MPEG1, 2=MPEG2, 0=MPEG2.5
    const layerBits = (buf[i + 1] >> 1) & 3; // 1=Layer3
    const brIdx = (buf[i + 2] >> 4) & 15;
    const srIdx = (buf[i + 2] >> 2) & 3;
    const padding = (buf[i + 2] >> 1) & 1;
    if (verBits === 1 || layerBits !== 1 || !MP3_BITRATES[brIdx] || srIdx === 3) { i++; continue; }
    const mpeg1 = verBits === 3;
    const bitrate = MP3_BITRATES[brIdx][mpeg1 ? 0 : 1] * 1000;
    const srBase = MP3_RATES[srIdx][mpeg1 ? 0 : verBits === 2 ? 1 : 2];
    const samples = mpeg1 ? 1152 : 576;
    const frameLen = Math.floor(((mpeg1 ? 144 : 72) * bitrate) / srBase) + padding;
    if (frameLen <= 0) { i++; continue; }
    dur += samples / srBase;
    i += frameLen;
  }
  return round3(dur);
}

// Gom mốc ký tự thành mốc từng TỪ; LỌC BỎ token là audio tag (vd "[laughs]").
// (copy từ scripts/tts-elevenlabs.mjs)
function buildWords(chars, st, en) {
  const raw = [];
  let cur = null;
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    if (/\s/.test(c)) {
      if (cur) { raw.push(cur); cur = null; }
      continue;
    }
    if (!cur) cur = { text: c, startSec: round3(st[i]), endSec: round3(en[i]) };
    else { cur.text += c; cur.endSec = round3(en[i]); }
  }
  if (cur) raw.push(cur);
  const words = [];
  for (const w of raw) {
    const text = stripTags(w.text);
    if (!text) continue;
    words.push({ text, startSec: w.startSec, endSec: w.endSec });
  }
  return words;
}

// Bóc audio từ body JSON/NDJSON kiểu with-timestamps của ElevenLabs:
// mỗi dòng (hoặc cả body) là { audio_base64, alignment | normalized_alignment }.
function extractAudioFromJsonBody(text) {
  if (!text.includes("audio_base64")) return null;
  const chunks = [];
  const chars = [], st = [], en = [];
  const push = (o) => {
    if (!o || typeof o !== "object") return;
    if (typeof o.audio_base64 === "string" && o.audio_base64) chunks.push(o.audio_base64);
    const al = o.normalized_alignment || o.alignment;
    if (al && Array.isArray(al.characters)) {
      chars.push(...al.characters);
      st.push(...(al.character_start_times_seconds || []));
      en.push(...(al.character_end_times_seconds || []));
    }
  };
  let parsed = false;
  try { push(JSON.parse(text)); parsed = true; } catch { /* NDJSON */ }
  if (!parsed) {
    for (const line of text.split(/\r?\n/)) {
      const s = line.trim();
      if (!s) continue;
      try { push(JSON.parse(s)); } catch { /* dòng dở dang -> bỏ */ }
    }
  }
  if (!chunks.length) return null;
  const buf = Buffer.concat(chunks.map((b) => Buffer.from(b, "base64")));
  const words = chars.length ? buildWords(chars, st, en) : [];
  const durationSec = en.length ? round3(en[en.length - 1]) : 0;
  return { buf, words, durationSec };
}

// --- chuẩn bị file/thư mục (namespace theo project, giống các script khác) ---
const dataPath = resolve(ROOT, dataRel);
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
const BUFFER_PATH = resolve(ROOT, "data/dialogue.json"); // buffer render của Remotion
function saveDoc(d) {
  const body = JSON.stringify(d, null, 2);
  writeFileSync(dataPath, body, "utf8");
  // tự đè buffer: data/ luôn là project đang làm, không cần chờ project:use
  if (dataPath !== BUFFER_PATH) { try { writeFileSync(BUFFER_PATH, body, "utf8"); } catch {} }
}
let turns = doc.turns || [];
if (LIMIT) turns = turns.slice(0, LIMIT);

// =================== Playwright ===================
// Selector theo GUIDE đã xác minh (data-testid ổn định) + override qua env.
const SEL = {
  // editor: DIV contenteditable với v3 (textarea với v2) -> testid bắt cả hai
  textbox:
    process.env.ELEVEN_SEL_TEXTBOX ||
    '[data-testid="tts-editor"], div[contenteditable="true"], textarea[aria-label="Main textarea"]',
  generateBtn:
    process.env.ELEVEN_SEL_GENERATE ||
    '[data-testid="tts-generate"], button:has-text("Generate speech")',
  voiceBtn: process.env.ELEVEN_SEL_VOICE_BTN || '[data-testid="tts-voice-selector"]',
  voiceSearch:
    process.env.ELEVEN_SEL_VOICE_SEARCH ||
    'input[placeholder*="Start typing to search" i], input[placeholder*="search" i], input[type="search"]',
  // hàng giọng trong danh sách kết quả (click cả hàng để chọn)
  voiceRow: process.env.ELEVEN_SEL_VOICE_ROW || "li.eleven-list-item",
  modelBtn: process.env.ELEVEN_SEL_MODEL_BTN || '[data-testid="tts-model-selector"]',
  modelItem: process.env.ELEVEN_SEL_MODEL_ITEM || 'button[role="radio"], [role="radio"]',
  audioPlayer: '[data-testid="audio-player"]',
};

async function firstVisible(page, selector) {
  const loc = page.locator(selector);
  const n = await loc.count().catch(() => 0);
  for (let i = 0; i < n; i++) {
    const item = loc.nth(i);
    if (await item.isVisible().catch(() => false)) return item;
  }
  return null;
}

// Chờ selector hiện ra (app render xong mới có các nút quanh editor).
async function waitVisible(page, selector, timeoutMs = 15000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const item = await firstVisible(page, selector);
    if (item) return item;
    await sleep(400);
  }
  return null;
}

// Đóng popup/banner đè lên UI (theo guide: banner "Introducing...", popup
// "What's new in Eleven v3" (Get started), cookie consent...).
async function dismissPopups(page) {
  const sels = [
    'button[aria-label="Close popup"]',
    'button[aria-label="Dismiss"]',
    "#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll",
    "#CybotCookiebotDialogBodyButtonDecline",
    'button:has-text("Accept all")',
    'button:has-text("Got it")',
    'button:has-text("Maybe later")',
    'button:has-text("Get started")', // popup "What's new in Eleven v3"
  ];
  for (const s of sels) {
    const btns = page.locator(s);
    const n = await btns.count().catch(() => 0);
    for (let i = 0; i < n; i++) {
      const b = btns.nth(i);
      if (await b.isVisible().catch(() => false)) {
        await b.click({ timeout: 2000 }).catch(() => {});
        if (VERBOSE) console.log(`  · đóng popup (${s})`);
        await sleep(300);
      }
    }
  }
}

// Modal "Upgrade to access this voice" (giọng premium) -> đóng + báo cho caller.
async function closeUpgradeModalIfAny(page) {
  const modal = page.getByText("Upgrade to access this voice").first();
  if (!(await modal.isVisible().catch(() => false))) return false;
  const close = page.locator('button[aria-label="Close"], button:has-text("Close")').first();
  if (await close.count().catch(() => 0)) await close.click({ timeout: 3000 }).catch(() => {});
  else await page.keyboard.press("Escape").catch(() => {});
  await sleep(400);
  return true;
}

// Điền lời thoại. Editor v3 là CONTENTEDITABLE -> không fill() được như textarea:
// click -> Ctrl+A -> Delete -> insertText (1 phát, nhanh); kiểm chứng lại nội dung,
// sai thì fallback gõ từng phím.
async function typeText(page, text) {
  const box = await waitVisible(page, SEL.textbox, 20000);
  if (!box) throw new Error(`không tìm thấy ô nhập text (url=${page.url()}) (override ELEVEN_SEL_TEXTBOX)`);
  // (v3 tô màu tag nên so sánh bản đã bỏ tag, gộp khoảng trắng)
  const norm = (s) => stripTags(s || "").replace(/\s+/g, " ").trim();
  const readBack = async () =>
    norm(await box.innerText().catch(() => "")) || norm(await box.inputValue().catch(() => ""));
  // XOÁ PHẢI XÁC NHẬN TRỐNG: Ctrl+A+Delete có thể trượt trên contenteditable v3
  // (chưa focus / React chưa flush) -> text mới NỐI vào text cũ -> TTS đọc đôi.
  const clearBox = async () => {
    for (let i = 0; i < 4; i++) {
      await box.click({ timeout: 5000 }).catch(() => {});
      await page.keyboard.press("Control+A").catch(() => {});
      await page.keyboard.press("Delete").catch(() => {});
      await sleep(80);
      if (!(await readBack())) return true;
      // hard-clear qua DOM cho editor cứng đầu
      await box
        .evaluate((el) => {
          el.focus();
          const sel = window.getSelection();
          sel.removeAllRanges();
          const r = document.createRange();
          r.selectNodeContents(el);
          sel.addRange(r);
          document.execCommand("delete");
        })
        .catch(() => {});
      await sleep(80);
      if (!(await readBack())) return true;
    }
    return !(await readBack());
  };
  const verify = async () => {
    for (let i = 0; i < 5; i++) {
      await sleep(150);
      if ((await readBack()) === norm(text)) return true;
    }
    return false;
  };

  if (!(await clearBox())) throw new Error("không xoá được nội dung cũ trong editor");
  await page.keyboard.insertText(text).catch(() => {});
  if (!(await verify())) {
    if (VERBOSE) console.log("  · insertText chưa khớp -> xoá lại + gõ từng phím...");
    if (!(await clearBox())) throw new Error("không xoá được nội dung cũ trong editor (fallback)");
    await box.pressSequentially(text, { delay: 0 }).catch(() => {});
    // RE-VERIFY sau fallback — trước đây THIẾU bước này nên "câu ×2" trong editor lọt qua
    if (!(await verify())) {
      throw new Error(`editor không khớp text (đang chứa: "${(await readBack()).slice(0, 80)}...")`);
    }
  }
  await sleep(80);
  return box;
}

async function clickGenerate(page) {
  const btn = await waitVisible(page, SEL.generateBtn, 8000);
  if (btn) {
    if (VERBOSE) console.log("  · bấm Generate...");
    await btn.click({ timeout: 5000 }).catch(() => {});
  } else {
    if (VERBOSE) console.log("  · không thấy nút Generate -> Ctrl+Enter...");
    const box = await firstVisible(page, SEL.textbox);
    await box?.focus().catch(() => {});
    await page.keyboard.press("Control+Enter").catch(() => {});
  }
}

// Chọn giọng cho 1 tab: nút giọng đã hiện đúng tên -> khỏi làm gì. Ngược lại mở
// panel -> gõ tên vào ô search -> click HÀNG khớp tên (tab "My Voices" trống thì
// tự chuyển tab "Explore"). Giọng premium (modal Upgrade) -> đóng modal + giữ giọng cũ.
async function setupTabVoice(page, voice) {
  const trig = await waitVisible(page, SEL.voiceBtn, 20000);
  if (!trig) {
    console.log(`  ! Không tìm thấy nút chọn giọng (url=${page.url()}) (override ELEVEN_SEL_VOICE_BTN) — giữ giọng đang chọn sẵn trên tab.`);
    return false;
  }
  const current = ((await trig.innerText().catch(() => "")) || "").trim();
  if (current && current.toLowerCase() === voice.toLowerCase()) {
    if (VERBOSE) console.log(`  · giọng đã đúng sẵn: ${current}`);
    return true;
  }
  await trig.click({ timeout: 5000 }).catch(() => {});
  const search = await waitVisible(page, SEL.voiceSearch, 8000);
  if (!search) {
    console.log("  ! Không thấy ô search giọng — giữ giọng đang chọn.");
    await page.keyboard.press("Escape").catch(() => {});
    return false;
  }
  const rows = page.locator(SEL.voiceRow);
  const searchRows = async (q) => {
    await search.fill(q).catch(() => {});
    await sleep(2500); // đợi kết quả search (danh sách load từ mạng)
    return (await rows.count().catch(() => 0)) > 0;
  };
  // Tab mặc định là "My Voices" — thường TRỐNG -> chuyển tab "Explore" (thư viện).
  let anyRows = await searchRows(voice);
  if (!anyRows) {
    const exploreTab = page.locator('button[data-testid="tabbed-voice-selector-explore-tab"]').first();
    if (await exploreTab.count().catch(() => 0)) {
      await exploreTab.click({ timeout: 4000 }).catch(() => {});
      await sleep(500);
      anyRows = await searchRows(voice);
    }
  }
  let item = rows.filter({ hasText: new RegExp(escRe(voice), "i") }).first();
  let matched = "exact";
  if (!(await item.count().catch(() => 0))) {
    // thử lại với phần tên trước dấu "-" (vd "Victoria - Warm, ..." -> "Victoria")
    const head = voice.split(/\s*-\s*/)[0];
    await searchRows(head);
    item = rows.filter({ hasText: new RegExp(escRe(voice), "i") }).first();
    if (!(await item.count().catch(() => 0))) {
      item = rows.first();
      matched = "first-result";
    }
  }
  let ok = false;
  if (await item.count().catch(() => 0)) {
    const label = ((await item.innerText().catch(() => "")) || "").split("\n")[0].trim();
    await item.click({ timeout: 5000 }).catch(() => {});
    await sleep(600);
    if (await closeUpgradeModalIfAny(page)) {
      console.log(`  ! Giọng "${label}" cần tài khoản trả phí (modal Upgrade) — GIỮ giọng hiện tại. Đổi ELEVEN_WEB_VOICE_* sang giọng khác.`);
    } else {
      ok = true;
      if (matched === "first-result")
        console.log(`  ! Không thấy đúng giọng "${voice}" — chọn tạm kết quả đầu: "${label}".`);
      else if (VERBOSE) console.log(`  · chọn giọng: ${label}`);
    }
  } else {
    console.log(`  ! Search "${voice}" không ra kết quả nào — giữ giọng đang chọn.`);
  }
  // nếu panel còn mở thì đóng
  if (await firstVisible(page, SEL.voiceSearch)) await page.keyboard.press("Escape").catch(() => {});
  await sleep(300);
  return ok;
}

// Chọn model (vd "Eleven v3"): nút model đã đúng tên -> khỏi làm gì; ngược lại
// mở dropdown -> click radio khớp tên (radio[0]=v3, [1]=Multilingual v2, [2]=Flash).
async function setupTabModel(page, model) {
  if (!model) return false;
  const re = new RegExp(escRe(model), "i");
  const trig = await waitVisible(page, SEL.modelBtn, 15000);
  if (!trig) {
    console.log(`  ! Không tìm thấy nút model (url=${page.url()}) (override ELEVEN_SEL_MODEL_BTN) — giữ model đang chọn.`);
    return false;
  }
  const current = ((await trig.innerText().catch(() => "")) || "").trim();
  if (re.test(current)) {
    if (VERBOSE) console.log(`  · model đã đúng sẵn: ${current}`);
    return true;
  }
  await trig.click({ timeout: 5000 }).catch(() => {});
  await sleep(800);
  const items = page.locator(SEL.modelItem).filter({ hasText: re });
  let ok = false;
  const n = await items.count().catch(() => 0);
  for (let i = 0; i < n; i++) {
    const item = items.nth(i);
    if (!(await item.isVisible().catch(() => false))) continue;
    const txt = ((await item.innerText().catch(() => "")) || "").trim();
    // tên model phải ở ĐẦU nội dung radio (vd "Eleven v3 The most expressive...")
    if (!re.test(txt.split("\n")[0]) && !txt.toLowerCase().startsWith(model.toLowerCase())) continue;
    await item.click({ timeout: 4000 }).catch(() => {});
    ok = true;
    break;
  }
  await sleep(500);
  if (await firstVisible(page, SEL.modelItem)) await page.keyboard.press("Escape").catch(() => {});
  // popup "What's new in Eleven v3" bật ngay sau khi đổi model -> đóng
  await dismissPopups(page);
  if (ok) { if (VERBOSE) console.log(`  · chọn model: ${model}`); }
  else console.log(`  ! Không tự chọn được model "${model}" — giữ model đang chọn trên web (chọn tay nếu cần).`);
  return ok;
}

// Thông số v3 (tuỳ chọn): Stability (slider: Creative=0 / Natural=0.5 / Robust=1,
// điều khiển bằng phím Home/End/ArrowRight) + Output format (combobox).
async function setupTabSettings(page) {
  if (CONFIG.stability) {
    const slider = page.getByRole("slider", { name: "Stability" }).first();
    if (await slider.count().catch(() => 0)) {
      await slider.focus().catch(() => {});
      await slider.press("Home").catch(() => {}); // về 0 = Creative
      const want = CONFIG.stability.toLowerCase();
      if (want === "robust") await slider.press("End").catch(() => {});
      else if (want === "natural") {
        for (let i = 0; i < 10; i++) await slider.press("ArrowRight").catch(() => {}); // ~0.5
      }
      if (VERBOSE) console.log(`  · Stability = ${CONFIG.stability}`);
    } else if (VERBOSE) console.log("  · không thấy slider Stability (bỏ qua)");
  }
  if (CONFIG.format) {
    const combo = page.getByRole("combobox", { name: "Output format" }).first();
    if (await combo.count().catch(() => 0)) {
      await combo.click({ timeout: 4000 }).catch(() => {});
      const opt = page.getByRole("option", { name: CONFIG.format }).first();
      if (await opt.count().catch(() => 0)) {
        await opt.click({ timeout: 4000 }).catch(() => {});
        if (VERBOSE) console.log(`  · Output format = ${CONFIG.format}`);
      } else {
        await page.keyboard.press("Escape").catch(() => {});
        console.log(`  ! Không thấy option format "${CONFIG.format}" (bỏ qua).`);
      }
    }
  }
}

// ===== Đường lấy audio 2: đọc thẳng thẻ <audio> của player (guide mục 9) =====
// ElevenLabs KHÔNG expose link file: sau khi gen, audio nằm trong <audio>.src
// dạng `data:audio/...;base64,...` HOẶC `blob:https://elevenlabs.io/...`.
// Cả trang chỉ có MỘT thẻ <audio> dùng chung, và src NHIỀU KHI CHỈ ĐƯỢC GÁN SAU
// KHI BẤM PLAY bản gen đó -> pressLatestPlay() bấm play (đã mute) rồi mới đọc.

async function getAudioSrcKeys(page) {
  return await page
    .evaluate(() => {
      // key nhận diện src (data: URL rất dài -> rút gọn theo độ dài + đuôi)
      const keyOf = (s) => (s && s.startsWith("data:") ? "data:" + s.length + ":" + s.slice(-40) : s || "");
      return [...document.querySelectorAll("audio")]
        .map((a) => keyOf(a.currentSrc || a.src || ""))
        .filter(Boolean);
    })
    .catch(() => []);
}

// Mute mọi audio + bấm Play của player (để web gán src bản gen mới nhất vào <audio>).
async function pressLatestPlay(page) {
  await page
    .evaluate(() => {
      for (const a of document.querySelectorAll("audio")) a.muted = true;
    })
    .catch(() => {});
  // CHỈ nút play của player kết quả — fallback aria-label chung chung từng vớ
  // nhầm nút Play của mục Sound Effects ở sidebar và điều hướng mất trang!
  const btn = page
    .locator('[data-testid="audio-player-play-button"], [data-testid="audio-player"] button[aria-label*="play" i]')
    .first();
  if (await btn.isVisible().catch(() => false)) {
    await btn.click({ timeout: 3000 }).catch(() => {});
    if (VERBOSE) console.log("  · bấm Play (muted) để web gán src audio...");
    return true;
  }
  return false;
}

// Đọc <audio> hiện tại: src MỚI (không thuộc prevKeys) -> trả { buf, durationSec }.
// data: -> cắt base64 sau dấu phẩy; blob: -> fetch + FileReader trong page context.
async function grabPlayerAudio(page, prevKeys) {
  const res = await page
    .evaluate(
      async ({ prev }) => {
        const keyOf = (s) => (s && s.startsWith("data:") ? "data:" + s.length + ":" + s.slice(-40) : s || "");
        const a = document.querySelector("audio");
        if (!a) return null;
        const src = a.currentSrc || a.src || "";
        if (!src) return { empty: true };
        const key = keyOf(src);
        if (prev.includes(key)) return { stale: true };
        let b64 = null;
        if (src.startsWith("data:")) {
          b64 = src.split(",")[1] || null;
        } else if (src.startsWith("blob:")) {
          try {
            const blob = await (await fetch(src)).blob();
            b64 = await new Promise((resolveB64, rejectB64) => {
              const r = new FileReader();
              r.onloadend = () => resolveB64(String(r.result).split(",")[1] || null);
              r.onerror = rejectB64;
              r.readAsDataURL(blob);
            });
          } catch {
            return { blocked: true };
          }
        } else {
          return { blocked: true };
        }
        try { a.pause(); } catch { /* bỏ qua */ }
        return { b64, key, duration: a.duration > 0 && isFinite(a.duration) ? a.duration : 0 };
      },
      { prev: prevKeys }
    )
    .catch(() => null);
  if (!res || !res.b64) return res;
  return { buf: Buffer.from(res.b64, "base64"), words: [], durationSec: round3(res.duration), key: res.key };
}

// ===== Download âm thầm: chuyển hướng download của Chrome vào THƯ MỤC TẠM =====
// (mặc định Chrome lưu vào Downloads của người dùng -> rác). CDP
// Browser.setDownloadBehavior đổi nơi lưu + đặt tên theo GUID; script đọc file
// xong XOÁ luôn — không đụng thư mục Downloads.
const DL = { dir: join(tmpdir(), "eleven-web-dl"), session: null, files: [] };

async function setupDownloadCapture(browser) {
  try {
    mkdirSync(DL.dir, { recursive: true });
    DL.session = await browser.newBrowserCDPSession();
    DL.files = [];
    DL.session.on("Browser.downloadProgress", (e) => {
      if (e.state === "completed") DL.files.push(e.guid);
    });
    await DL.session.send("Browser.setDownloadBehavior", {
      behavior: "allowAndName",
      downloadPath: DL.dir,
      eventsEnabled: true,
    });
    if (VERBOSE) console.log(`  · download chuyển hướng vào ${DL.dir}`);
    return true;
  } catch (e) {
    if (VERBOSE) console.log(`  · không thiết lập được download capture (${e.message}) — dùng fallback.`);
    DL.session = null;
    return false;
  }
}

// Đường lấy audio 3 (chót): bấm nút Download của card Generation mới nhất.
async function downloadAudio(page) {
  const btn = page.getByRole("button", { name: "Download" }).first();
  if (!(await btn.count().catch(() => 0))) return null;
  if (DL.session) {
    const before = DL.files.length;
    await btn.click({ timeout: 5000 }).catch(() => {});
    const t0 = Date.now();
    while (DL.files.length <= before && Date.now() - t0 < 15000) await sleep(300);
    if (DL.files.length > before) {
      const p = join(DL.dir, DL.files[DL.files.length - 1]);
      // file vừa ghi xong có thể còn khoá -> thử đọc vài nhịp
      for (let i = 0; i < 10; i++) {
        try {
          const buf = readFileSync(p);
          rmSync(p, { force: true });
          return { buf, words: [], durationSec: 0 };
        } catch {
          await sleep(200);
        }
      }
    }
    return null;
  }
  // Fallback (chế độ B / không có CDP session): Playwright tự quản lý download.
  try {
    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 15000 }),
      btn.click({ timeout: 5000 }),
    ]);
    const p = await download.path();
    if (!p) return null;
    return { buf: readFileSync(p), words: [], durationSec: 0 };
  } catch {
    return null;
  }
}

// Gắn listener bắt audio cho 1 page -> { lastAudio: { buf, words, durationSec } }.
function attachAudioListener(page) {
  const state = { lastAudio: null };
  page.on("response", async (resp) => {
    try {
      const url = resp.url();
      if (!/elevenlabs\.io/i.test(url)) return;
      if (!/text[-_]to[-_]speech|\/tts\b|speech[-_]synthesis|generate/i.test(url)) return;
      if (resp.status() !== 200) return;
      const ct = (resp.headers()["content-type"] || "").toLowerCase();
      if (ct.startsWith("audio/")) {
        const buf = await resp.body(); // MP3 nguyên con
        if (buf && buf.length > 2000) {
          state.lastAudio = { buf, words: [], durationSec: 0 };
          if (VERBOSE) console.log(`  · bắt audio binary ${buf.length} bytes (${ct})`);
        }
        return;
      }
      if (!/json|stream|text/.test(ct)) return;
      const body = await resp.text();
      const a = extractAudioFromJsonBody(body);
      if (a && a.buf.length > 2000) {
        state.lastAudio = a;
        if (VERBOSE)
          console.log(`  · bắt audio base64 ${a.buf.length} bytes, ${a.words.length} từ có mốc thời gian`);
      }
    } catch {
      /* body stream không đọc được -> bỏ qua, chờ response khác */
    }
  });
  return state;
}

// Mở (hoặc mở lại) 1 TAB cho 1 speaker. Dùng cả lúc dựng ban đầu lẫn khi tab
// bị đóng giữa chừng -> gọi lại để tự hồi phục.
async function openSpeakerTab(context, spk, voice, { isBase = false, basePage = null } = {}) {
  const page = isBase && basePage ? basePage : await context.newPage();
  const state = attachAudioListener(page);
  console.log(`Tab [${spk}] giọng ${voice}: mở ${pageUrl}`);
  // Đã ở đúng trang thì KHỎI goto — mỗi lần load lại, app tạt qua /app/sign-in
  // vài giây trong lúc khôi phục phiên rồi mới quay lại (dễ tưởng nhầm là chưa login).
  if (!/elevenlabs\.io\/app\/speech-synthesis/i.test(page.url())) {
    await page.goto(pageUrl, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
  }
  // PHẢI nổi tab lên: app không render editor khi tab chạy nền.
  await page.bringToFront().catch(() => {});
  // Chờ EDITOR (tts-editor) xuất hiện thay vì tin URL (URL sign-in có thể chỉ tạm thời).
  const waitMs = isBase && !HEADLESS ? 300000 : 90000;
  const t0 = Date.now();
  let warned = false;
  let reloaded = false;
  let lastDiag = 0;
  let box = null;
  while (Date.now() - t0 < waitMs) {
    box = await firstVisible(page, SEL.textbox);
    if (box) break;
    await page.bringToFront().catch(() => {});
    if (Date.now() - lastDiag > 10000) await dismissPopups(page);
    if (!warned && Date.now() - t0 > 20000 && /sign[-_]?in|login/i.test(page.url())) {
      console.log("⚠️  Trang đang ở màn đăng nhập — nếu không tự quay lại, hãy đăng nhập trong cửa sổ Chrome...");
      warned = true;
    }
    if (Date.now() - lastDiag > 15000) {
      lastDiag = Date.now();
      const d = await page
        .evaluate(() => `editors=${document.querySelectorAll('[data-testid="tts-editor"]').length} vis=${document.visibilityState} body=${(document.body.innerText || "").length}ch`)
        .catch((e) => `evalErr:${String(e.message).slice(0, 60)}`);
      console.log(`  · chờ editor ${Math.round((Date.now() - t0) / 1000)}s... url=${page.url()} ${d}`);
    }
    if (!reloaded && Date.now() - t0 > 60000) {
      reloaded = true;
      console.log("  · editor chưa hiện sau 60s -> reload trang...");
      await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
      await page.bringToFront().catch(() => {});
    }
    await sleep(500);
  }
  if (!box) throw new Error(`editor không xuất hiện sau ${Math.round(waitMs / 1000)}s (url=${page.url()})`);
  await dismissPopups(page); // banner/cookie đè lên UI làm click hụt
  if (!MANUAL_VOICE) {
    await setupTabModel(page, CONFIG.model); // chọn model TRƯỚC (v3 đổi editor + settings)
    await setupTabVoice(page, voice);
    await setupTabSettings(page);
  }
  return { page, state, voice };
}

async function waitForEnter(msg) {
  process.stdout.write(msg);
  await new Promise((r) => {
    process.stdin.resume();
    process.stdin.once("data", () => {
      process.stdin.pause();
      r();
    });
  });
}

async function closeBrowser(context, browser, cdpMode) {
  try {
    if (cdpMode) await browser?.close(); // chỉ ngắt kết nối, KHÔNG đóng Chrome của bạn
    else await context.close();
  } catch {
    /* bỏ qua */
  }
}

async function main() {
  let context;
  let browser = null;
  const cdpMode = !!CDP;
  // Kết nối (và KẾT NỐI LẠI khi CDP rớt giữa chừng — không sập cả tiến trình).
  const connect = async () => {
    if (cdpMode) {
      const ep = /^https?:|^ws:/.test(CDP) ? CDP : `http://127.0.0.1:${CDP}`;
      console.log(`Gắn vào Chrome qua CDP: ${ep}`);
      browser = await chromium.connectOverCDP(ep);
      context = browser.contexts()[0] || (await browser.newContext());
      await setupDownloadCapture(browser); // download rơi vào thư mục tạm, không vào Downloads
    } else {
      mkdirSync(CONFIG.profileDir, { recursive: true });
      console.log(`Mở Chrome riêng (profile ${CONFIG.profileDir}) — muốn dùng Chrome CDP thì truyền --cdp 9223 / ELEVEN_CDP.`);
      try {
        context = await chromium.launchPersistentContext(CONFIG.profileDir, {
          headless: HEADLESS,
          channel: "chrome",
          viewport: { width: 1360, height: 900 },
          acceptDownloads: true,
          args: ["--disable-blink-features=AutomationControlled"],
        });
      } catch {
        context = await chromium.launchPersistentContext(CONFIG.profileDir, {
          headless: HEADLESS,
          viewport: { width: 1360, height: 900 },
          acceptDownloads: true,
          args: ["--disable-blink-features=AutomationControlled"],
        });
      }
    }
  };
  await connect();

  // ===== 1 TAB cho mỗi speaker (mỗi tab cố định 1 giọng) =====
  const speakerKeys = [...new Set(turns.map((t) => t.speaker))];
  if (!speakerKeys.length) speakerKeys.push("A");

  // Gom các tab TTS THẬT đang mở (có tts-editor — loại target prerender chưa
  // hydrate) để TÁI SỬ DỤNG cho từng speaker; chỉ mở tab mới khi thiếu.
  // Nhờ vậy chạy lại nhiều lần KHÔNG tích tab mới (giọng/model cũng đã set sẵn).
  const reusable = [];
  for (const p of context.pages()) {
    if (!/elevenlabs\.io\/app/i.test(p.url())) continue;
    const n = await p
      .evaluate(() => document.querySelectorAll('[data-testid="tts-editor"]').length)
      .catch(() => -1);
    if (n > 0) reusable.push(p);
  }

  // Rule: giọng trong .env (ELEVEN_WEB_VOICE_A/_B) LUÔN ưu tiên; sau đó
  // speakers[X].elevenWebVoice trong dialogue.json; rồi default.
  const voiceFor = (spk) =>
    process.env[`ELEVEN_WEB_VOICE_${spk}`] ||
    (doc.speakers && doc.speakers[spk] && doc.speakers[spk].elevenWebVoice) ||
    CONFIG.voices[spk] ||
    "Rachel";

  // Mở tab qua helper: nếu CDP rớt ("browser has been closed") thì kết nối lại rồi thử lại.
  const safeOpenTab = async (spk, opts = {}) => {
    try {
      return await openSpeakerTab(context, spk, voiceFor(spk), opts);
    } catch (e) {
      if (!/closed|disconnected|websocket|target/i.test(String(e.message))) throw e;
      console.log(`  · mất kết nối trình duyệt (${e.message}) -> kết nối lại CDP...`);
      await connect();
      return openSpeakerTab(context, spk, voiceFor(spk), {});
    }
  };

  const tabs = {}; // speaker -> { page, state, voice }
  for (let i = 0; i < speakerKeys.length; i++) {
    const spk = speakerKeys[i];
    tabs[spk] = await safeOpenTab(spk, { isBase: true, basePage: reusable[i] || null });
  }

  if (MANUAL_VOICE) {
    await waitForEnter(
      `\n>>> Chế độ --manual-voice: hãy TỰ chọn giọng + model trên từng tab ` +
        `(${speakerKeys.map((s) => `tab ${s} = ${voiceFor(s)}`).join(", ")}), xong bấm Enter ở đây... `
    );
  }

  let done = 0;
  let made = 0;
  let missingTimings = 0;
  for (const turn of turns) {
    done++;
    const relPath = audioRel(turn.id);
    // RESUME: bỏ qua lượt đã có file + duration hợp lệ.
    if (!FRESH && turn.audio && turn.durationInSec > 0 && existsSync(resolve(ROOT, "public", relPath))) {
      continue;
    }

    let tab = tabs[turn.speaker] || tabs[speakerKeys[0]];
    // enTts = bản có audio tag [laughs]... (v3 hỗ trợ); turn.en giữ SẠCH cho .srt.
    const text = turn.enTts || turn.en;

    tab.state.lastAudio = null;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS && !tab.state.lastAudio; attempt++) {
      let prevKeys = [];
      try {
        if (!tab.page || tab.page.isClosed()) throw new Error("tab đã đóng");
        await tab.page.bringToFront().catch(() => {});
        if (attempt > 1) await dismissPopups(tab.page); // popup có thể bật giữa chừng
        await typeText(tab.page, text);
        prevKeys = await getAudioSrcKeys(tab.page); // src cũ trước khi generate
        tab.state.lastAudio = null;
        await clickGenerate(tab.page);
      } catch (e) {
        console.log(`  · lượt ${turn.id}: tab [${turn.speaker}] lỗi (${e.message}) -> mở lại tab...`);
        tab = await safeOpenTab(turn.speaker);
        tabs[turn.speaker] = tab;
        if (attempt < MAX_ATTEMPTS) await sleep(1500);
        continue;
      }
      // Chờ audio: ưu tiên network (có alignment -> words[]); song song đó cứ
      // ~1.5s đọc thẻ <audio>. src chỉ được gán SAU KHI PLAY -> nếu src trống/cũ,
      // bấm Play (muted) của player rồi đọc lại (guide mục 9).
      const tClick = Date.now();
      let lastCheck = 0;
      let lastPlayPress = 0;
      while (!tab.state.lastAudio && Date.now() - tClick < AUDIO_WAIT_MS) {
        await sleep(300);
        if (Date.now() - lastCheck < 800) continue;
        lastCheck = Date.now();
        const got = await grabPlayerAudio(tab.page, prevKeys).catch(() => null);
        if (got?.buf) {
          tab.state.lastAudio = got;
          if (VERBOSE) console.log(`  · lấy audio từ <audio> src: ${got.buf.length} bytes, ${got.durationSec}s`);
        } else if (got && (got.empty || got.stale) && Date.now() - tClick > 4000 && Date.now() - lastPlayPress > 4000) {
          // gen có thể đã xong nhưng src chưa gán / còn là bản cũ -> bấm Play (muted)
          lastPlayPress = Date.now();
          await pressLatestPlay(tab.page);
        } else if (got?.blocked) {
          const dl = await downloadAudio(tab.page);
          if (dl) {
            tab.state.lastAudio = dl;
            if (VERBOSE) console.log(`  · lấy audio qua nút Download: ${dl.buf.length} bytes`);
          }
        }
      }
      // GUARD chống đọc đôi / dính bản generate cũ: web v3 có thể trả buffer chứa
      // 2 take (hoặc cả câu trước đó của tab) -> audio dài bất thường so với text.
      // Loại bản đó và thử lại thay vì lưu file hỏng.
      if (tab.state.lastAudio) {
        const gwc = stripTags(text).split(/\s+/).filter(Boolean).length;
        const gdur = tab.state.lastAudio.durationSec || mp3DurationSec(tab.state.lastAudio.buf) || 0;
        const maxSec = 2.5 + gwc * 0.65;
        if (gdur > maxSec) {
          console.log(
            `  · lượt ${turn.id}: audio ${gdur.toFixed(1)}s vượt ngưỡng ${maxSec.toFixed(1)}s (${gwc} từ) — nghi đọc đôi/dính bản cũ -> bỏ, thử lại.`
          );
          tab.state.lastAudio = null;
        }
      }
      if (!tab.state.lastAudio && attempt < MAX_ATTEMPTS) {
        console.log(
          `  · lượt ${turn.id}: chưa bắt được audio (lần ${attempt}) -> nghỉ ${Math.round(RETRY_WAIT_MS / 1000)}s rồi thử lại. ` +
            `(Kiểm tra tab: hết credit? popup? chưa đăng nhập?)`
        );
        await sleep(RETRY_WAIT_MS);
      }
    }
    const { voice, state } = tab;
    if (!state.lastAudio) {
      saveDoc(doc);
      await closeBrowser(context, browser, cdpMode);
      throw new Error(
        `Lỗi: không bắt được audio cho lượt ${turn.id} sau ${MAX_ATTEMPTS} lần thử. ` +
          `Đã lưu ${made} file mới — CHẠY LẠI để resume. Kiểm tra: đăng nhập, credit còn không, ` +
          `hoặc bật --verbose xem có bắt được response nào không (có thể cần chỉnh regex URL / selector qua env).`
      );
    }

    const audio = state.lastAudio;
    writeFileSync(resolve(ROOT, "public", relPath), audio.buf);

    const dur = audio.durationSec || mp3DurationSec(audio.buf);
    turn.audio = relPath;
    turn.durationInSec = dur;
    turn.words = audio.words || [];
    if (!turn.words.length) missingTimings++;
    made++;
    saveDoc(doc);
    console.log(
      `[${done}/${turns.length}] d${turn.id}.mp3  [${turn.speaker}/${voice}]  ${dur}s  ${turn.words.length} từ có mốc`
    );

    if (done < turns.length) await sleep(PACE_MS);
  }

  saveDoc(doc);
  await closeBrowser(context, browser, cdpMode);
  console.log(`Đã cập nhật ${dataRel} (audio từ web ElevenLabs).`);
  if (missingTimings) {
    console.log(
      `Lưu ý: ${missingTimings} lượt KHÔNG có mốc từng từ (web trả MP3 binary, không alignment). ` +
        `Chạy Whisper để có karaoke ->  npm run dialogue:align -- --data ${dataRel}`
    );
  }
}

main().catch((e) => {
  console.error(e?.stack || e?.message || e);
  process.exit(1);
});
