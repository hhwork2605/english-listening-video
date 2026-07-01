# Metadata YouTube cho video học tiếng Anh (title / description / tags)

Điền các trường này vào `dialogue.json`; `project:finalize` xuất ra **MỘT file
`youtube-metadata.txt`** chia rõ 3 phần (`===== TITLE / DESCRIPTION / TAGS =====`)
để dễ copy khi upload. Có thể để `youtube-metadata-writer` (subagent, bước 3b) sinh tự động.

## `youtubeTitle` — móc tò mò, < 50 ký tự
Đây là tiêu đề khi ĐĂNG (metadata), khác chữ trên thumbnail. Viết tiếng Anh, đánh
vào tâm lý người học, bám chủ đề + cấp độ, ≤ 50 ký tự. Công thức:
- Mệnh lệnh + thói quen: *"Listen To This Every Night Before Bed…"*
- Lợi ích + thời hạn: *"Fix Your English Pronunciation In 1 Week"*
- Hứa hẹn dễ dàng: *"Improve Your English Without Even Trying"*
- Khơi tò mò: *"The English Trick Natives Never Tell You"*

## `youtubeDescription`
2–4 câu (hook → video có gì → lợi ích → CTA subscribe), rồi 3–5 hashtag ở cuối
(vd `#LearnEnglish #EnglishPodcast #EnglishListening`). Dùng `\n` để xuống dòng
trong chuỗi JSON.

## `tags`
Mảng ~8–12 từ khóa tìm kiếm, vd: `"learn english"`, `"english listening practice"`,
`"<chủ đề> in english"`, `"<cấp độ> english"`, `"english podcast"`.
`finalize` nối bằng dấu phẩy trong phần `===== TAGS =====` của `youtube-metadata.txt`.
