# Builds lumina-icon.png (512px, rounded) and lumina.ico (16-256px) from a square crop of a logo image.
# Usage: powershell -ExecutionPolicy Bypass -File make-icons.ps1 -src ..\Lumina-aero.jpg -x 266 -y 264 -size 490
param($src, [int]$x, [int]$y, [int]$size, $out = (Split-Path $PSScriptRoot -Parent))
Add-Type -AssemblyName System.Drawing
$b = New-Object System.Drawing.Bitmap (Resolve-Path $src).Path
$rect = New-Object System.Drawing.Rectangle $x, $y, $size, $size

function Render($px) {
  $bmp = New-Object System.Drawing.Bitmap $px, $px, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = 'HighQualityBicubic'; $g.SmoothingMode = 'AntiAlias'; $g.PixelOffsetMode = 'HighQuality'
  $g.Clear([System.Drawing.Color]::Transparent)
  $r = [int]($px * 0.22); $d = $r * 2
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  $p.AddArc(0, 0, $d, $d, 180, 90); $p.AddArc($px - $d - 1, 0, $d, $d, 270, 90)
  $p.AddArc($px - $d - 1, $px - $d - 1, $d, $d, 0, 90); $p.AddArc(0, $px - $d - 1, $d, $d, 90, 90); $p.CloseFigure()
  $g.SetClip($p)
  $g.DrawImage($b, (New-Object System.Drawing.Rectangle 0, 0, $px, $px), $rect, [System.Drawing.GraphicsUnit]::Pixel)
  $g.Dispose(); return $bmp
}

(Render 512).Save("$out\lumina-icon.png", [System.Drawing.Imaging.ImageFormat]::Png)

# .ico with PNG-compressed frames
$sizes = 16, 24, 32, 48, 64, 128, 256
$frames = foreach ($s in $sizes) { $m = New-Object System.IO.MemoryStream; (Render $s).Save($m, [System.Drawing.Imaging.ImageFormat]::Png); , $m.ToArray() }
$fs = [System.IO.File]::Create("$out\lumina.ico"); $w = New-Object System.IO.BinaryWriter $fs
$w.Write([UInt16]0); $w.Write([UInt16]1); $w.Write([UInt16]$sizes.Count)
$offset = 6 + 16 * $sizes.Count
for ($i = 0; $i -lt $sizes.Count; $i++) {
  $s = $sizes[$i]; $dim = if ($s -ge 256) { 0 } else { $s }
  $w.Write([byte]$dim); $w.Write([byte]$dim); $w.Write([byte]0); $w.Write([byte]0)
  $w.Write([UInt16]1); $w.Write([UInt16]32); $w.Write([UInt32]$frames[$i].Length); $w.Write([UInt32]$offset)
  $offset += $frames[$i].Length
}
foreach ($f in $frames) { $w.Write($f) }
$w.Close(); $b.Dispose()
Get-ChildItem "$out\lumina-icon.png", "$out\lumina.ico" | Select-Object Name, Length
