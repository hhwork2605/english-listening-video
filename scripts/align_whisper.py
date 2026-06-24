"""
Forced-alignment các mốc thời gian TỪNG TỪ (bắt đầu + kết thúc THẬT) cho hội thoại
bằng faster-whisper — chạy offline, miễn phí, không cần ffmpeg hệ thống, không key.

Đọc data/dialogue.json, với mỗi lượt có audio thì nhận diện lại bằng Whisper kèm
word-timestamps rồi GHI ĐÈ turn["words"] = [{text, startSec, endSec}] với mốc thật.
Sau đó render lại là highlight khớp tuyệt đối.

Cách dùng:
    python scripts/align_whisper.py                 # data/dialogue.json, model base.en
    python scripts/align_whisper.py --model small.en --data data/dialogue.json
"""
import json
import os
import sys
import argparse

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

# Dùng kho chứng chỉ của hệ điều hành (qua được proxy doanh nghiệp dùng cert riêng)
# khi tải model Whisper lần đầu từ Hugging Face.
try:
    import truststore
    truststore.inject_into_ssl()
except Exception:
    pass

from faster_whisper import WhisperModel

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="data/dialogue.json")
    ap.add_argument("--model", default="base.en", help="tiny.en|base.en|small.en|medium.en")
    args = ap.parse_args()

    data_path = os.path.join(ROOT, args.data)
    public = os.path.join(ROOT, "public")

    with open(data_path, "r", encoding="utf-8-sig") as f:
        doc = json.load(f)

    print(f"Tải model Whisper '{args.model}' (lần đầu sẽ tải về)...")
    model = WhisperModel(args.model, device="cpu", compute_type="int8")

    turns = doc.get("turns", [])
    for turn in turns:
        audio = turn.get("audio")
        if not audio:
            continue
        wav = os.path.join(public, audio)
        if not os.path.exists(wav):
            print(f"  bỏ qua (thiếu file): {audio}")
            continue

        segments, _ = model.transcribe(
            wav,
            language="en",
            word_timestamps=True,
            vad_filter=False,
            beam_size=5,
        )

        words = []
        for seg in segments:
            for w in (seg.words or []):
                text = w.word.strip()
                if not text:
                    continue
                words.append({
                    "text": text,
                    "startSec": round(float(w.start), 3),
                    "endSec": round(float(w.end), 3),
                })

        if words:
            turn["words"] = words
            print(f"  {turn['id']} [{turn.get('speaker')}]  {len(words)} tu  (0..{words[-1]['endSec']}s)")
        else:
            print(f"  {turn['id']}: Whisper khong ra tu nao, giu nguyen.")

    with open(data_path, "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, indent=2)
    print(f"Da ghi moc thuc te vao {args.data}. Gio render lai la khop tuyet doi.")


if __name__ == "__main__":
    main()
