/**
 * Sinh giọng đọc cho từng câu trong data/script.json.
 *
 * Lớp adapter "cắm-rút": chọn nhà cung cấp qua biến môi trường TTS_PROVIDER.
 *   - "manual"     (mặc định): chỉ in ra danh sách file cần thu/đặt thủ công
 *                  vào public/audio/<id>.mp3 (tự thu hoặc kéo từ nơi khác).
 *   - "openai"     : cần OPENAI_API_KEY. Model gpt-4o-mini-tts, giọng "alloy".
 *   - "elevenlabs" : cần ELEVENLABS_API_KEY và ELEVENLABS_VOICE_ID.
 *
 * Sau khi có file, script này tự điền trường "audio" trong script.json.
 * Hãy chạy `npm run measure` để cập nhật durationInSec chính xác.
 *
 * Cách dùng:  npm run generate:audio
 */
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { Script } from "../src/types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT_PATH = resolve(__dirname, "../data/script.json");
const AUDIO_DIR = resolve(__dirname, "../public/audio");

const PROVIDER = (process.env.TTS_PROVIDER ?? "manual").toLowerCase();

async function synthOpenAI(text: string): Promise<Buffer> {
  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini-tts",
      voice: process.env.OPENAI_TTS_VOICE ?? "alloy",
      input: text,
      response_format: "mp3",
    }),
  });
  if (!res.ok) throw new Error(`OpenAI TTS ${res.status}: ${await res.text()}`);
  return Buffer.from(await res.arrayBuffer());
}

async function synthElevenLabs(text: string): Promise<Buffer> {
  const voice = process.env.ELEVENLABS_VOICE_ID;
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voice}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": process.env.ELEVENLABS_API_KEY ?? "",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
      }),
    },
  );
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${await res.text()}`);
  return Buffer.from(await res.arrayBuffer());
}

async function main() {
  const script = JSON.parse(readFileSync(SCRIPT_PATH, "utf8")) as Script;
  mkdirSync(AUDIO_DIR, { recursive: true });

  if (PROVIDER === "manual") {
    console.log("TTS_PROVIDER=manual — hãy đặt các file sau vào public/audio/:");
    for (const item of script.items) {
      console.log(`  ${item.id}.mp3  <-  "${item.en}"`);
      item.audio = `audio/${item.id}.mp3`;
    }
    writeFileSync(SCRIPT_PATH, JSON.stringify(script, null, 2), "utf8");
    console.log("\nĐã trỏ trường audio sang audio/<id>.mp3 trong script.json.");
    console.log("Đặt file xong thì chạy: npm run measure");
    return;
  }

  for (const item of script.items) {
    const outFile = resolve(AUDIO_DIR, `${item.id}.mp3`);
    if (existsSync(outFile)) {
      console.log(`Bỏ qua (đã có): ${item.id}.mp3`);
      item.audio = `audio/${item.id}.mp3`;
      continue;
    }
    console.log(`Đang tạo: ${item.id}.mp3 ...`);
    const buf =
      PROVIDER === "openai"
        ? await synthOpenAI(item.en)
        : PROVIDER === "elevenlabs"
          ? await synthElevenLabs(item.en)
          : (() => {
              throw new Error(`TTS_PROVIDER không hỗ trợ: ${PROVIDER}`);
            })();
    writeFileSync(outFile, buf);
    item.audio = `audio/${item.id}.mp3`;
  }

  writeFileSync(SCRIPT_PATH, JSON.stringify(script, null, 2), "utf8");
  console.log("Xong. Tiếp theo chạy: npm run measure");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
