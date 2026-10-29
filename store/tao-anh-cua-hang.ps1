# Tạo ảnh cho trang ứng dụng trên Google Play từ logo (frontend/public/logo.png):
#   icon-512.png          — biểu tượng ứng dụng 512×512
#   feature-graphic.png   — ảnh bìa 1024×500
# Chạy lại khi đổi logo:  powershell -ExecutionPolicy Bypass -File store\tao-anh-cua-hang.ps1
Add-Type -AssemblyName System.Drawing
$root = Split-Path -Parent $PSScriptRoot
$logo = [System.Drawing.Image]::FromFile((Join-Path $root 'frontend\public\logo.png'))

function New-Canvas($w, $h) {
  $bmp = New-Object System.Drawing.Bitmap $w, $h
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'; $g.InterpolationMode = 'HighQualityBicubic'; $g.TextRenderingHint = 'AntiAliasGridFit'
  return @($bmp, $g)
}

# ── Icon 512×512: logo trên nền trắng, chừa lề để Google Play bo góc không cắt vào logo ──
$bmp, $g = New-Canvas 512 512
$g.Clear([System.Drawing.Color]::White)
$g.DrawImage($logo, 36, 36, 440, 440)
$bmp.Save((Join-Path $PSScriptRoot 'icon-512.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()

# ── Ảnh bìa 1024×500: nền xanh thương hiệu, logo trong vòng tròn trắng, tên + câu giới thiệu ──
$bmp, $g = New-Canvas 1024 500
$rect = New-Object System.Drawing.Rectangle 0, 0, 1024, 500
$grad = New-Object System.Drawing.Drawing2D.LinearGradientBrush $rect, ([System.Drawing.Color]::FromArgb(31, 92, 104)), ([System.Drawing.Color]::FromArgb(47, 111, 130)), 20
$g.FillRectangle($grad, $rect)
$g.FillEllipse([System.Drawing.Brushes]::White, 70, 110, 280, 280)
$g.DrawImage($logo, 85, 125, 250, 250)
$white = [System.Drawing.Brushes]::White
$soft = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(225, 236, 240))
$g.DrawString('Thầy Chiến Math', (New-Object System.Drawing.Font 'Segoe UI', 54, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)), $white, 395, 150)
$g.DrawString('Học Toán THCS vững vàng', (New-Object System.Drawing.Font 'Segoe UI', 30, ([System.Drawing.FontStyle]::Regular), ([System.Drawing.GraphicsUnit]::Pixel)), $soft, 400, 238)
$g.DrawString('Bài tập · Chấm bài AI · Phụ huynh theo dõi', (New-Object System.Drawing.Font 'Segoe UI', 23, ([System.Drawing.FontStyle]::Regular), ([System.Drawing.GraphicsUnit]::Pixel)), $soft, 401, 290)
$bmp.Save((Join-Path $PSScriptRoot 'feature-graphic.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose(); $logo.Dispose()
Write-Host "Da tao: store\icon-512.png, store\feature-graphic.png"
