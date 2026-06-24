# Giọng đọc SAPI (Windows)

## Liệt kê giọng đang có
```powershell
Add-Type -AssemblyName System.Speech
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
$s.GetInstalledVoices() | ForEach-Object { $_.VoiceInfo } |
  Select-Object Name, Culture, Gender
```

Trên Windows 10/11 mặc định thường có:
- **Microsoft David Desktop** — nam, en-US
- **Microsoft Zira Desktop** — nữ, en-US

Đặt đúng chuỗi `Name` vào trường `voice` của mỗi speaker trong `dialogue.json`.

## Tốc độ đọc
Tham số `-Rate` của `tts-dialogue.ps1` nhận giá trị từ `-10` (chậm) đến `10`
(nhanh); mặc định `-1` cho dễ nghe khi học. Ví dụ:
```bash
powershell -ExecutionPolicy Bypass -File scripts/tts-dialogue.ps1 -Rate -2
```

## Cài thêm giọng tiếng Anh
Settings → Time & language → Language & region → Add a language (English) →
Language options → Speech. Sau khi cài, một số giọng "Desktop" mới sẽ xuất hiện
trong danh sách trên. Lưu ý nhiều giọng UWP (vd "Microsoft Aria Online") không
truy cập được qua System.Speech — ưu tiên các giọng có hậu tố "Desktop".

## Giọng tự nhiên hơn
SAPI nghe khá máy móc. Để xuất bản kênh nghiêm túc, cân nhắc TTS đám mây —
xem `better-tts.md`.
