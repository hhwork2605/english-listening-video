/**
 * Sinh nội dung câu tiếng Anh + nghĩa Việt bằng Claude, ghi ra data/script.json.
 *
 * Cách dùng:
 *   set ANTHROPIC_API_KEY=...        (PowerShell: $env:ANTHROPIC_API_KEY="...")
 *   npm run generate:script -- --topic "travel" --level B1 --count 15
 *
 * Lưu ý: durationInSec ở đây chỉ là ước lượng. Sau khi có file audio thật,
 * chạy `npm run measure` để cập nhật độ dài chính xác.
 */
import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "../data/script.json");
const MODEL = "claude-sonnet-4-6";

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const topic = arg("topic", "daily conversation");
const level = arg("level", "B1");
const count = parseInt(arg("count", "12"), 10);

// Ước lượng độ dài đọc: ~0.38s/từ + 0.6s đệm.
const estimateSec = (en: string): number => {
  const words = en.trim().split(/\s+/).length;
  return Math.round((words * 0.38 + 0.6) * 10) / 10;
};

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("Thiếu ANTHROPIC_API_KEY. Hãy set biến môi trường trước khi chạy.");
    process.exit(1);
  }

  const client = new Anthropic();

  const prompt = `Generate ${count} short, natural English sentences for a passive-listening practice video.
Topic: "${topic}". CEFR level: ${level}.
Rules:
- Each sentence should be useful in real conversation, 5-12 words.
- Provide an accurate Vietnamese translation.
- Provide IPA phonetic transcription.
Return ONLY a JSON array, no markdown fences, with objects of shape:
{"en": string, "vi": string, "phonetic": string}`;

  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 4000,
    messages: [{ role: "user", content: prompt }],
  });

  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();

  const raw = JSON.parse(text) as Array<{ en: string; vi: string; phonetic?: string }>;

  const items = raw.map((r, idx) => {
    const id = String(idx + 1).padStart(3, "0");
    return {
      id,
      en: r.en,
      vi: r.vi,
      phonetic: r.phonetic ?? "",
      topic,
      audio: "", // điền sau khi chạy generate:audio
      durationInSec: estimateSec(r.en),
      repeat: 2,
      gapBetweenRepeatsSec: 0.6,
      pauseAfterSec: 1.5,
    };
  });

  const script = {
    title: `English Listening - ${topic}`,
    level,
    fps: 30,
    items,
  };

  writeFileSync(OUT, JSON.stringify(script, null, 2), "utf8");
  console.log(`Đã ghi ${items.length} câu vào ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
