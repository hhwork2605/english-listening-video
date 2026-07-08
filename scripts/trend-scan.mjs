/**
 * Quét TÍN HIỆU TREND trên YouTube cho việc chọn chủ đề + viết metadata —
 * bổ trợ cho keyword-suggest.mjs (autocomplete chỉ cho TỪ KHÓA; script này cho
 * biết CHỦ ĐỀ/TITLE nào đang thật sự ăn khách).
 *
 * CẦN trong .env (gốc):  YT_API_KEY  — API key YouTube Data API v3
 *   (Google Cloud Console → tạo project → Enable "YouTube Data API v3" →
 *    Credentials → API key. Miễn phí 10.000 units/ngày.)
 *
 * Cách dùng:
 *   node scripts/trend-scan.mjs competitors [--days 90] [--max 25] [--shorts|--long]
 *       Đào video MỚI của các kênh cùng niche (assets/competitor-channels.json),
 *       xếp theo view/ngày → chủ đề + công thức title đang thắng. RẺ (~2-3 units/kênh).
 *   node scripts/trend-scan.mjs search --topic "ordering coffee" [--days 180] [--gl US] [--max 15]
 *       Video nổi nhất quanh một từ khóa, đăng gần đây. TỐN search bucket
 *       (~100 call/ngày, tách khỏi 10k units) → gọi CÓ CHỌN LỌC.
 *   node scripts/trend-scan.mjs trending [--gl US] [--max 15]
 *       Trending chung theo nước (ít giá trị niche, gần như free — 1 unit).
 *
 *   npm run trends -- competitors
 *
 * Đầu ra: JSON { mode, items: [{title, channel, url, views, viewsPerDay,
 * publishedAt, durationSec, isShort}], errors } — agent metadata/skill đọc để
 * mô phỏng CÔNG THỨC title (không copy nguyên văn) + chọn chủ đề chưa làm.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// --- nạp .env ---
const envPath = resolve(ROOT, ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const argv = process.argv.slice(2);
const MODE = (argv[0] || "").toLowerCase();
const getArg = (n, d) => {
  const i = argv.indexOf(n);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};
const has = (n) => argv.includes(n);

const KEY = getArg("--key", process.env.YT_API_KEY || "");
if (!["competitors", "search", "trending"].includes(MODE)) {
  console.error("Dùng: node scripts/trend-scan.mjs <competitors|search|trending> [tham số] (xem đầu file)");
  process.exit(1);
}
if (!KEY) {
  console.error(
    "LỖI: thiếu YT_API_KEY trong .env (hoặc --key). Tạo miễn phí: Google Cloud Console → Enable 'YouTube Data API v3' → Credentials → API key."
  );
  process.exit(1);
}

const DAYS = Number(getArg("--days", MODE === "search" ? "180" : "90")) || 90;
const MAX = Number(getArg("--max", MODE === "competitors" ? "25" : "15")) || 15;
const GL = (getArg("--gl", "US") || "US").toUpperCase();
const cutoff = new Date(Date.now() - DAYS * 86400e3);

const api = async (path, params) => {
  const u = new URL(`https://www.googleapis.com/youtube/v3/${path}`);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  u.searchParams.set("key", KEY);
  const r = await fetch(u);
  const j = await r.json();
  if (!r.ok) {
    const msg = j?.error?.message || r.statusText;
    throw new Error(`${path}: HTTP ${r.status} — ${msg}`);
  }
  return j;
};

// ISO8601 duration "PT1M15S" -> giây
const durSec = (s) => {
  const m = String(s || "").match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  return m ? (Number(m[1]) || 0) * 3600 + (Number(m[2]) || 0) * 60 + (Number(m[3]) || 0) : 0;
};

const toItem = (v) => {
  const views = Number(v.statistics?.viewCount || 0);
  const pub = new Date(v.snippet.publishedAt);
  const days = Math.max(1, (Date.now() - pub.getTime()) / 86400e3);
  const d = durSec(v.contentDetails?.duration);
  return {
    title: v.snippet.title,
    channel: v.snippet.channelTitle,
    url: `https://youtu.be/${v.id}`,
    views,
    viewsPerDay: Math.round(views / days),
    publishedAt: v.snippet.publishedAt.slice(0, 10),
    durationSec: d,
    isShort: d > 0 && d <= 75,
  };
};

// videos.list theo lô 50 id (1 unit/lô)
const videosByIds = async (ids) => {
  const out = [];
  for (let i = 0; i < ids.length; i += 50) {
    const j = await api("videos", {
      part: "snippet,statistics,contentDetails",
      id: ids.slice(i, i + 50).join(","),
      maxResults: "50",
    });
    out.push(...(j.items || []));
  }
  return out;
};

const errors = [];
let items = [];

try {
if (MODE === "competitors") {
  const cfgPath = resolve(ROOT, "assets", "competitor-channels.json");
  if (!existsSync(cfgPath)) {
    console.error("LỖI: thiếu assets/competitor-channels.json");
    process.exit(1);
  }
  const channels = JSON.parse(readFileSync(cfgPath, "utf8").replace(/^﻿/, "")).channels || [];
  for (const ch of channels) {
    try {
      // handle/channelId -> uploads playlist (UU…)
      const params = ch.channelId
        ? { part: "contentDetails,snippet", id: ch.channelId }
        : { part: "contentDetails,snippet", forHandle: ch.handle };
      const cj = await api("channels", params);
      const c = cj.items?.[0];
      if (!c) {
        errors.push(`${ch.name}: không resolve được (handle "${ch.handle || ""}" sai? — sửa trong assets/competitor-channels.json)`);
        continue;
      }
      const uploads = c.contentDetails.relatedPlaylists.uploads;
      const pj = await api("playlistItems", { part: "contentDetails", playlistId: uploads, maxResults: "50" });
      const ids = (pj.items || [])
        .filter((it) => new Date(it.contentDetails.videoPublishedAt || 0) >= cutoff)
        .map((it) => it.contentDetails.videoId);
      if (!ids.length) {
        errors.push(`${ch.name}: không có video mới trong ${DAYS} ngày`);
        continue;
      }
      items.push(...(await videosByIds(ids)).map(toItem));
    } catch (e) {
      errors.push(`${ch.name}: ${e.message}`);
    }
  }
} else if (MODE === "search") {
  const topic = (getArg("--topic", "") || "").trim();
  if (!topic) {
    console.error('LỖI: search cần --topic "<từ khóa tiếng Anh>"');
    process.exit(1);
  }
  console.error("Chú ý: search.list dùng bucket riêng ~100 call/ngày — gọi có chọn lọc.");
  const sj = await api("search", {
    part: "id",
    q: topic,
    type: "video",
    order: "viewCount",
    publishedAfter: cutoff.toISOString(),
    regionCode: GL,
    relevanceLanguage: "en",
    maxResults: String(Math.min(50, MAX * 2)),
  });
  const ids = (sj.items || []).map((it) => it.id.videoId).filter(Boolean);
  items = (await videosByIds(ids)).map(toItem);
} else {
  const tj = await api("videos", {
    part: "snippet,statistics,contentDetails",
    chart: "mostPopular",
    regionCode: GL,
    maxResults: String(Math.min(50, MAX)),
  });
  items = (tj.items || []).map(toItem);
}
} catch (e) {
  console.error("LỖI API: " + e.message);
  console.error("Kiểm tra: key đúng chưa, project đã Enable 'YouTube Data API v3' chưa, còn quota không.");
  process.exit(1);
}

// Lọc theo định dạng nếu yêu cầu, xếp theo sức nóng (view/ngày).
if (has("--shorts")) items = items.filter((x) => x.isShort);
if (has("--long")) items = items.filter((x) => !x.isShort);
items.sort((a, b) => b.viewsPerDay - a.viewsPerDay);
items = items.slice(0, MAX);

console.log(
  JSON.stringify(
    {
      mode: MODE,
      windowDays: DAYS,
      note: "Xếp theo viewsPerDay. Dùng để MÔ PHỎNG công thức title + chọn chủ đề — KHÔNG copy title nguyên văn.",
      items,
      errors,
    },
    null,
    2
  )
);
