/**
 * Ghép một đoạn INTRO (và tuỳ chọn OUTRO) có sẵn vào video đã render.
 *
 * Chuẩn hoá mọi đoạn về cùng độ phân giải/fps/SAR/định dạng + audio 48k stereo
 * rồi nối bằng ffmpeg (concat filter) để không lệch tiếng/hình. Nếu intro/outro
 * không có audio, tự chèn track im lặng cho khớp.
 *
 * Cần ffmpeg + ffprobe trong PATH.
 *
 * Cách dùng:
 *   # theo project (tự lấy file landscape trong project.json):
 *   node scripts/add-intro.mjs --id <project_id> --intro public/intro.mp4
 *   # hoặc chỉ định thẳng file video:
 *   node scripts/add-intro.mjs --video projects/<id>/abc.mp4 --intro public/intro.mp4
 *   # tuỳ chọn: --outro public/outro.mp4 | --out <path> | --replace | --shorts
 *
 *   npm run video:intro -- --id <project_id> --intro public/intro.mp4
 */
import { existsSync, readFileSync, renameSync } from "node:fs";
import { resolve, dirname, join, basename, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const argv = process.argv.slice(2);
const has = (n) => argv.includes(n);
const getArg = (n, d) => {
  const i = argv.indexOf(n);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};

const id = getArg("--id", "");
let videoRel = getArg("--video", "");
const introRel = getArg("--intro", "public/intro.mp4");
const outroRel = getArg("--outro", "");
const wantShorts = has("--shorts");
const replace = has("--replace");
let outRel = getArg("--out", "");

// Giải quyết video đích.
if (!videoRel) {
  if (!id) {
    console.error("Can --video <path> hoac --id <project_id>.");
    process.exit(1);
  }
  const pj = resolve(ROOT, "projects", id, "project.json");
  if (!existsSync(pj)) {
    console.error("Khong thay projects/" + id + "/project.json. Chay project:finalize truoc, hoac dung --video.");
    process.exit(1);
  }
  const meta = JSON.parse(readFileSync(pj, "utf8"));
  const f = wantShorts ? meta.files?.shorts : meta.files?.landscape;
  if (!f) {
    console.error("Khong thay file " + (wantShorts ? "shorts" : "landscape") + " trong project.json.");
    process.exit(1);
  }
  videoRel = join("projects", id, f);
}

const videoPath = resolve(ROOT, videoRel);
const introPath = resolve(ROOT, introRel);
if (!existsSync(videoPath)) {
  console.error("Khong thay video: " + videoRel);
  process.exit(1);
}
if (!existsSync(introPath)) {
  console.error("Khong thay intro: " + introRel + " (dat file intro vao day hoac dung --intro).");
  process.exit(1);
}
const outroPath = outroRel ? resolve(ROOT, outroRel) : "";
if (outroRel && !existsSync(outroPath)) {
  console.error("Khong thay outro: " + outroRel);
  process.exit(1);
}

// ffprobe helpers
function probe(p) {
  const out = execFileSync(
    "ffprobe",
    ["-v", "error", "-print_format", "json", "-show_streams", "-show_format", p],
    { encoding: "utf8" }
  );
  const j = JSON.parse(out);
  const v = (j.streams || []).find((s) => s.codec_type === "video");
  const a = (j.streams || []).find((s) => s.codec_type === "audio");
  return {
    width: v ? Number(v.width) : 0,
    height: v ? Number(v.height) : 0,
    fps: v ? v.r_frame_rate : "30/1",
    hasAudio: !!a,
    duration: Number(j.format?.duration || 0),
  };
}

const main = probe(videoPath);
const W = main.width || 1920;
const H = main.height || 1080;
const FPS = main.fps || "30/1";
console.log(`Video dich: ${videoRel}  (${W}x${H} @ ${FPS})`);

// Thứ tự đoạn: intro -> main -> outro?
const segs = [
  { path: introPath, label: "intro", ...probe(introPath) },
  { path: videoPath, label: "main", ...main },
];
if (outroPath) segs.push({ path: outroPath, label: "outro", ...probe(outroPath) });

// Build ffmpeg inputs + filter_complex.
const inputs = [];
for (const s of segs) inputs.push("-i", s.path);

// Mỗi đoạn thiếu audio -> thêm 1 input anullsrc dài bằng đoạn đó.
const silentInputs = [];
segs.forEach((s, i) => {
  if (!s.hasAudio) {
    s.silentIdx = segs.length + silentInputs.length;
    silentInputs.push("-f", "lavfi", "-t", String(s.duration || 1), "-i", "anullsrc=channel_layout=stereo:sample_rate=48000");
  }
});
inputs.push(...silentInputs);

const vparts = [];
const aparts = [];
const concatIns = [];
segs.forEach((s, i) => {
  vparts.push(
    `[${i}:v]scale=${W}:${H}:force_original_aspect_ratio=decrease,` +
      `pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,fps=${FPS},format=yuv420p[v${i}]`
  );
  const aIdx = s.hasAudio ? `${i}:a` : `${s.silentIdx}:a`;
  aparts.push(`[${aIdx}]aresample=48000,aformat=sample_rates=48000:channel_layouts=stereo[a${i}]`);
  concatIns.push(`[v${i}][a${i}]`);
});
const filter = `${vparts.join(";")};${aparts.join(";")};${concatIns.join("")}concat=n=${segs.length}:v=1:a=1[v][a]`;

// File ra.
const stem = basename(videoPath, extname(videoPath));
const dir = dirname(videoPath);
const finalOut = outRel
  ? resolve(ROOT, outRel)
  : replace
    ? join(dir, stem + ".__tmp__.mp4")
    : join(dir, stem + "-with-intro.mp4");

const args = [
  "-y",
  ...inputs,
  "-filter_complex",
  filter,
  "-map",
  "[v]",
  "-map",
  "[a]",
  "-c:v",
  "libx264",
  "-crf",
  "18",
  "-preset",
  "medium",
  "-pix_fmt",
  "yuv420p",
  "-c:a",
  "aac",
  "-b:a",
  "192k",
  "-movflags",
  "+faststart",
  finalOut,
];

console.log(
  `Ghep: ${segs.map((s) => s.label + (s.hasAudio ? "" : "(silent)")).join(" + ")}  -> ${
    replace ? videoRel + " (ghi de)" : (outRel || stem + "-with-intro.mp4")
  }`
);
execFileSync("ffmpeg", args, { stdio: "inherit" });

if (replace) {
  renameSync(finalOut, videoPath);
  console.log("Xong. Da ghi de: " + videoRel);
} else {
  console.log("Xong. File ket qua: " + (outRel || join(dir, stem + "-with-intro.mp4").replace(ROOT + "\\", "").replace(ROOT + "/", "")));
}
