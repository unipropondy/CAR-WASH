Add-Type -AssemblyName System.Drawing

$srcPath = "C:\Users\UNIPRO\Desktop\Car Wash\Frontend\assets\images\login ui.png"
$destPath = "C:\Users\UNIPRO\Desktop\Car Wash\Frontend\assets\images\red_bay_login_clean_bg.jpg"

$bmp = [System.Drawing.Bitmap]::FromFile($srcPath)

$targetW = 2040
$targetH = 1040

$outBmp = New-Object System.Drawing.Bitmap($targetW, $targetH, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($outBmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

# 1. Base Dark Wine Red Background matching image tone
$bgColor = [System.Drawing.Color]::FromArgb(255, 58, 3, 7) # #3A0307
$bgBrush = New-Object System.Drawing.SolidBrush($bgColor)
$g.FillRectangle($bgBrush, 0, 0, $targetW, $targetH)

# 2. Draw source image shifted directly to the LEFT (x = 0, y = 50)
$srcX = 0
$srcY = 50
$g.DrawImage($bmp, $srcX, $srcY, $bmp.Width, $bmp.Height)

# 3. Seamlessly extend the right side (from x = bmp.Width - 40 to targetW)
$rightX = $bmp.Width - 50
$rightRect = New-Object System.Drawing.Rectangle($rightX, 0, 70, $targetH)
$rightBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rightRect, [System.Drawing.Color]::FromArgb(0, 58, 3, 7), $bgColor, 0.0)
$g.FillRectangle($rightBrush, $rightRect)

# Top edge subtle blend
$topRect = New-Object System.Drawing.Rectangle(0, 0, $targetW, ($srcY + 10))
$topBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($topRect, $bgColor, [System.Drawing.Color]::FromArgb(0, 58, 3, 7), 90.0)
$g.FillRectangle($topBrush, $topRect)

# Bottom edge subtle blend
$botY = $targetH - $srcY - 10
$botH = $srcY + 10
$botRect = New-Object System.Drawing.Rectangle(0, $botY, $targetW, $botH)
$botBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($botRect, [System.Drawing.Color]::FromArgb(0, 58, 3, 7), $bgColor, 90.0)
$g.FillRectangle($botBrush, $botRect)

# Save high-quality output
$encoderParams = New-Object System.Drawing.Imaging.EncoderParameters(1)
$encoderParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]96)
$jpegCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }

$outBmp.Save($destPath, $jpegCodec, $encoderParams)

# Also copy to PNG
$outBmp.Save("C:\Users\UNIPRO\Desktop\Car Wash\Frontend\assets\images\red_bay_login_clean_bg.png", [System.Drawing.Imaging.ImageFormat]::Png)

$bgBrush.Dispose()
$rightBrush.Dispose()
$topBrush.Dispose()
$botBrush.Dispose()
$g.Dispose()
$outBmp.Dispose()
$bmp.Dispose()

Write-Output "Master background shifted to left successfully!"

