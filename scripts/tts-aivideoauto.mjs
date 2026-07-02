/**
 * Sinh giọng đọc hội thoại bằng cách LÁI WEB aivideoauto.com/audio (AI Voice
 * Studio, tab "Văn bản thành giọng nói") qua Playwright — THAY cho adapter API
 * gommo cũ (api.gommo.net đã ngừng hoạt động).
 *
 * Trang là React + Tailwind, KHÔNG có id/data-testid ổn định → selector bám theo
 * text tiếng Việt + role (getByRole/getByText/getByPlaceholder), mỗi bước có vài
 * phương án dự phòng. Cách bắt audio: NGHE response mạng (content-type audio/*
 * hoặc URL .mp3/.wav) sau khi bấm "Tạo Audio" → không phụ thuộc nút download
 * (selector hay đổi); nút download + thẻ <audio> chỉ là fallback.
 *
 * Provider / model (giới hạn ký tự 1 lượt — script tự kiểm trước khi tốn credit):
 *   Omnivoice : Omnivoice (10.000)
 *   ElevenLabs: Eleven V3 (1.500) | Eleven V2.5 (3.000) | Auto TTS v1 (5.000)
 *   MiniMax   : Minimax v2.8 HD (5.000) | v2.8 Turbo (10.000) | v2.6 HD/Turbo (3.000)
 * ⚠ GIỌNG PHẢI KHỚP PROVIDER (lọc "Nguồn" trong Thư viện giọng), không thì báo
 *   lỗi kiểu "Upload reference audio lên OmniVoice thất bại".
 *
 * ĐĂNG NHẬP (tạo audio tốn credit nên cần tài khoản) — 2 chế độ như tts-aistudio:
 *  (A) CDP: mở Chrome thật có cờ debug, đăng nhập 1 lần, chạy kèm --cdp 9222
 *        & "C:\Program Files\Google\Chrome\Application\chrome.exe" `
 *          --remote-debugging-port=9222 --user-data-dir="$env:USERPROFILE\aiva-chrome"
 *  (B) Persistent profile (mặc định, thư mục .pw-profile/): lần đầu chạy sẽ mở
 *      cửa sổ trình duyệt — đăng nhập tay trong đó (script chờ tới 5 phút);
 *      các lần sau tự đăng nhập lại từ profile.
 *
 * Giọng: env AIVA_VOICE_A/_B (ưu tiên) hoặc speakers[X].aivaVoice trong
 * dialogue.json — là TỪ KHÓA TÌM trong "Thư viện giọng" (tên hoặc ID giọng).
 * Không đặt → giữ nguyên giọng panel đang chọn (2 speaker sẽ CÙNG giọng — tránh).
 *
 * KHÔNG có mốc từng từ → sau khi sinh xong chạy:
 *   npm run dialogue:align -- --data projects/<id>/dialogue.json
 *
 * Cách dùng:
 *   node scripts/tts-aivideoauto.mjs --data projects/<id>/dialogue.json
 *   npm run dialogue:audio:aiva -- --data projects/<id>/dialogue.json
 *   # tuỳ chọn:
 *   #   --provider ElevenLabs|Omnivoice|MiniMax   (mặc định ElevenLabs)
 *   #   --model "Eleven V3"                       (đúng tên trong dropdown model)
 *   #   --voice-a Harmony --voice-b Adam          (ghi đè từ khóa giọng)
 *   #   --cdp 9222        gắn vào Chrome thật (khuyến nghị)
 *   #   --profile <dir>   thư mục profile (chế độ B, mặc định .pw-profile)
 *   #   --limit N         chỉ làm N lượt đầu để test
 *   #   --fresh           xoá audio cũ + làm lại từ đầu (mặc định RESUME lượt thiếu)
 *   #   --headless        chạy ẩn (chỉ dùng khi profile đã đăng nhập)
 *   #   --pace <ms>       nghỉ giữa các lượt (mặc định 1500)
 *   #   --verbose         in URL audio bắt được / bước UI để dò lỗi selector
 *
 * Cần cài 1 lần:  npm i -D playwright   (script ưu tiên channel "chrome" — dùng
 * Chrome sẵn có; nếu không có Chrome thì thêm: npx playwright install chromium)
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
const dataRel = getArg("--data", "data/dialogue.json");
const VERBOSE = has("--verbose");
const FRESH = has("--fresh");
const HEADLESS = has("--headless");
const LIMIT = Number(getArg("--limit", "0")) || 0;

// --- nạp .env ---
const envPath = resolve(ROOT, ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const CONFIG = {
  base: getArg("--base", process.env.AIVA_URL || "https://aivideoauto.com"),
  provider: getArg("--provider", process.env.AIVA_PROVIDER || "ElevenLabs"),
  model: getArg("--model", process.env.AIVA_MODEL || "Eleven V3"),
  cdp: getArg("--cdp", process.env.AIVA_CDP || ""), // port hoặc URL ws/http
  profileDir: resolve(ROOT, getArg("--profile", process.env.AIVA_PROFILE || ".pw-profile")),
  voices: {
    A: getArg("--voice-a", process.env.AIVA_VOICE_A || ""),
    B: getArg("--voice-b", process.env.AIVA_VOICE_B || ""),
  },
  genTimeoutMs: Number(process.env.AIVA_GEN_TIMEOUT_MS || "240000") || 240000, // Eleven V3 có thể vài phút
  paceMs: Number(getArg("--pace", process.env.AIVA_PACE_MS || "1500")) || 1500,
};

// Giới hạn ký tự / 1 lần tạo theo model (đã kiểm chứng trên UI).
const CHAR_LIMITS = {
  omnivoice: 10000,
  "eleven v3": 1500,
  "eleven v2.5": 3000,
  "auto tts v1": 5000,
  "minimax v2.8 hd": 5000,
  "minimax v2.8 turbo": 10000,
  "minimax v2.6 hd": 3000,
  "minimax v2.6 turbo": 3000,
};

const round3 = (n) => Math.round((Number(n) || 0) * 1000) / 1000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rx = (s) => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");

function durationOf(buf, ext) {
  if (ext === "wav" && buf.length > 44 && buf.toString("ascii", 0, 4) === "RIFF") {
    const byteRate = buf.readUInt32LE(28);
    if (byteRate > 0) return round3((buf.length - 44) / byteRate);
  }
  // mp3 coi như CBR ~128kbps; dialogue:align sẽ dựng words[] từ audio thật.
  return round3((buf.length * 8) / (128 * 1000));
}
const extOf = (s) => (/\.wav(\?|#|$)/i.test(s || "") ? "wav" : "mp3");

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
let turns = doc.turns || [];
if (LIMIT) turns = turns.slice(0, LIMIT);

// Kiểm giới hạn ký tự TRƯỚC khi tốn credit.
const charLimit = CHAR_LIMITS[CONFIG.model.toLowerCase()] || 0;
if (charLimit) {
  const over = turns.filter((t) => (t.enTts || t.en || "").length > charLimit);
  if (over.length) {
    console.error(
      `Cac luot vuot gioi han ${charLimit} ky tu cua model "${CONFIG.model}": ` +
        over.map((t) => `d${t.id} (${(t.enTts || t.en).length})`).join(", ") +
        "\nCat ngan enTts/en hoac doi model co gioi han lon hon."
    );
    process.exit(1);
  }
}

// Rule: giọng trong .env/--voice-x LUÔN được ưu tiên, rồi mới tới aivaVoice
// trong dialogue.json (giống quy ước AISTUDIO_VOICE_*).
const voiceFor = (spk) =>
  CONFIG.voices[spk] ||
  (doc.speakers && doc.speakers[spk] && doc.speakers[spk].aivaVoice) ||
  "";

// =================== Playwright ===================

// Bấm ứng viên locator ĐẦU TIÊN đang hiển thị; hết ứng viên -> báo lỗi rõ ràng.
async function clickFirstVisible(cands, what, { optional = false } = {}) {
  for (const c of cands) {
    const el = c.first();
    if (await el.isVisible().catch(() => false)) {
      await el.click();
      return true;
    }
  }
  if (optional) return false;
  throw new Error(`Khong tim thay ${what} — UI co the da doi, chay --verbose va chinh selector trong script.`);
}

// Nghe response mạng, gom URL audio (player của trang nạp audio sau khi tạo xong).
function attachAudioListener(page) {
  const sniffed = [];
  page.on("response", (res) => {
    try {
      const url = res.url();
      const ct = String(res.headers()["content-type"] || "");
      if (res.status() !== 200) return;
      if (/^audio\//i.test(ct) || /\.(mp3|wav|m4a|ogg|aac)(\?|#|$)/i.test(url)) {
        if (!sniffed.includes(url)) {
          sniffed.push(url);
          if (VERBOSE) console.log(`  · bat audio: ${ct} ${url.slice(0, 120)}`);
        }
      }
    } catch {
      /* bỏ qua */
    }
  });
  return sniffed;
}

async function openStudio(page) {
  await page.goto(CONFIG.base + "/audio", { waitUntil: "domcontentloaded", timeout: 60000 });
  // Tab TTS ở sidebar (có thể đã mở sẵn).
  const tab = page.getByText(/Văn bản thành giọng/).first();
  if (await tab.isVisible().catch(() => false)) await tab.click().catch(() => {});
  // Chưa đăng nhập thì nút "Tạo Audio" không xuất hiện -> chờ (headed: tới 5 phút
  // cho người dùng đăng nhập tay trong cửa sổ; headless/CDP: 30s rồi báo lỗi).
  const ready = page.getByRole("button", { name: /Tạo Audio/i }).first();
  const ok = await ready
    .waitFor({ state: "visible", timeout: 15000 })
    .then(() => true)
    .catch(() => false);
  if (!ok) {
    console.log("⚠️  Chua thay man hinh TTS. Neu trang dang doi DANG NHAP, hay dang nhap trong cua so trinh duyet...");
    await ready.waitFor({ state: "visible", timeout: HEADLESS || CONFIG.cdp ? 30000 : 300000 }).catch(() => {
      throw new Error("Khong vao duoc AI Voice Studio (chua dang nhap?). Dung --cdp voi Chrome da dang nhap, hoac chay headed va dang nhap tay.");
    });
  }
}

async function selectProvider(page) {
  await clickFirstVisible(
    [
      page.getByRole("button", { name: CONFIG.provider, exact: true }),
      page.getByRole("button", { name: rx(CONFIG.provider) }),
      page.getByText(rx(CONFIG.provider)),
    ],
    `nut provider "${CONFIG.provider}"`
  );
  await sleep(800); // đổi provider -> panel & giọng reset
  if (VERBOSE) console.log(`  · provider: ${CONFIG.provider}`);
}

async function selectModel(page) {
  // Mở dropdown model (nút dưới label "Chọn model", thường hiển thị model hiện tại).
  await clickFirstVisible(
    [
      page.locator('div:has(> :text("Chọn model")) button'),
      page.locator('button:below(:text("Chọn model"))'),
      page.getByRole("button").filter({ hasText: /Omnivoice|Eleven|Minimax|Auto TTS/i }),
    ],
    'dropdown "Chọn model"'
  );
  await sleep(400);
  await clickFirstVisible(
    [
      page.getByRole("option", { name: rx(CONFIG.model) }),
      page.getByRole("button", { name: rx(CONFIG.model) }),
      page.getByText(rx(CONFIG.model)),
    ],
    `model "${CONFIG.model}"`
  );
  await sleep(400);
  if (VERBOSE) console.log(`  · model: ${CONFIG.model}`);
}

// Mở "Thư viện giọng", tìm theo từ khóa, bấm "Sử dụng" trên card khớp đầu tiên.
async function selectVoice(page, query, spk) {
  if (!query) {
    console.log(`  ! Speaker ${spk}: chua dat AIVA_VOICE_${spk}/aivaVoice -> DUNG GIONG PANEL DANG CHON (2 speaker de bi trung giong).`);
    return;
  }
  await clickFirstVisible(
    [
      page.getByRole("button", { name: "Chọn giọng" }),
      page.locator('div:has(> :text("Chọn giọng")) button'),
      page.locator('button:has-text("Chọn giọng")'),
      page.locator('button:below(:text("Chọn giọng"))'),
    ],
    'nut "Chọn giọng"'
  );
  const search = page.getByPlaceholder(/Tìm kiếm theo từ khóa|ID giọng nói/).first();
  await search.waitFor({ state: "visible", timeout: 10000 });
  await search.fill(query);
  await sleep(1200); // đợi danh sách lọc xong
  await clickFirstVisible(
    [
      // card giọng (khối bo góc) chứa từ khóa -> nút "Sử dụng" trong card
      page.locator("div.rounded-xl", { hasText: query }).first().getByRole("button", { name: "Sử dụng" }),
      // dự phòng: card có <h4> tên giọng
      page.locator("div", { has: page.locator("h4", { hasText: query }) }).last().getByRole("button", { name: "Sử dụng" }),
      // dự phòng cuối: nút "Sử dụng" đầu tiên còn lại sau khi lọc
      page.getByRole("button", { name: "Sử dụng" }),
    ],
    `nut "Sử dụng" cho giong "${query}" (giong phai KHOP provider ${CONFIG.provider})`
  );
  // Modal tự đóng, panel hiển thị giọng đã chọn.
  await search.waitFor({ state: "hidden", timeout: 8000 }).catch(() => {});
  await sleep(500);
  if (VERBOSE) console.log(`  · speaker ${spk}: giong "${query}"`);
}

// Đợi 1 lượt tạo xong: có URL audio mới (sniffer) / lỗi hiện ra / spinner tắt.
async function waitGenerated(page, sniffed, before) {
  const t0 = Date.now();
  let sawSpinner = false;
  while (Date.now() - t0 < CONFIG.genTimeoutMs) {
    if (sniffed.length > before) return;
    const err = page.getByText(/thất bại|lỗi/i).first();
    if (await err.isVisible().catch(() => false)) {
      const msg = ((await err.textContent().catch(() => "")) || "").trim().slice(0, 200);
      throw new Error(`Tao audio that bai: ${msg} (giong co khop provider/model khong?)`);
    }
    const spinning = await page.getByText(/Generating/i).first().isVisible().catch(() => false);
    if (spinning) sawSpinner = true;
    else if (sawSpinner) {
      // spinner vừa tắt -> chờ player nạp audio thêm chút rồi để fallback lo phần còn lại
      for (let i = 0; i < 12 && sniffed.length <= before; i++) await sleep(500);
      return;
    } else if (Date.now() - t0 > 30000) {
      return; // không thấy spinner (UI đổi chữ?) -> thử lấy audio bằng fallback
    }
    await sleep(800);
  }
  throw new Error(`Qua ${Math.round(CONFIG.genTimeoutMs / 1000)}s chua xong 1 luot — xem tab "Lịch sử" tren trang, hoac tang AIVA_GEN_TIMEOUT_MS.`);
}

// Lấy audio về buffer: (1) URL sniffer  (2) nút download dòng kết quả  (3) <audio src>.
async function fetchAudio(page, text, sniffed, before) {
  for (let i = sniffed.length - 1; i >= before; i--) {
    const resp = await page.context().request.get(sniffed[i]).catch(() => null);
    if (resp && resp.ok()) return { buf: Buffer.from(await resp.body()), ext: extOf(sniffed[i]) };
  }
  // (2) hover dòng kết quả chứa đầu câu -> CHỈ bấm nút có tên Tải/Download (tránh nút xoá)
  const row = page.locator("div", { hasText: text.slice(0, 30) }).last();
  await row.hover().catch(() => {});
  const dlBtn = row.getByRole("button", { name: /tải|download/i }).first();
  if (await dlBtn.isVisible().catch(() => false)) {
    try {
      const [download] = await Promise.all([page.waitForEvent("download", { timeout: 20000 }), dlBtn.click()]);
      const tmp = await download.path();
      return { buf: readFileSync(tmp), ext: extOf(download.suggestedFilename()) };
    } catch (e) {
      if (VERBOSE) console.log("  · download event truot:", e.message);
    }
  }
  // (3) thẻ <audio> mới nhất trên trang
  const src = await page.locator("audio").last().getAttribute("src").catch(() => null);
  if (src && !src.startsWith("blob:")) {
    const abs = new URL(src, page.url()).href;
    const resp = await page.context().request.get(abs).catch(() => null);
    if (resp && resp.ok()) return { buf: Buffer.from(await resp.body()), ext: extOf(abs) };
  }
  throw new Error("Khong lay duoc file audio (sniffer/nut tai/the <audio> deu truot). Chay --verbose de do UI.");
}

async function generateOne(page, sniffed, text) {
  const box = page.getByPlaceholder(/Nhập kịch bản/).first();
  await box.waitFor({ state: "visible", timeout: 15000 });
  await box.click();
  await box.fill(text);
  const before = sniffed.length; // mốc: chỉ nhận audio xuất hiện SAU khi bấm tạo
  await page.getByRole("button", { name: /Tạo Audio/i }).first().click();
  await waitGenerated(page, sniffed, before);
  return fetchAudio(page, text, sniffed, before);
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
  const cdpMode = !!CONFIG.cdp;
  if (cdpMode) {
    const ep = /^https?:|^ws:/.test(CONFIG.cdp) ? CONFIG.cdp : `http://127.0.0.1:${CONFIG.cdp}`;
    console.log(`Gan vao Chrome qua CDP: ${ep}`);
    browser = await chromium.connectOverCDP(ep);
    context = browser.contexts()[0] || (await browser.newContext());
  } else {
    mkdirSync(CONFIG.profileDir, { recursive: true });
    // channel "chrome" -> dùng Chrome đã cài (khỏi tải Chromium); fallback Chromium.
    const opts = { headless: HEADLESS, viewport: { width: 1440, height: 900 }, acceptDownloads: true };
    try {
      context = await chromium.launchPersistentContext(CONFIG.profileDir, { ...opts, channel: "chrome" });
    } catch {
      context = await chromium.launchPersistentContext(CONFIG.profileDir, opts);
    }
  }

  const page =
    context.pages().find((p) => p.url().includes("aivideoauto.com")) || context.pages()[0] || (await context.newPage());
  const sniffed = attachAudioListener(page);

  try {
    await openStudio(page);
    await selectProvider(page);
    await selectModel(page);

    // Gom lượt theo speaker để mỗi giọng chỉ phải chọn 1 lần (thứ tự lượt không
    // quan trọng — mỗi lượt là 1 file d<id> độc lập).
    const speakerKeys = [...new Set(turns.map((t) => t.speaker))];
    let made = 0;
    let skipped = 0;
    for (const spk of speakerKeys) {
      // RESUME: bỏ qua lượt đã có file + duration hợp lệ (trừ khi --fresh).
      const pending = turns.filter(
        (t) =>
          t.speaker === spk &&
          (FRESH || !(t.audio && t.durationInSec > 0 && existsSync(resolve(ROOT, "public", t.audio))))
      );
      skipped += turns.filter((t) => t.speaker === spk).length - pending.length;
      if (!pending.length) continue;

      console.log(`\n== Speaker ${spk} (${pending.length} luot${voiceFor(spk) ? `, giong "${voiceFor(spk)}"` : ""}) ==`);
      await selectVoice(page, voiceFor(spk), spk);

      for (const turn of pending) {
        const text = turn.enTts || turn.en; // enTts (tag cảm xúc) ưu tiên; giữ turn.en sạch cho .srt
        const { buf, ext } = await generateOne(page, sniffed, text);
        const rel = audioRel(turn.id, ext);
        writeFileSync(resolve(ROOT, "public", rel), buf);

        turn.audio = rel;
        turn.durationInSec = durationOf(buf, ext);
        turn.words = []; // chạy dialogue:align (Whisper) để lấy mốc từng từ
        made++;
        // Lưu dần sau từng lượt — lỗi giữa chừng không mất tiến độ (credit là tiền thật).
        writeFileSync(dataPath, JSON.stringify(doc, null, 2), "utf8");
        console.log(`d${turn.id}.${ext}  [${spk}]  ~${turn.durationInSec}s  (${made} moi${skipped ? `, ${skipped} bo qua` : ""})`);
        await sleep(CONFIG.paceMs);
      }
    }

    writeFileSync(dataPath, JSON.stringify(doc, null, 2), "utf8");
    console.log(`\nDa cap nhat ${dataRel} (audio tu aivideoauto ${CONFIG.provider}/${CONFIG.model}; ${made} moi, ${skipped} bo qua).`);
    console.log("Tiep theo: chay Whisper de co karaoke ->  npm run dialogue:align -- --data " + dataRel);
  } finally {
    await closeBrowser(context, browser, cdpMode);
  }
}

main().catch((e) => {
  console.error(e?.stack || e?.message || e);
  process.exit(1);
});
