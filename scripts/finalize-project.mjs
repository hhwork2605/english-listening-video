/**
 * Gom tất cả tài nguyên + kết quả của một video vào projects/<id>/ để mỗi video
 * là một folder độc lập, đầy đủ (có thể lưu trữ / render lại sau).
 *
 * Dùng:  node scripts/finalize-project.mjs <id>
 *
 * Giả định trước khi gọi: đã render vào projects/<id>/ (podcast.mp4, thumbnail.png…),
 * dialogue.json NGUỒN nằm ở projects/<id>/dialogue.json, và các file làm việc ở:
 *   public/backgrounds/scene.png, public/thumbnails/scene.png, public/audio/d*.wav
 * Script gom ảnh/audio + tạo .srt/metadata vào projects/<id>/ và ghi project.json.
 */
import {
  mkdirSync,
  copyFileSync,
  existsSync,
  writeFileSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
} from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const id = process.argv[2];
if (!id) {
  console.error("Cần <id>. Dùng: node scripts/finalize-project.mjs <id> [tu-khoa]");
  process.exit(1);
}

// Slug tiếng Anh không dấu, nối bằng gạch ngang (đặt tên file kết quả cho SEO).
const slugify = (s) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

// Định dạng mốc thời gian SRT: HH:MM:SS,mmm
const srtTime = (sec) => {
  const ms = Math.max(0, Math.round(sec * 1000));
  const p = (n, l = 2) => String(n).padStart(l, "0");
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor((ms % 3600000) / 60000))}:${p(Math.floor((ms % 60000) / 1000))},${p(ms % 1000, 3)}`;
};

const proj = resolve(ROOT, "projects", id);
mkdirSync(proj, { recursive: true });

const copy = (src, dst) => {
  if (existsSync(src)) {
    copyFileSync(src, dst);
    return true;
  }
  return false;
};

const meta = { id, createdAt: new Date().toISOString() };

// Nguồn dialogue = file trong project (nguồn thật của pipeline). Fallback
// data/dialogue.json cho project cũ chưa có file riêng (copy vào project luôn).
let dialoguePath = join(proj, "dialogue.json");
if (!existsSync(dialoguePath)) {
  const legacy = resolve(ROOT, "data", "dialogue.json");
  if (existsSync(legacy)) copyFileSync(legacy, dialoguePath);
}
let doc = null;
if (existsSync(dialoguePath)) {
  try {
    doc = JSON.parse(readFileSync(dialoguePath, "utf-8").replace(/^﻿/, ""));
    meta.title = doc.title;
    meta.topic = doc.topic;
    meta.level = doc.level;
    meta.turns = doc.turns?.length ?? 0;
    if (doc.youtubeTitle) meta.youtubeTitle = doc.youtubeTitle;
    if (doc.youtubeDescription) meta.youtubeDescription = doc.youtubeDescription;
    if (Array.isArray(doc.tags)) meta.tags = doc.tags;
  } catch {}
}

copy(resolve(ROOT, "public", "backgrounds", "scene.png"), join(proj, "background.png"));
copy(resolve(ROOT, "public", "backgrounds", "scene-vertical.png"), join(proj, "background-vertical.png"));
copy(resolve(ROOT, "public", "thumbnails", "scene.png"), join(proj, "thumbnail-bg.png"));

// Chỉ copy đúng các file audio mà dialogue dùng (tránh ôm wav thừa từ video trước).
if (doc?.turns?.length) {
  const adst = join(proj, "audio");
  mkdirSync(adst, { recursive: true });
  for (const turn of doc.turns) {
    if (!turn.audio) continue;
    const src = resolve(ROOT, "public", turn.audio);
    if (existsSync(src)) copyFileSync(src, join(adst, turn.audio.split("/").pop()));
  }
}

// Đổi tên file kết quả sang từ khóa tiếng Anh không dấu (truyền tay hoặc lấy từ
// chủ đề + cấp độ). Vd "talking-about-animals-b1.mp4".
const keyword = process.argv[3];
const base =
  slugify(keyword) || slugify(`${meta.topic || "english-podcast"} ${meta.level || ""}`) || "english-podcast";

const ren = (from, to) => {
  const f = join(proj, from);
  if (existsSync(f) && from !== to) renameSync(f, join(proj, to));
};
ren("podcast.mp4", `${base}.mp4`);
ren("podcast-portrait.mp4", `${base}-shorts.mp4`);
ren("thumbnail.png", `${base}-thumbnail.png`);
meta.slug = base;
meta.files = {
  landscape: `${base}.mp4`,
  shorts: `${base}-shorts.mp4`,
  thumbnail: `${base}-thumbnail.png`,
};

// Phụ đề mềm .srt — timestamp TUYỆT ĐỐI theo timeline video (khớp Series của
// Remotion: mỗi lượt = (durationInSec + pauseAfterSec) frame). Mỗi lượt 1 cue.
if (doc?.turns?.length) {
  const fps = doc.fps || 30;
  // Video final có thể ĐÃ GHÉP INTRO ở đầu (video:intro --replace chạy trước
  // finalize) -> mọi cue phải dịch thêm đúng độ dài intro. Suy offset = duration
  // video thật (ffprobe) - duration timeline dialogue; gap > 0.5s coi như intro.
  let offsetSec = 0;
  try {
    const vf = join(proj, meta.files.landscape);
    if (existsSync(vf)) {
      const vd = parseFloat(
        execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", vf]).toString()
      );
      const timelineFrames = doc.turns.reduce(
        (s, t) =>
          s + Math.max(1, Math.round((Math.max(0.3, t.durationInSec || 0) + (t.pauseAfterSec || 0)) * fps)),
        0
      );
      const gap = vd - timelineFrames / fps;
      if (Number.isFinite(gap) && gap > 0.5) {
        offsetSec = gap;
        console.log(`SRT: dich moi cue +${gap.toFixed(2)}s (video co intro o dau).`);
      }
    }
  } catch {
    /* không có ffprobe -> giữ offset 0 */
  }
  const offF = Math.round(offsetSec * fps);
  let acc = 0; // frame tích lũy
  const cues = [];
  doc.turns.forEach((turn, i) => {
    const dur = Math.max(0.3, turn.durationInSec || 0);
    const turnFrames = Math.max(1, Math.round((dur + (turn.pauseAfterSec || 0)) * fps));
    const lead = turn.words?.[0]?.startSec ?? 0;
    const startF = offF + acc + Math.round(lead * fps);
    const endF = offF + acc + Math.round(dur * fps);
    cues.push(`${i + 1}\n${srtTime(startF / fps)} --> ${srtTime(endF / fps)}\n${turn.en}\n`);
    acc += turnFrames;
  });
  writeFileSync(join(proj, `${base}.srt`), cues.join("\n"), "utf-8");
  meta.files.subtitles = `${base}.srt`;
}

// Dọn file props tạm để folder gọn (chỉ là input render).
for (const f of readdirSync(proj)) {
  if (f.endsWith(".props.json")) rmSync(join(proj, f), { force: true });
}

// Metadata YouTube gộp vào MỘT file duy nhất, chia rõ 3 phần cho dễ copy khi upload.
if (meta.youtubeTitle || meta.youtubeDescription || meta.tags?.length) {
  const sections = [];
  if (meta.youtubeTitle) {
    sections.push("===== TITLE =====\n" + meta.youtubeTitle);
  }
  if (meta.youtubeDescription) {
    sections.push("===== DESCRIPTION =====\n" + meta.youtubeDescription);
  }
  if (meta.tags?.length) {
    sections.push("===== TAGS =====\n" + meta.tags.join(", "));
  }
  writeFileSync(join(proj, "youtube-metadata.txt"), sections.join("\n\n") + "\n");
}

writeFileSync(join(proj, "project.json"), JSON.stringify(meta, null, 2));

console.log("Da gom vao projects/" + id + " (ten file: " + base + "):");
if (meta.youtubeTitle) console.log("Tieu de YouTube: " + meta.youtubeTitle);
for (const f of readdirSync(proj)) console.log("  " + f);
