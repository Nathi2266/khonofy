# Regenerate square favicons from src/assets/images/disc_3.png
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$srcPath = Join-Path $root "src\assets\images\disc_3.png"
$publicDir = Join-Path $root "public"
$src = [System.Drawing.Image]::FromFile($srcPath)

function New-Favicon([int]$size, [string]$outPath) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $g.Clear([System.Drawing.Color]::Transparent)

  # Fill width so the arc reads larger in the square tab slot (slight vertical crop).
  $targetW = $size * 0.98
  $scale = $targetW / $src.Width
  $w = [int]$targetW
  $h = [int]($src.Height * $scale)
  $x = [int](($size - $w) / 2)
  $y = [int](($size - $h) / 2)

  $g.DrawImage($src, $x, $y, $w, $h)
  $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose()
  $bmp.Dispose()
}

New-Favicon 32 (Join-Path $publicDir "favicon-32.png")
New-Favicon 64 (Join-Path $publicDir "favicon.png")
New-Favicon 128 (Join-Path $publicDir "favicon-128.png")
New-Favicon 192 (Join-Path $publicDir "favicon-192.png")
$src.Dispose()

Write-Host "Favicons written to public/"
