/**
 * Tra cứu TỪ KHÓA ĐANG ĐƯỢC TÌM NHIỀU quanh một chủ đề — cho agent metadata
 * (youtube-metadata-writer / reel-metadata-writer) dùng TRƯỚC khi viết
 * title/description/tags/fileKeywords.
 *
 * Nguồn: autocomplete/suggest CÔNG KHAI, miễn phí, không cần API key:
 *   - YouTube suggest (ds=yt) — phản ánh người dùng YOUTUBE đang gõ tìm gì
 *   - Google suggest          — phản ánh tìm kiếm Google
 * Autocomplete chỉ hiện query đủ phổ biến → mọi cụm trả về đều có search volume thật.
 *
 * Cách dùng:
 *   node scripts/keyword-suggest.mjs --topic "coffee shop" --level A2
 *   node scripts/keyword-suggest.mjs --topic "money habits" --level B1-B2 --format podcast
 *   node scripts/keyword-suggest.mjs --topic "break the ice" --format shorts --max 25
 *   npm run keywords -- --topic "hotel" --level A2 --format shorts
 *
 * Tham số:
 *   --topic  <cụm>   (bắt buộc) chủ đề/tình huống, tiếng Anh
 *   --level  <CEFR>  (tuỳ chọn) A1/A2/B1/B1-B2/B2/C1 — sinh thêm seed theo level
 *   --format <s>     (tuỳ chọn) podcast | shorts — thêm seed đặc thù định dạng
 *   --gl     <cc>    (tuỳ chọn) mã nước, mặc định "us" (thêm: --gl us,au)
 *   --max    <n>     (tuỳ chọn) số cụm in ra, mặc định 30
 *   --seeds-only     chỉ in danh sách seed (debug)
 *
 * Đầu ra: JSON { keywords: [{phrase, score, sources}], seeds } — score cao =
 * xuất hiện ở nhiều seed/nguồn + đứng đầu danh sách suggest (phổ biến hơn).
 */

const argv = process.argv.slice(2);
const getArg = (n, d) => {
  const i = argv.indexOf(n);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};

const TOPIC = (getArg("--topic", "") || "").trim().toLowerCase();
if (!TOPIC) {
  console.error('LỖI: thiếu --topic "<chủ đề tiếng Anh>" (vd --topic "coffee shop")');
  process.exit(1);
}
const LEVEL = (getArg("--level", "") || "").trim().toLowerCase(); // vd "a2", "b1-b2"
const FORMAT = (getArg("--format", "podcast") || "").trim().toLowerCase();
const GLS = (getArg("--gl", "us") || "us").split(",").map((s) => s.trim()).filter(Boolean);
const MAX = Number(getArg("--max", "30")) || 30;

// --- dựng seed quanh chủ đề ---
const seeds = new Set([
  TOPIC,
  `${TOPIC} english`,
  `english ${TOPIC}`,
  `learn english ${TOPIC}`,
  `${TOPIC} in english`,
  `english conversation ${TOPIC}`,
  `${TOPIC} english conversation`,
]);
if (LEVEL) {
  const lv = LEVEL.split("-")[0]; // "b1-b2" -> "b1"
  seeds.add(`${lv} english ${TOPIC}`);
  seeds.add(`english ${TOPIC} for ${lv}`);
  seeds.add(`${lv} english conversation`);
}
if (FORMAT === "shorts") {
  seeds.add(`${TOPIC} english shorts`);
  seeds.add(`english speaking practice ${TOPIC}`);
} else {
  seeds.add(`english podcast ${TOPIC}`);
  seeds.add(`english listening practice ${TOPIC}`);
}

if (argv.includes("--seeds-only")) {
  console.log(JSON.stringify({ seeds: [...seeds] }, null, 2));
  process.exit(0);
}

// --- gọi suggest ---
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// client=firefox trả JSON sạch: ["query",["s1","s2",...],...]; ds=yt = YouTube.
async function suggest(q, { yt, gl }) {
  const url =
    "https://suggestqueries.google.com/complete/search?client=firefox" +
    (yt ? "&ds=yt" : "") +
    `&hl=en&gl=${encodeURIComponent(gl)}&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(`suggest HTTP ${res.status}`);
  // đôi khi trả latin1 → đọc buffer rồi decode utf8 best-effort
  const body = Buffer.from(await res.arrayBuffer()).toString("utf8");
  const arr = JSON.parse(body);
  return Array.isArray(arr?.[1]) ? arr[1].map((s) => String(s).toLowerCase()) : [];
}

const scores = new Map(); // phrase -> { score, sources:Set }
function addResults(list, source, weight) {
  list.forEach((phrase, idx) => {
    const p = phrase.trim();
    if (!p || p === TOPIC) return;
    const posBoost = Math.max(0, 10 - idx) / 10; // đứng đầu suggest = phổ biến hơn
    const cur = scores.get(p) || { score: 0, sources: new Set() };
    cur.score += weight * (1 + posBoost);
    cur.sources.add(source);
    scores.set(p, cur);
  });
}

let calls = 0;
for (const seed of seeds) {
  for (const gl of GLS) {
    // YouTube trọng số cao hơn (đích là SEO YouTube), Google bổ trợ.
    try { addResults(await suggest(seed, { yt: true, gl }), `yt-${gl}`, 2); } catch {}
    await sleep(120);
    try { addResults(await suggest(seed, { yt: false, gl }), `g-${gl}`, 1); } catch {}
    await sleep(120);
    calls += 2;
  }
}

const keywords = [...scores.entries()]
  .map(([phrase, v]) => ({ phrase, score: Math.round(v.score * 10) / 10, sources: [...v.sources] }))
  .sort((a, b) => b.score - a.score)
  .slice(0, MAX);

console.log(JSON.stringify({ topic: TOPIC, level: LEVEL || null, format: FORMAT, gl: GLS, calls, keywords }, null, 2));
if (!keywords.length) {
  console.error("Không có kết quả — mạng chặn suggestqueries.google.com? Thử lại hoặc bỏ qua bước tra từ khóa.");
  process.exit(2);
}
