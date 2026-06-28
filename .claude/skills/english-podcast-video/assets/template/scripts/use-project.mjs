/**
 * Nạp dữ liệu NGUỒN của một project vào data/ để Remotion render.
 *
 * Vì Remotion import TĨNH data/dialogue.json + data/script.json lúc bundle, render
 * luôn đọc ở data/. Trong pipeline mới, NGUỒN THẬT nằm ở projects/<id>/dialogue.json
 * (và script.json nếu là định dạng câu đơn) — data/ chỉ là VÙNG ĐỆM render, giống
 * public/audio hay out/. Lệnh này copy file nguồn của project sang data/ ngay
 * trước khi render.
 *
 * Dùng:  node scripts/use-project.mjs <id>
 *        npm run --silent project:use -- <id>
 */
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const id = process.argv[2];
if (!id) {
  console.error("Cần <id>. Dùng: node scripts/use-project.mjs <id>");
  process.exit(1);
}

const proj = resolve(ROOT, "projects", id);
if (!existsSync(proj)) {
  console.error("Khong thay project: projects/" + id);
  process.exit(1);
}

mkdirSync(resolve(ROOT, "data"), { recursive: true });

let copied = 0;
for (const name of ["dialogue.json", "script.json"]) {
  const src = join(proj, name);
  if (existsSync(src)) {
    copyFileSync(src, resolve(ROOT, "data", name));
    console.log("data/" + name + "  <-  projects/" + id + "/" + name);
    copied++;
  }
}

if (!copied) {
  console.error("Khong tim thay dialogue.json/script.json trong projects/" + id);
  process.exit(1);
}

console.log("Da nap project '" + id + "' vao data/. Gio render duoc roi.");
