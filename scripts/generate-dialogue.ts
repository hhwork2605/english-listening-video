/**
 * Sinh kịch bản hội thoại podcast (2 người) bằng Claude, ghi data/dialogue.json.
 *
 * Cách dùng:
 *   set ANTHROPIC_API_KEY=...
 *   npm run generate:dialogue -- --topic "Talking About Your Favorite Food" --level "B1-B2" --turns 40
 *
 * Sau đó: npm run dialogue:audio  (sinh giọng + mốc từ)  ->  npm run render:podcast
 */
import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "../data/dialogue.json");
const MODEL = "claude-sonnet-4-6";

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const topic = arg("topic", "Talking About Your Day at Work");
const level = arg("level", "B1-B2");
const turns = parseInt(arg("turns", "40"), 10);
const nameA = arg("nameA", "Emma");
const nameB = arg("nameB", "Mike");

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("Thiếu ANTHROPIC_API_KEY.");
    process.exit(1);
  }
  const client = new Anthropic();

  const prompt = `Write a natural, friendly English podcast conversation between two people, ${nameA} (female) and ${nameB} (male), on the topic: "${topic}".
Target CEFR level: ${level}. The whole thing should read like a relaxed real conversation for English learners.
Rules:
- About ${turns} turns total, strictly alternating speakers, starting with ${nameA}.
- Each turn is 1-2 sentences, natural and clear (not textbook-stiff).
- Use common, useful vocabulary and expressions for this level. Light follow-up questions keep it flowing.
- Provide an accurate, natural Vietnamese translation for every turn.
Return ONLY a JSON array (no markdown fences) of objects:
{"speaker": "A" | "B", "en": string, "vi": string}
where "A" is ${nameA} and "B" is ${nameB}.`;

  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 8000,
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

  const raw = JSON.parse(text) as Array<{ speaker: "A" | "B"; en: string; vi: string }>;

  const dialogue = {
    title: `English Podcast | ${topic}`,
    level,
    topic,
    fps: 30,
    speakers: {
      A: { name: nameA, voice: "Microsoft Zira Desktop", side: "left", color: "#f48fb1" },
      B: { name: nameB, voice: "Microsoft David Desktop", side: "right", color: "#64b5f6" },
    },
    turns: raw.map((r, idx) => ({
      id: String(idx + 1).padStart(3, "0"),
      speaker: r.speaker,
      en: r.en,
      vi: r.vi,
      audio: "",
      durationInSec: 0,
      pauseAfterSec: 0.4,
    })),
  };

  writeFileSync(OUT, JSON.stringify(dialogue, null, 2), "utf8");
  console.log(`Đã ghi ${dialogue.turns.length} lượt thoại vào ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
