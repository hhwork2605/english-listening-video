<#
  Sinh giọng đọc tiếng Anh + mốc thời gian TỪNG TỪ bằng Windows SAPI (offline).
  Ghi file public/audio/<id>.wav và cập nhật data/script.json:
    - audio          -> "audio/<id>.wav"
    - durationInSec  -> độ dài thực của file
    - words[]        -> [{ text, startSec, endSec }] cho hiệu ứng highlight

  Cách dùng:
    npm run generate:audio:sapi
    # hoặc chọn giọng / tốc độ:
    powershell -ExecutionPolicy Bypass -File scripts/tts-sapi.ps1 -Voice "Microsoft David Desktop" -Rate -2
#>
param(
  [Parameter(Mandatory=$true)][string]$Data,  # BẮT BUỘC — tránh chạy nhầm buffer project cũ
  [string]$Voice = "Microsoft Zira Desktop",
  [int]$Rate = -1
)

Add-Type -AssemblyName System.Speech

$root = Split-Path -Parent $PSScriptRoot
$scriptPath = Join-Path $root $Data
$audioDir = Join-Path $root "public\audio"
New-Item -ItemType Directory -Force -Path $audioDir | Out-Null

$data = Get-Content $scriptPath -Raw -Encoding UTF8 | ConvertFrom-Json

$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$synth.SelectVoice($Voice)
$synth.Rate = $Rate

# Handler đọc ranh giới từ: lấy đúng chuỗi gốc theo vị trí ký tự để giữ hoa/dấu câu.
# PowerShell 5.1 tự chuyển scriptblock thành delegate cho event accessor.
$synth.add_SpeakProgress({
  param($s, $e)
  $token = $script:curEn.Substring($e.CharacterPosition, $e.CharacterCount)
  if ($token.Trim().Length -gt 0) {
    $script:words.Add([pscustomobject]@{
      text     = $token
      startSec = [math]::Round($e.AudioPosition.TotalSeconds, 3)
    })
  }
})

foreach ($item in $data.items) {
  $script:curEn = [string]$item.en
  $script:words = New-Object System.Collections.Generic.List[object]

  $wavPath = Join-Path $audioDir ("{0}.wav" -f $item.id)
  $synth.SetOutputToWaveFile($wavPath)
  $synth.Speak($item.en)
  $synth.SetOutputToNull()

  # Độ dài thực từ header WAV (PCM, header 44 byte).
  $bytes = [System.IO.File]::ReadAllBytes($wavPath)
  $byteRate = [System.BitConverter]::ToInt32($bytes, 28)
  $dur = [math]::Round(($bytes.Length - 44) / $byteRate, 3)

  # Gán endSec = startSec của từ kế tiếp; từ cuối kết thúc ở cuối audio.
  $wlist = $script:words
  for ($i = 0; $i -lt $wlist.Count; $i++) {
    $end = if ($i -lt $wlist.Count - 1) { $wlist[$i + 1].startSec } else { $dur }
    $wlist[$i] | Add-Member -NotePropertyName endSec -NotePropertyValue $end -Force
  }

  $item | Add-Member -NotePropertyName audio -NotePropertyValue ("audio/{0}.wav" -f $item.id) -Force
  $item | Add-Member -NotePropertyName durationInSec -NotePropertyValue $dur -Force
  $item | Add-Member -NotePropertyName words -NotePropertyValue $wlist.ToArray() -Force

  Write-Host ("{0}.wav  {1}s  {2} tu" -f $item.id, $dur, $wlist.Count)
}

$synth.Dispose()

$data | ConvertTo-Json -Depth 10 | Set-Content $scriptPath -Encoding UTF8
# tự đè buffer render: data/ luôn là project đang làm
$bufferPath = Join-Path $root "datascript.json"
if ($scriptPath -ne $bufferPath) { Copy-Item $scriptPath $bufferPath -Force }
Write-Host "Da cap nhat $Data (audio + words). Gio render duoc roi."
