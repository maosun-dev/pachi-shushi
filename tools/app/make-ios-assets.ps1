# Makes the iPhone app icon and launch (splash) images.
#   - App icon (1024x1024, no transparency - the App Store rejects icons with alpha):
#       uses tools/app/ios-icon-1024.png if present (put the real design there),
#       otherwise draws a simple placeholder: "収支" in mincho on white, like the total on the main screen.
#   - Splash: plain white (#FFFFFF), 2732x2732.
# Usage: powershell -ExecutionPolicy Bypass -File tools\app\make-ios-assets.ps1
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$xc = Join-Path $root 'ios\App\App\Assets.xcassets'
Add-Type -AssemblyName System.Drawing

function New-Rgb($size) {
  $bmp = New-Object Drawing.Bitmap $size, $size, ([Drawing.Imaging.PixelFormat]::Format24bppRgb)
  $g = [Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = 'HighQualityBicubic'; $g.SmoothingMode = 'HighQuality'; $g.PixelOffsetMode = 'HighQuality'
  $g.TextRenderingHint = 'AntiAliasGridFit'
  $g.Clear([Drawing.Color]::White)
  return @($bmp, $g)
}

$iconPath = Join-Path $xc 'AppIcon.appiconset\AppIcon-512@2x.png'
$hi = Join-Path $PSScriptRoot 'ios-icon-1024.png'
$bmp, $g = New-Rgb 1024
if (Test-Path $hi) {
  $img = [Drawing.Image]::FromFile($hi)
  $g.DrawImage($img, 0, 0, 1024, 1024)
  $img.Dispose()
  Write-Host 'app icon from ios-icon-1024.png'
} else {
  $font = New-Object Drawing.Font 'Yu Mincho', 300, ([Drawing.FontStyle]::Bold), ([Drawing.GraphicsUnit]::Pixel)
  $fmt = New-Object Drawing.StringFormat
  $fmt.Alignment = 'Center'; $fmt.LineAlignment = 'Center'
  $ink = New-Object Drawing.SolidBrush ([Drawing.Color]::FromArgb(0x1A, 0x1A, 0x1A))
  $g.DrawString('収支', $font, $ink, (New-Object Drawing.RectangleF 0, 0, 1024, 960), $fmt)
  $plus = New-Object Drawing.SolidBrush ([Drawing.Color]::FromArgb(0x1D, 0x6B, 0x4A))
  $g.FillRectangle($plus, 312, 640, 400, 22)
  $font.Dispose(); $ink.Dispose(); $plus.Dispose()
  Write-Host 'app icon: placeholder (put the real design at tools\app\ios-icon-1024.png and run again)'
}
$bmp.Save($iconPath, [Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()

foreach ($n in 'splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png') {
  $bmp, $g = New-Rgb 2732
  $bmp.Save((Join-Path $xc "Splash.imageset\$n"), [Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
}
Write-Host 'splash images: plain #FFFFFF'
