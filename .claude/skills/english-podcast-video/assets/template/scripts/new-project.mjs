/**
 * Tạo một project folder mới theo dạng `tenchude_thoigian` và in ra id.
 *
 * Dùng:  node scripts/new-project.mjs "Talking About Animals"
 * In ra (stdout) đúng một dòng = id, vd: talking-about-animals_20260624-1230
 * Skill bắt lấy dòng này để render vào projects/<id>/.
 */
import { mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const topic = process.argv.slice(2).join(" ").trim() || "podcast";
const slug =
  topic
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "podcast";

const d = new Date();
const p = (n) => String(n).padStart(2, "0");
const ts = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
const id = `${slug}_${ts}`;

mkdirSync(resolve(ROOT, "projects", id), { recursive: true });
console.log(id);
