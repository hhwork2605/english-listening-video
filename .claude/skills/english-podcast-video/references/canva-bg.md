# Tạo ảnh nền studio bằng Canva (MCP)

Mục tiêu: một ảnh minh hoạ 16:9 cảnh thu podcast 2 người, **giữa để trống** cho
caption, **không chữ/logo**, dùng làm nền tĩnh xuyên suốt.

## Các bước
1. **generate-design** — `design_type: "desktop_wallpaper"`. Query mẫu (chỉnh
   theo chủ đề/nhân vật người dùng yêu cầu):
   > A wide 16:9 podcast studio background illustration, warm friendly flat
   > cartoon style. Two hosts at a wooden desk facing each other: LEFT a young
   > woman with long dark hair, white over-ear headphones, green top, gesturing;
   > RIGHT a young man, short dark hair, white headphones, yellow t-shirt,
   > listening. Each with a black studio mic + pop filter. Cozy bookshelf, green
   > plants, warm lamp; dark teal wall. Keep the CENTER empty/uncluttered for
   > captions. No text, no words, no logo. Soft studio lighting.

   Trả về nhiều candidate. Có thể export vài cái để so rồi chọn.
2. **create-design-from-candidate** — `job_id` + `candidate_id` → `design_id`
   (bắt đầu bằng "D").
3. **export-design** — `format: { type: "png", width: 1920, height: 1080 }` →
   trả về URL tải có chữ ký (hết hạn sau vài giờ).
4. **Tải về** (Bash thường bị chặn mạng → dùng PowerShell):
   ```powershell
   Invoke-WebRequest -Uri "<signed_url>" -OutFile "public\backgrounds\scene.png"
   ```
5. Bật `backgroundImage: "backgrounds/scene.png"` trong `src/Root.tsx`.

## Ảnh nền THUMBNAIL (khác ảnh nền video)
Thumbnail cần khung khác: 2 nhân vật **sát hai mép**, **giữa trống nhiều** để đặt
tiêu đề lớn. Dùng `design_type: "youtube_thumbnail"`, export PNG `1280x720`, tải
về `public/thumbnails/<slug>.png`. Query mẫu:
> A 16:9 YouTube thumbnail illustration, warm flat cartoon style, English
> podcast. TWO hosts at the FAR LEFT and FAR RIGHT edges facing the center
> (woman left gesturing, man right), headphones, black studio mics, cozy dark
> studio with bookshelf + plants + soft warm lighting. CRITICAL: keep the entire
> CENTER completely empty (just the wall) for a big title. NO text, NO words, NO
> letters, NO logo anywhere. Bright, high-contrast thumbnail style.

Chọn ảnh **giữa thoáng nhất, không chữ** (Canva đôi khi tự thêm chữ — loại bỏ).
Remotion sẽ phủ pill + tiêu đề + badge lên giữa (composition `Thumbnail`).

## Mẹo
- Muốn xem trước candidate: export PNG rồi tải về bằng PowerShell và mở ra (link
  thumbnail trực tiếp của Canva trả 403 nếu tải ngoài phiên).
- Bản dọc (PodcastVertical): tạo thêm một ảnh khung dọc (vd
  `design_type: "phone_wallpaper"`) hoặc crop, lưu `scene-vertical.png`.
- Chọn ảnh có **khoảng giữa rộng & thoáng** nhất để caption + sóng âm không đè
  lên mặt nhân vật.
