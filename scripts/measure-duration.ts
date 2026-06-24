/**
 * Đọc độ dài thực tế của từng file audio trong public/ và cập nhật
 * trường durationInSec trong data/script.json. Dùng @remotion/media-parser
 * (thuần JS, không cần cài ffmpeg).
 *
 * Cách dùng:  npm run measure
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseMedia } from "@remotion/media-parser";
import { nodeReader } from "@remotion/media-parser/node";
import type { Script } from "../src/types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT_PATH = resolve(__dirname, "../data/script.json");
const PUBLIC_DIR = resolve(__dirname, "../public");

async function main() {
  const script = JSON.parse(readFileSync(SCRIPT_PATH, "utf8")) as Script;
  let updated = 0;

  for (const item of script.items) {
    if (!item.audio) continue;
    const filePath = resolve(PUBLIC_DIR, item.audio);
    if (!existsSync(filePath)) {
      console.warn(`Chưa có file: ${item.audio} (giữ nguyên durationInSec)`);
      continue;
    }
    const { durationInSeconds } = await parseMedia({
      src: filePath,
      fields: { durationInSeconds: true },
      reader: nodeReader,
    });
    if (durationInSeconds) {
      item.durationInSec = Math.round(durationInSeconds * 100) / 100;
      updated++;
      console.log(`${item.id}.mp3 -> ${item.durationInSec}s`);
    }
  }

  writeFileSync(SCRIPT_PATH, JSON.stringify(script, null, 2), "utf8");
  console.log(`Đã cập nhật ${updated} file. Sẵn sàng render.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
