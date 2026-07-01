<#
  Sinh giọng đọc cho hội thoại podcast bằng Windows SAPI (offline).
  Mỗi lượt thoại dùng giọng của speaker tương ứng (speakers.<id>.voice).
  Ghi public/audio/<project-id>/d<id>.wav (namespace theo project để không đè
  file giữa các project; data/ thì giữ phẳng public/audio/) và cập nhật file -Data:
    - audio          -> "audio/<project-id>/d<id>.wav"
    - durationInSec  -> độ dài thực
    - words[]        -> [{ text, startSec, endSec }] cho highlight

  Cách dùng:
    npm run dialogue:audio
    # hoặc chỉ định file khác / tốc độ:
    powershell -File scripts/tts-dialogue.ps1 -Data data/dialogue.json -Rate 0
#>
param(
  [string]$Data = "data/dialogue.json",
  [int]$Rate = -1
)

Add-Type -AssemblyName System.Speech

$root = Split-Path -Parent $PSScriptRoot
$dataPath = Join-Path $root $Data
# Namespace audio theo project (thư mục chứa file -Data) để KHÔNG đè file giữa các
# project. projects/<id>/dialogue.json -> public/audio/<id>/... ; data/ giữ phẳng.
$dataDir = Split-Path -Parent $dataPath
$ns = ""
if ($dataDir -match "[\\/]projects[\\/]") { $ns = Split-Path -Leaf $dataDir }
$audioDir = if ($ns) { Join-Path $root "public\audio\$ns" } else { Join-Path $root "public\audio" }
New-Item -ItemType Directory -Force -Path $audioDir | Out-Null
# Dọn file giọng hội thoại cũ CỦA RIÊNG project này để khớp dialogue hiện tại.
Get-ChildItem -Path $audioDir -Filter "d*.wav" -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue

$doc = Get-Content $dataPath -Raw -Encoding UTF8 | ConvertFrom-Json

$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$synth.Rate = $Rate

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

foreach ($turn in $doc.turns) {
  $voice = $doc.speakers.($turn.speaker).voice
  try { $synth.SelectVoice($voice) }
  catch { Write-Warning "Khong tim thay giong '$voice', dung giong mac dinh." }

  $script:curEn = [string]$turn.en
  $script:words = New-Object System.Collections.Generic.List[object]

  $wavPath = Join-Path $audioDir ("d{0}.wav" -f $turn.id)
  $synth.SetOutputToWaveFile($wavPath)
  $synth.Speak($turn.en)
  $synth.SetOutputToNull()

  $bytes = [System.IO.File]::ReadAllBytes($wavPath)
  $byteRate = [System.BitConverter]::ToInt32($bytes, 28)
  $dur = [math]::Round(($bytes.Length - 44) / $byteRate, 3)

  $wlist = $script:words
  for ($i = 0; $i -lt $wlist.Count; $i++) {
    $end = if ($i -lt $wlist.Count - 1) { $wlist[$i + 1].startSec } else { $dur }
    $wlist[$i] | Add-Member -NotePropertyName endSec -NotePropertyValue $end -Force
  }

  $rel = if ($ns) { "audio/{0}/d{1}.wav" -f $ns, $turn.id } else { "audio/d{0}.wav" -f $turn.id }
  $turn | Add-Member -NotePropertyName audio -NotePropertyValue $rel -Force
  $turn | Add-Member -NotePropertyName durationInSec -NotePropertyValue $dur -Force
  $turn | Add-Member -NotePropertyName words -NotePropertyValue $wlist.ToArray() -Force

  Write-Host ("d{0}.wav  [{1}]  {2}s  {3} tu" -f $turn.id, $turn.speaker, $dur, $wlist.Count)
}

$synth.Dispose()
$doc | ConvertTo-Json -Depth 12 | Set-Content $dataPath -Encoding UTF8
Write-Host "Da cap nhat $Data (audio + words). Gio render duoc roi."
