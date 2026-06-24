# English Podcast Video (template)

Project Remotion để dựng video học tiếng Anh: **podcast hội thoại 2 người**
(định dạng chính) và **câu đơn lặp lại để nghe thụ động** (định dạng phụ).
Tạo bởi skill `english-podcast-video`.

## Cài đặt
```bash
npm install
```

## Podcast hội thoại (chính)
1. Soạn `data/dialogue.json` (2 nhân vật, transcript tiếng Anh).
2. Sinh giọng + mốc từ: `npm run dialogue:audio`
3. (Khuyến nghị) Highlight khớp tuyệt đối:
   ```bash
   pip install faster-whisper truststore   # một lần
   npm run dialogue:align                   # ghi mốc từng từ THẬT (offline, không key)
   ```
4. Render:
   ```bash
   npm run render:podcast            # out/podcast.mp4 (ngang)
   npm run render:podcast:portrait   # out/podcast-portrait.mp4 (dọc)
   ```

Xem trước trực quan: `npm run dev` (Remotion Studio), chọn `Podcast`.

## Câu đơn nghe thụ động (phụ)
1. Soạn `data/script.json`.
2. `npm run generate:audio:sapi`  (giọng Windows + highlight từng từ)
3. `npm run render:landscape` / `npm run render:portrait`

## Thumbnail
```bash
npm run render:thumbnail   # out/thumbnail.png (1280x720), kiểu kênh
```

## Composition
- `Podcast` / `PodcastVertical` — **kiểu kênh**: 1 ảnh tĩnh + sóng âm +
  transcript tiếng Anh (`data/dialogue.json`). Đặt ảnh nền qua `backgroundImage`
  trong `src/Root.tsx`.
- `LandscapeVideo` / `PortraitVideo` — câu đơn lặp (`data/script.json`)
- `Thumbnail` — ảnh đại diện 1280x720
- `PodcastVideo` (biến thể, chưa đăng ký) — 2 avatar + phụ đề Anh-Việt + badge

Mọi video đều có **sóng âm chuyển động liên tục** (phản ứng theo audio) để tránh
YouTube gắn cờ nội dung trùng lặp — tự động, không cần cấu hình.

Chi tiết các trường dữ liệu, chọn giọng, TTS chất lượng cao: xem phần
references của skill.
