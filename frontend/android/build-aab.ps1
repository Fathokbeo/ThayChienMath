# Build ban AAB DA KY de tai len Google Play.
# Hoi mat khau khoa ky (khong luu vao file nao), build lai giao dien app, roi build + ky AAB bang Java 21.
# Chay: powershell -ExecutionPolicy Bypass -File .\build-aab.ps1   (trong thu muc frontend\android)
$ErrorActionPreference = 'Stop'

$android = $PSScriptRoot
$frontend = Split-Path $android
$props = Join-Path $android 'keystore.properties'
if (-not (Test-Path $props)) { Write-Host "Thieu $props" -ForegroundColor Red; exit 1 }
$storeFile = ((Get-Content $props | Where-Object { $_ -match '^storeFile=' }) -replace '^storeFile=', '').Trim()
if (-not (Test-Path $storeFile)) { Write-Host "Chua co khoa ky $storeFile - chay tao-khoa-ky.ps1 truoc." -ForegroundColor Red; exit 1 }

# Gradle 8.14.3 khong chay voi Java 25 -> dung Java 21
$jbr = 'C:\Users\Admin\.jdks\jbr-21.0.11'
if (Test-Path $jbr) { $env:JAVA_HOME = $jbr }

$sec = Read-Host 'Mat khau khoa ky' -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
$plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)

Push-Location $frontend
try {
  Write-Host '1/2 Build giao dien app...' -ForegroundColor Cyan
  npm run build:android
  if ($LASTEXITCODE -ne 0) { throw 'Build giao dien loi.' }

  Write-Host '2/2 Build + ky AAB...' -ForegroundColor Cyan
  Set-Location $android
  $env:EDUGRADE_KEY_PASSWORD = $plain
  # --no-daemon: tien trinh Gradle tat ngay sau khi build, khong giu mat khau trong bo nho
  .\gradlew.bat bundleRelease --no-daemon
  if ($LASTEXITCODE -ne 0) { throw 'Build AAB loi (sai mat khau khoa ky?).' }
}
catch { Write-Host $_ -ForegroundColor Red; exit 1 }
finally {
  Remove-Item Env:EDUGRADE_KEY_PASSWORD -ErrorAction SilentlyContinue
  $plain = $null
  Pop-Location
}

$aab = Join-Path $android 'app\build\outputs\bundle\release\app-release.aab'
Write-Host ''
Write-Host "Xong: $aab" -ForegroundColor Green
Write-Host 'Tai file nay len Play Console (Thu nghiem kin -> Tao ban phat hanh).'
