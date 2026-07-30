# Downscale + convert screenshots to JPEG before embedding them.
# Raw phone PNGs are 1-3 MB each and base64 adds ~33% on top; JPEG at ~520px
# typically cuts a screenshot to 30-90 KB with no loss of legibility.
#
#   pwsh scripts/to-jpeg.ps1 -InDir ./screenshots -OutDir ./screenshots/jpg

param(
  [Parameter(Mandatory = $true)][string]$InDir,
  [string]$OutDir = "$InDir\jpg",
  [int]$Width = 520,
  [int]$Quality = 82
)

Add-Type -AssemblyName System.Drawing
if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }

$codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$params = New-Object System.Drawing.Imaging.EncoderParameters(1)
$params.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]$Quality)

foreach ($f in Get-ChildItem -Path $InDir -Filter *.png) {
  $src = [System.Drawing.Image]::FromFile($f.FullName)
  $h = [int]([math]::Round($src.Height * ($Width / $src.Width)))
  $bmp = New-Object System.Drawing.Bitmap($Width, $h)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.DrawImage($src, 0, 0, $Width, $h)

  $out = Join-Path $OutDir ($f.BaseName + '.jpg')
  $bmp.Save($out, $codec, $params)
  $g.Dispose(); $bmp.Dispose(); $src.Dispose()

  Write-Output ("{0,-32} {1,5}KB -> {2,4}KB" -f $f.Name, [int]($f.Length / 1KB), [int]((Get-Item $out).Length / 1KB))
}
