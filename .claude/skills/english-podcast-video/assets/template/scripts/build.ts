/**
 * Chạy tuần tự cả pipeline nội dung:
 *   1) generate:script  (Claude  -> data/script.json)        [cần ANTHROPIC_API_KEY]
 *   2) generate:audio   (TTS     -> public/audio/*.mp3)      [tùy TTS_PROVIDER]
 *   3) measure          (đo độ dài -> cập nhật script.json)
 *
 * Sau bước này chỉ cần: npm run render:all
 *
 * Cách dùng:  npm run build:content -- --topic "travel" --level B1 --count 15
 */
import { spawnSync } from "node:child_process";

function run(cmd: string, args: string[]) {
  console.log(`\n=== ${cmd} ${args.join(" ")} ===`);
  const r = spawnSync(cmd, args, { stdio: "inherit", shell: true });
  if (r.status !== 0) {
    throw new Error(`Lệnh thất bại: ${cmd} ${args.join(" ")}`);
  }
}

const passthrough = process.argv.slice(2);

run("npm", ["run", "generate:script", "--", ...passthrough]);
run("npm", ["run", "generate:audio"]);
run("npm", ["run", "measure"]);

console.log("\nHoàn tất pipeline nội dung. Giờ chạy: npm run render:all");
