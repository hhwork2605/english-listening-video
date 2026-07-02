/**
 * Sinh giọng đọc hội thoại bằng cách LÁI WEB Google AI Studio (Generate speech)
 * qua Playwright — KHÔNG dùng API key, KHÔNG tốn quota API.
 *
 * Trang:  https://aistudio.google.com/generate-speech
 * Model:  gemini-3.1-flash-tts-preview (env AISTUDIO_TTS_MODEL)
 *
 * Cách bắt audio: trang generate-speech gọi endpoint kiểu generateContent trả về
 * base64 PCM (audio/L16;rate=24000) trong JSON — script NGHE response mạng, gom
 * base64, tự bọc WAV header (y hệt tts-gemini.mjs). Nhờ vậy KHÔNG phụ thuộc nút
 * "Download" (selector hay đổi). Phần lái UI (gõ text, chọn giọng, bấm Run) dùng
 * selector linh hoạt + nhiều phương án dự phòng, override được qua env.
 *
 * ĐĂNG NHẬP — 2 chế độ:
 *  (A) CDP (KHUYẾN NGHỊ vì Google chặn login trên trình duyệt tự-động-hoá):
 *      Tự mở Chrome bình thường + cờ debug, đăng nhập Google 1 lần, rồi gắn script vào:
 *        1) Đóng hết Chrome đang mở.
 *        2) Mở Chrome (giữ profile riêng để khỏi đụng profile chính):
 *           & "C:\Program Files\Google\Chrome\Application\chrome.exe" `
 *             --remote-debugging-port=9222 --user-data-dir="$env:USERPROFILE\aistudio-chrome"
 *        3) Trong Chrome đó: đăng nhập Google + mở aistudio.google.com 1 lần.
 *        4) Chạy script kèm:  --cdp 9222   (hoặc env AISTUDIO_CDP=9222)
 *  (B) Persistent profile (.pw-profile/): đơn giản nhưng Google THƯỜNG chặn login
 *      ("This browser or app may not be secure"). Chỉ dùng nếu (A) bất tiện.
 *
 * Giọng (MỖI SPEAKER 1 TAB): mở 1 tab cho mỗi speaker, set giọng + Accent/Style/Pace
 *   MỘT LẦN cho tab đó; mỗi lượt chỉ đổi text + Run trên tab tương ứng (không mở lại
 *   dialog giọng, ít thao tác -> nhanh + đỡ bị nghi-ngờ-bot).
 *   speakers[X].aistudioVoice trong dialogue.json, hoặc env AISTUDIO_VOICE_A/_B
 *   (tên giọng web: Zephyr / Puck / Charon / Kore / Fenrir / Erinome / Iapetus ...).
 *   Cài đặt giao giọng: AISTUDIO_ACCENT / _STYLE / _PACE (mặc định American (Gen)/Newscaster/Natural).
 *
 * CHỐNG-BOT: Google chấm điểm hành vi. Script (1) rê chuột nhiều bước như người khi
 *   bấm Run (click "nhảy" thẳng bị 403), (2) gõ text có độ trễ, (3) khi gặp 403 thì
 *   NGHỈ DÀI rồi mới thử lại thay vì bấm dồn. Vẫn có thể bị 403 hàng loạt nếu Google
 *   siết — khi đó dừng lại, file đã lưu, CHẠY LẠI để resume sau vài phút.
 *
 * KHÔNG trả mốc từng từ -> sau đó chạy: npm run dialogue:align -- --data <file>
 *
 * Cách dùng:
 *   node scripts/tts-aistudio.mjs --data projects/<id>/dialogue.json --cdp 9222
 *   npm run dialogue:audio:aistudio -- --data projects/<id>/dialogue.json --cdp 9222
 *   # tuỳ chọn:
 *   #   --limit N        chỉ làm N lượt đầu để test
 *   #   --fresh          xoá audio cũ + làm lại từ đầu
 *   #   --headless       chạy ẩn (chỉ dùng SAU khi đã đăng nhập + ổn định)
 *   #   --model <name>   đổi model trên URL
 *   #   --pace <ms>      nghỉ giữa các lượt (mặc định 9000)
 *   #   --retry-wait <ms>  nghỉ khi gặp 403 trước khi thử lại (mặc định 25000)
 *   #   --max-attempts <n> số lần thử mỗi lượt (mặc định 5)
 *   #   --profile <dir>  thư mục profile Chrome (chế độ B, mặc định .pw-profile)
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
import { chromium } from "playwright";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

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
const CDP = getArg("--cdp", process.env.AISTUDIO_CDP || ""); // port hoặc URL ws/http
const LIMIT = Number(getArg("--limit", "0")) || 0;
const FRESH = has("--fresh");
const HEADLESS = has("--headless");
const VERBOSE = has("--verbose");
// Nhịp CHẬM để hạ "điểm nghi-ngờ-bot" của Google (chống 403 hàng loạt).
const PACE_MS = Number(getArg("--pace", process.env.AISTUDIO_PACE_MS || "9000")) || 9000;
// Khi 1 lượt bị 403: NGHỈ DÀI cho điểm bot giảm rồi mới thử lại (KHÔNG bấm dồn).
const RETRY_WAIT_MS = Number(getArg("--retry-wait", process.env.AISTUDIO_RETRY_WAIT_MS || "25000")) || 25000;
const MAX_ATTEMPTS = Number(getArg("--max-attempts", process.env.AISTUDIO_MAX_ATTEMPTS || "5")) || 5;
const AUDIO_WAIT_MS = Number(process.env.AISTUDIO_AUDIO_WAIT_MS || "14000") || 14000;

// --- nạp .env ---
const envPath = resolve(ROOT, ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const CONFIG = {
  model: getArg("--model", process.env.AISTUDIO_TTS_MODEL || "gemini-3.1-flash-tts-preview"),
  profileDir: resolve(ROOT, getArg("--profile", process.env.AISTUDIO_PROFILE || ".pw-profile")),
  genTimeoutMs: Number(process.env.AISTUDIO_GEN_TIMEOUT_MS || "120000") || 120000,
  voices: {
    A: process.env.AISTUDIO_VOICE_A || "Kore",
    B: process.env.AISTUDIO_VOICE_B || "Puck",
  },
  // Cài đặt giọng cho podcast tiếng Anh rõ ràng, dễ nghe (override qua env).
  accent: process.env.AISTUDIO_ACCENT || "American (Gen)", // Anh-Mỹ phổ thông
  style: process.env.AISTUDIO_STYLE || "Newscaster", // phát âm rõ, chuẩn phát thanh
  pace: process.env.AISTUDIO_PACE || "Natural", // nhịp hội thoại tự nhiên
};
const pageUrl = `https://aistudio.google.com/generate-speech?model=${encodeURIComponent(CONFIG.model)}`;

const round3 = (n) => Math.round((Number(n) || 0) * 1000) / 1000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Bọc PCM (mono, 16-bit) thành file WAV. (giống tts-gemini.mjs)
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
const rateFromMime = (mime, fb = 24000) => {
  const m = /rate=(\d+)/.exec(mime || "");
  return m ? Number(m[1]) : fb;
};

// Gom MỌI mảnh audio base64 trong response -> { pcm, rate }, nối theo thứ tự.
// Web generate-speech trả "application/json+protobuf": MẢNG lồng nhau, audio là các
// cặp ["audio/l16; rate=24000; channels=1", "<base64>"] (stream ~52 mảnh).
// Cũng hỗ trợ JSON chuẩn dạng { inlineData: { mimeType, data } } (phòng khi đổi).
function extractAudioFromBody(text) {
  if (!/audio\//i.test(text)) return null;
  const chunks = [];
  let rate = 24000;
  let root;
  try {
    root = JSON.parse(text);
  } catch {
    root = null;
  }
  if (root) {
    const walk = (o) => {
      if (o == null || typeof o !== "object") return;
      if (Array.isArray(o)) {
        // protobuf-JSON: cặp ["audio/...", "<base64>"]
        if (o.length >= 2 && typeof o[0] === "string" && /^audio\//i.test(o[0]) && typeof o[1] === "string") {
          chunks.push(o[1]);
          rate = rateFromMime(o[0], rate);
        }
        o.forEach(walk);
        return;
      }
      const inl = o.inlineData || o.inline_data;
      if (inl && /^audio\//i.test(inl.mimeType || inl.mime_type || "") && inl.data) {
        chunks.push(inl.data);
        rate = rateFromMime(inl.mimeType || inl.mime_type, rate);
      }
      for (const v of Object.values(o)) walk(v);
    };
    walk(root);
  }
  if (!chunks.length) {
    // Fallback regex: base64 dài (>200) đứng ngay sau chuỗi mime "audio/...".
    const re = /"(audio\/[^"]+)"\s*,\s*"([A-Za-z0-9+/]{200,}={0,2})"/g;
    let m;
    while ((m = re.exec(text))) {
      chunks.push(m[2]);
      rate = rateFromMime(m[1], rate);
    }
  }
  if (!chunks.length) return null;
  return { pcm: Buffer.concat(chunks.map((b) => Buffer.from(b, "base64"))), rate };
}

// --- chuẩn bị file/thư mục ---
const dataPath = resolve(ROOT, dataRel);
// Namespace audio theo project (thư mục chứa file --data) để KHÔNG đè file giữa
// các project. projects/<id>/dialogue.json -> public/audio/<id>/... ; các đường
// dẫn khác (vd data/) giữ phẳng public/audio/ như cũ.
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

// =================== Playwright ===================
// Selector (theo DOM thật của trang generate-speech, gemini-3.1 TTS).
const SEL = {
  enterEditor: ".text-input-container", // ô landing -> click để vào trình soạn
  speechBox: 'textarea[aria-label="Speech block text"]', // ô lời thoại
  // mở modal chọn giọng: voice-chip (luôn có trong editor) hoặc active-voice-card-trigger (trong run-settings panel)
  openVoicePanel: "button.voice-chip, button.active-voice-card-trigger",
  voiceCard: (v) =>
    `button.voice-card-content[aria-label="${v}"], button.voice-card-content[aria-label="${v} (Current)"]`,
  chipBtn: (label) => `button[aria-label="${label}"]`, // Style | Pace | Accent
};

// Bảo đảm đang ở trình soạn (có ô "Speech block text").
async function ensureEditor(page) {
  if (await page.locator(SEL.speechBox).count().catch(() => 0)) return;
  const ti = page.locator(SEL.enterEditor).first();
  if (await ti.count().catch(() => 0)) {
    await ti.click().catch(() => {});
    await page.locator(SEL.speechBox).first().waitFor({ state: "visible", timeout: 15000 }).catch(() => {});
  }
}

// Mở modal chọn giọng (chứa thẻ giọng + chip Style/Pace/Accent). Thử tối đa 3 lần.
async function ensureVoicePanel(page) {
  for (let attempt = 0; attempt < 3; attempt++) {
    if (await page.locator("button.voice-card-content").count().catch(() => 0)) return true;
    const trig = page.locator(SEL.openVoicePanel).first();
    await trig.waitFor({ state: "visible", timeout: 8000 }).catch(() => {});
    if (await trig.count().catch(() => 0)) {
      await trig.click().catch(() => {});
      const ok = await page
        .locator("button.voice-card-content")
        .first()
        .waitFor({ state: "visible", timeout: 8000 })
        .then(() => true)
        .catch(() => false);
      if (ok) return true;
    }
    await sleep(600);
  }
  return (await page.locator("button.voice-card-content").count().catch(() => 0)) > 0;
}

// Đóng modal dialog chọn giọng (đợi backdrop biến mất) để có thể gõ vào ô text.
async function closeVoiceDialog(page) {
  const close = page.locator('button[aria-label="Close panel"]').first();
  if (await close.count().catch(() => 0)) await close.click().catch(() => {});
  else await page.keyboard.press("Escape").catch(() => {});
  await page
    .locator(".cdk-overlay-backdrop-showing")
    .first()
    .waitFor({ state: "detached", timeout: 5000 })
    .catch(() => {});
}

// Đặt 1 chip (Style/Pace/Accent) -> mở menu, chọn option khớp regex (Escape đóng menu, GIỮ dialog).
const menuItemSel = '[role="menuitem"], [role="menuitemradio"], .mat-mdc-menu-item';
async function setChip(page, label, optionRe) {
  const chip = page.locator(SEL.chipBtn(label)).first();
  if (!(await chip.count().catch(() => 0))) return false;
  // Chip đầu tiên đôi khi mở hụt (menu chưa render) -> thử tối đa 3 lần.
  for (let attempt = 0; attempt < 3; attempt++) {
    await chip.click().catch(() => {});
    const appeared = await page
      .locator(menuItemSel)
      .first()
      .waitFor({ state: "visible", timeout: 3000 })
      .then(() => true)
      .catch(() => false);
    if (!appeared) {
      await sleep(400);
      continue; // menu chưa mở -> bấm lại chip
    }
    const item = page.locator(menuItemSel).filter({ hasText: optionRe }).first();
    let ok = false;
    if (await item.count().catch(() => 0)) {
      await item.click().catch(() => {});
      ok = true;
    }
    await page.keyboard.press("Escape").catch(() => {}); // đóng menu, KHÔNG đóng dialog
    await sleep(300);
    return ok;
  }
  return false;
}

// Thiết lập 1 TAB cho 1 giọng: mở modal -> chọn giọng + Accent/Style/Pace -> đóng.
// Gọi MỘT LẦN cho mỗi tab; sau đó tab giữ nguyên giọng, mỗi lượt chỉ đổi text + Run.
async function setupTabVoice(page, voice) {
  const panelOpen = await ensureVoicePanel(page);
  if (!panelOpen) console.log("  ! Không mở được panel chọn giọng.");
  const card = page.locator(SEL.voiceCard(voice)).first();
  // chờ thẻ giọng + cuộn vào tầm nhìn (danh sách 30 giọng có thể bị cuộn).
  await card.waitFor({ state: "attached", timeout: 6000 }).catch(() => {});
  await card.scrollIntoViewIfNeeded({ timeout: 4000 }).catch(() => {});
  if (await card.count().catch(() => 0)) {
    await card.click({ timeout: 6000 }).catch(() => {});
    if (VERBOSE) console.log(`  · chọn giọng: ${voice}`);
  } else {
    console.log(`  ! Không tìm thấy giọng "${voice}" trong UI (kiểm tra tên giọng).`);
  }
  const a = await setChip(page, "Accent", new RegExp("^" + CONFIG.accent.replace(/[()]/g, "\\$&")));
  const s = await setChip(page, "Style", new RegExp("^" + CONFIG.style));
  const p = await setChip(page, "Pace", new RegExp("^" + CONFIG.pace));
  if (VERBOSE) console.log(`  · cài đặt [${voice}]: Accent=${CONFIG.accent}(${a}) Style=${CONFIG.style}(${s}) Pace=${CONFIG.pace}(${p})`);
  await closeVoiceDialog(page);
}

// Gắn listener bắt audio cho 1 page -> trả về { lastAudio } cập nhật theo từng response.
function attachAudioListener(page) {
  const state = { lastAudio: null };
  page.on("response", async (resp) => {
    try {
      const ct = (resp.headers()["content-type"] || "").toLowerCase();
      if (!/json|text|stream/.test(ct)) return;
      const url = resp.url();
      if (!/generatecontent|generate_content|makersuite|speech|synthesi/i.test(url)) return;
      if (resp.status() !== 200) return; // 403 -> bỏ qua, sẽ retry
      const body = await resp.text();
      if (!/audio\//i.test(body)) return;
      const a = extractAudioFromBody(body);
      if (a && a.pcm.length) {
        state.lastAudio = a;
        if (VERBOSE) console.log(`  · bắt audio ${a.pcm.length} bytes @${a.rate}Hz`);
      }
    } catch {
      /* response không đọc được body -> bỏ qua */
    }
  });
  return state;
}

function generateBezierPoints(start, end, steps = 20) {
  const points = [];
  const control1 = { x: start.x + Math.random() * 50, y: start.y - Math.random() * 50 };
  const control2 = { x: end.x - Math.random() * 50, y: end.y + Math.random() * 50 };

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = Math.pow(1 - t, 3) * start.x + 3 * Math.pow(1 - t, 2) * t * control1.x + 3 * (1 - t) * Math.pow(t, 2) * control2.x + Math.pow(t, 3) * end.x;
    const y = Math.pow(1 - t, 3) * start.y + 3 * Math.pow(1 - t, 2) * t * control1.y + 3 * (1 - t) * Math.pow(t, 2) * control2.y + Math.pow(t, 3) * end.y;
    points.push({ x, y });
  }
  return points;
}

async function humanMoveMouse(page, targetSelectorOrLocator) {
  const locator = typeof targetSelectorOrLocator === "string" ? page.locator(targetSelectorOrLocator) : targetSelectorOrLocator;
  const box = await locator.boundingBox().catch(() => null);
  
  if (box) {
    const targetX = box.x + Math.random() * box.width;
    const targetY = box.y + Math.random() * box.height;
    const startX = 100 + Math.random() * 100;
    const startY = 100 + Math.random() * 100;

    const points = generateBezierPoints({ x: startX, y: startY }, { x: targetX, y: targetY });

    for (const point of points) {
      await page.mouse.move(point.x, point.y);
      await sleep(Math.random() * 5 + 2);
    }
  }
}

async function humanClick(page) {
  await page.mouse.down();
  await sleep(Math.floor(Math.random() * 80) + 50);
  await page.mouse.up();
}

async function humanType(page, selectorOrLocator, text) {
  const locator = typeof selectorOrLocator === "string" ? page.locator(selectorOrLocator) : selectorOrLocator;

  for (const char of text) {
    if (Math.random() < 0.015 && char !== ' ') {
      const wrongChars = 'abcdefghijklmnopqrstuvwxyz';
      const randomWrongChar = wrongChars[Math.floor(Math.random() * wrongChars.length)];

      await locator.pressSequentially(randomWrongChar);
      await sleep(Math.random() * 60 + 30);
      await page.keyboard.press('Backspace');
      await sleep(Math.random() * 60 + 30);
    }

    await locator.pressSequentially(char);
    let delay = Math.random() * 60 + 35;

    if (char === ' ' || char === ',' || char === '.') {
      delay += Math.random() * 110 + 55;
    }

    await sleep(delay);
  }
}

async function humanPressCtrlEnter(page) {
  await page.keyboard.down('Control');
  await sleep(Math.floor(Math.random() * 50) + 30);
  await page.keyboard.down('Enter');
  await sleep(Math.floor(Math.random() * 60) + 40);
  await page.keyboard.up('Enter');
  await sleep(Math.floor(Math.random() * 50) + 30);
  await page.keyboard.up('Control');
}

async function typeText(page, text) {
  const box = page.locator(SEL.speechBox).first();
  await box.waitFor({ state: "visible", timeout: 20000 });
  
  await humanMoveMouse(page, box);
  await sleep(Math.random() * 200 + 100);
  await humanClick(page);
  await sleep(Math.random() * 500 + 300);

  await box.fill(""); // xoá nội dung cũ
  await sleep(Math.random() * 300 + 200);

  await humanType(page, box, text).catch(async (err) => {
    if (VERBOSE) console.log("  ! Gõ kiểu người gặp lỗi, fallback dùng fill():", err.message);
    await box.fill(text);
  });
}

async function clickRun(page) {
  const btn = page.locator('button.ctrl-enter-submits, button:has-text("Run")').first();
  const hasBtn = (await btn.count().catch(() => 0)) > 0;
  
  // Ưu tiên RÊ CHUỘT BẤM NÚT (đáng tin cậy). Trang generate-speech thực tế KHÔNG
  // phản hồi Ctrl+Enter một cách ổn định (Angular nghe sự kiện ở element khác) →
  // chỉ dùng phím tắt làm PHƯƠNG ÁN DỰ PHÒNG khi không tìm thấy nút Run.
  if (hasBtn) {
    if (VERBOSE) console.log("  · [ClickRun] Rê chuột bấm nút Run...");
    await humanMoveMouse(page, btn);
    await sleep(Math.random() * 90 + 40);
    await humanClick(page);
  } else {
    if (VERBOSE) console.log("  · [ClickRun] Không thấy nút Run → fallback Ctrl+Enter...");
    await page.locator(SEL.speechBox).first().focus().catch(() => {});
    await sleep(Math.random() * 100 + 50);
    await humanPressCtrlEnter(page);
  }
}

// Mở (hoặc mở lại) 1 TAB cho 1 speaker: goto trang, vào editor, set giọng. Dùng cả
// lúc dựng ban đầu LẪN khi tab bị đóng giữa chừng (AI Studio đôi khi tự đóng tab
// sau nhiều lượt) -> gọi lại để tự hồi phục, khỏi phải resume tay.
async function openSpeakerTab(context, spk, voice, { isBase = false, basePage = null } = {}) {
  const page = isBase && basePage ? basePage : await context.newPage();
  const state = attachAudioListener(page);
  console.log(`Tab [${spk}] giọng ${voice}: mở ${pageUrl}`);
  await page.goto(pageUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  if (isBase) {
    if (/accounts\.google\.com|\/u\/\d|signin/i.test(page.url())) {
      console.log("⚠️  Cần đăng nhập Google. Hãy đăng nhập trong cửa sổ trình duyệt...");
    }
    await page
      .waitForURL(/aistudio\.google\.com\/generate-speech/i, { timeout: HEADLESS ? 30000 : 300000 })
      .catch(() => {});
  }
  await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
  await ensureEditor(page);
  await setupTabVoice(page, voice);
  return { page, state, voice };
}

// Ở chế độ CDP: KHÔNG đóng Chrome của người dùng, chỉ ngắt kết nối.
async function closeBrowser(context, browser, cdpMode) {
  try {
    if (cdpMode) await browser?.close();
    else await context.close();
  } catch {
    /* bỏ qua */
  }
}

async function main() {
  let context;
  let browser = null;
  const cdpMode = !!CDP;
  if (cdpMode) {
    // Gắn vào Chrome bạn tự mở (đã đăng nhập) qua remote debugging.
    const ep = /^https?:|^ws:/.test(CDP) ? CDP : `http://127.0.0.1:${CDP}`;
    console.log(`Gắn vào Chrome qua CDP: ${ep}`);
    browser = await chromium.connectOverCDP(ep);
    context = browser.contexts()[0] || (await browser.newContext());
  } else {
    mkdirSync(CONFIG.profileDir, { recursive: true });
    // channel "chrome" -> dùng Chrome đã cài (tránh tải Chromium); fallback Chromium.
    try {
      context = await chromium.launchPersistentContext(CONFIG.profileDir, {
        headless: HEADLESS,
        channel: "chrome",
        viewport: { width: 1280, height: 900 },
        acceptDownloads: true,
        args: ["--disable-blink-features=AutomationControlled"],
      });
    } catch {
      context = await chromium.launchPersistentContext(CONFIG.profileDir, {
        headless: HEADLESS,
        viewport: { width: 1280, height: 900 },
        acceptDownloads: true,
        args: ["--disable-blink-features=AutomationControlled"],
      });
    }
  }

  // Inject init script to remove webdriver flag
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    });
  });
  // ===== Dựng 1 TAB cho mỗi speaker (mỗi tab cố định 1 giọng) =====
  // Mỗi speaker xuất hiện trong turns -> 1 tab riêng, set giọng + Style/Pace/Accent 1 lần.
  const speakerKeys = [...new Set(turns.map((t) => t.speaker))];
  if (!speakerKeys.length) speakerKeys.push("A");

  const existing = context.pages();
  const basePage = existing.find((p) => /aistudio\.google\.com\/generate-speech/i.test(p.url())) || existing[0] || null;

  // Rule: giọng trong .env (AISTUDIO_VOICE_A/_B) LUÔN được ưu tiên. Nếu env không
  // set thì mới dùng aistudioVoice trong dialogue.json, rồi default.
  const voiceFor = (spk) =>
    process.env[`AISTUDIO_VOICE_${spk}`] ||
    (doc.speakers && doc.speakers[spk] && doc.speakers[spk].aistudioVoice) ||
    CONFIG.voices[spk] ||
    "Kore";

  const tabs = {}; // speaker -> { page, state, voice }
  for (let i = 0; i < speakerKeys.length; i++) {
    const spk = speakerKeys[i];
    tabs[spk] = await openSpeakerTab(context, spk, voiceFor(spk), {
      isBase: i === 0,
      basePage,
    });
  }

  let done = 0;
  let made = 0;
  for (const turn of turns) {
    done++;
    const relPath = audioRel(turn.id);
    // RESUME: bỏ qua lượt đã có file + duration hợp lệ.
    if (!FRESH && turn.audio && turn.durationInSec > 0 && existsSync(resolve(ROOT, "public", relPath))) {
      continue;
    }

    let tab = tabs[turn.speaker] || tabs[speakerKeys[0]];
    // Ưu tiên enTts (có tag cảm xúc) — AI Studio hỗ trợ tag [...]; giữ turn.en
    // SẠCH cho .srt. Chỉ nên dùng tag AN TOÀN (âm phi lời / style / pause) trong
    // enTts, tránh tag tính từ cảm xúc vì có thể bị đọc to. Xem references/better-tts.md.
    const text = turn.enTts || turn.en;

    // Sinh audio. Google chấm điểm hành vi: bấm DỒN DẬP -> 403 hàng loạt.
    // Chiến lược: gõ + bấm 1 lần (rê chuột như người), chờ ~14s; nếu 403 thì NGHỈ DÀI
    // rồi thử lại; tối đa MAX_ATTEMPTS lần. Nếu tab bị đóng giữa chừng (AI Studio hay
    // tự đóng) thì MỞ LẠI tab rồi thử lại, KHÔNG sập cả tiến trình.
    tab.state.lastAudio = null;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS && !tab.state.lastAudio; attempt++) {
      try {
        if (!tab.page || tab.page.isClosed()) throw new Error("tab đã đóng");
        await tab.page.bringToFront().catch(() => {}); // kích hoạt đúng tab của speaker
        await typeText(tab.page, text);
        tab.state.lastAudio = null;
        await clickRun(tab.page);
      } catch (e) {
        console.log(`  · lượt ${turn.id}: tab [${turn.speaker}] lỗi (${e.message}) -> mở lại tab...`);
        tab = await openSpeakerTab(context, turn.speaker, voiceFor(turn.speaker), {});
        tabs[turn.speaker] = tab;
        if (attempt < MAX_ATTEMPTS) await sleep(1500);
        continue; // thử lại lượt này với tab mới
      }
      const tClick = Date.now();
      while (!tab.state.lastAudio && Date.now() - tClick < AUDIO_WAIT_MS) {
        await sleep(300);
      }
      if (!tab.state.lastAudio && attempt < MAX_ATTEMPTS) {
        if (VERBOSE) console.log(`  · lượt ${turn.id}: 403 lần ${attempt} -> nghỉ ${Math.round(RETRY_WAIT_MS / 1000)}s rồi thử lại`);
        await sleep(RETRY_WAIT_MS);
      }
    }
    const voice = tab.voice;
    const state = tab.state;
    if (!state.lastAudio) {
      saveDoc(doc);
      await closeBrowser(context, browser, cdpMode);
      throw new Error(
        `Lỗi: không bắt được audio cho lượt ${turn.id} sau ${MAX_ATTEMPTS} lần thử (403 chống-bot). ` +
          `Đã lưu ${made} file mới — CHẠY LẠI để resume (Google sẽ nguội bớt sau vài phút). ` +
          `Có thể tăng --retry-wait / --pace hoặc tự bấm tay vài lượt rồi chạy tiếp.`
      );
    }

    const audio = state.lastAudio;
    const wav = pcmToWav(audio.pcm, audio.rate);
    writeFileSync(resolve(ROOT, "public", relPath), wav);

    turn.audio = relPath;
    turn.durationInSec = round3(audio.pcm.length / (audio.rate * 2)); // mono 16-bit
    turn.words = []; // chạy dialogue:align (Whisper) để lấy mốc từng từ
    made++;
    saveDoc(doc);
    console.log(`[${done}/${turns.length}] d${turn.id}.wav  [${turn.speaker}/${voice}]  ${turn.durationInSec}s`);

    if (done < turns.length) await sleep(PACE_MS);
  }

  saveDoc(doc);
  await closeBrowser(context, browser, cdpMode);
  console.log(`Đã cập nhật ${dataRel} (audio từ AI Studio web: ${CONFIG.model}).`);
  console.log("Tiếp theo: chạy Whisper để có karaoke ->  npm run dialogue:align -- --data " + dataRel);
}

main().catch((e) => {
  console.error(e?.stack || e?.message || e);
  process.exit(1);
});
