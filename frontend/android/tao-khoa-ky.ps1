# Tao khoa ky ban phat hanh (khoa tai len Google Play) - CHI LAM 1 LAN.
# keytool se hoi mat khau 2 lan: tu go (toi thieu 6 ky tu), ghi lai can than.
# Chay: powershell -ExecutionPolicy Bypass -File .\tao-khoa-ky.ps1   (trong thu muc frontend\android)
$ErrorActionPreference = 'Stop'

$dir = 'D:\KhoaKyApp'
$jks = Join-Path $dir 'edugrade-upload.jks'

if (Test-Path $jks) {
  Write-Host "Da co khoa: $jks" -ForegroundColor Yellow
  Write-Host 'KHONG tao lai - tao lai se thay khoa cu, Google Play chi nhan dung khoa da dang ky.' -ForegroundColor Yellow
  exit 1
}

# keytool cua Java 21 (cung ban Gradle JDK); khong co thi dung keytool trong PATH
$keytool = 'C:\Users\Admin\.jdks\jbr-21.0.11\bin\keytool.exe'
if (-not (Test-Path $keytool)) { $keytool = 'keytool' }

New-Item -ItemType Directory -Force $dir | Out-Null
Write-Host "Tao khoa tai $jks (ten khoa: upload, hieu luc ~27 nam)" -ForegroundColor Cyan
& $keytool -genkeypair -v -keystore $jks -storetype PKCS12 -alias upload -keyalg RSA -keysize 2048 -validity 10000 -dname 'CN=EduGrade Aplus, O=EduGrade Aplus, C=VN'
if ($LASTEXITCODE -ne 0) { Write-Host 'Tao khoa khong thanh cong.' -ForegroundColor Red; exit 1 }

Write-Host ''
Write-Host "Da tao khoa: $jks" -ForegroundColor Green
Write-Host 'SAO LUU NGAY file .jks va mat khau vao it nhat 2 noi (USB, o dam may rieng).' -ForegroundColor Yellow
Write-Host 'Mat file hoac quen mat khau = khong cap nhat app tren Google Play duoc nua.' -ForegroundColor Yellow
