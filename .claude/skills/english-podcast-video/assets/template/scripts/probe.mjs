import { parseMedia } from "@remotion/media-parser";
import { nodeReader } from "@remotion/media-parser/node";

const r = await parseMedia({
  src: "out/daily-english-b1.mp4",
  fields: { durationInSeconds: true, tracks: true, dimensions: true },
  reader: nodeReader,
});
const t = r.tracks;
const video = Array.isArray(t) ? t.filter((x) => x.type === "video") : t.videoTracks;
const audio = Array.isArray(t) ? t.filter((x) => x.type === "audio") : t.audioTracks;
console.log("duration:", r.durationInSeconds, "s");
console.log("dimensions:", JSON.stringify(r.dimensions));
console.log("videoTracks:", video.length, "audioTracks:", audio.length);
console.log("audioCodec:", audio[0]?.codec, "| videoCodec:", video[0]?.codec);
