/**
 * Tạo một project folder mới theo dạng `tenchude_thoigian` và in ra id.
 *
 * Dùng:  node scripts/new-project.mjs "Talking About Animals"
 * In ra (stdout) đúng một dòng = id, vd: talking-about-animals_20260624-1230
 * Skill bắt lấy dòng này để render vào projects/<id>/.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
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

const projDir = resolve(ROOT, "projects", id);
mkdirSync(projDir, { recursive: true });

// Khung tiến độ dạng checklist — để nếu chạy dở/lỗi còn biết làm tiếp đến đâu.
// Note NGẮN, tick [x] khi xong. KHÔNG in ra stdout (stdout chỉ được có 1 dòng = id).
const progress = `# Tiến độ — ${topic}
> Tick [x] khi xong. Ghi CHỖ ĐANG DỞ + lỗi để lần sau chạy tiếp. Note NGẮN thôi.
> Trước khi bắt tay: mở rộng "Việc chính" thành các việc nhỏ cụ thể cho video này.

- Project: \`${id}\`
- Cập nhật lần cuối: (điền khi sửa)

## Việc chính
- [ ] 1. Chuẩn bị project (template + npm install)
- [ ] 2. Chốt nguồn kịch bản (có sẵn / tự viết) + topic + level
- [ ] 3. dialogue.json: turns + metadata YouTube
- [ ] 4. TTS sinh giọng — adapter: ____  (tiến độ: __/__ lượt)
- [ ] 4b. dialogue:align (words[] cho karaoke)
- [ ] 5. project:use + ảnh nền + render Podcast (ngang)
- [ ] 5d. render PodcastVertical (dọc) — nếu cần
- [ ] 6. Thumbnail
- [ ] 7. project:finalize (.srt + metadata + đổi tên file)
- [ ] 8. Intro/outro — nếu cần
- [ ] 9. HỎI upload Google Drive (nếu có → Google Drive MCP)

## Đang dở / chỗ dừng
-

## Task phát sinh
- [ ]

## Lỗi gặp phải
-
`;
writeFileSync(join(projDir, "PROGRESS.md"), progress, "utf8");

console.log(id);
