#!/usr/bin/env bash
# Cập nhật web lên bản code mới nhất trên GitHub — chạy mỗi khi đã push code mới:
#   sudo bash /var/www/thaychienmath/deploy/update.sh
# Thứ tự: sao lưu → lấy code mới → build → khởi động lại → kiểm tra web còn chạy.
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_USER="$(stat -c %U "$APP_DIR")"
APP_NAME="thaychienmath"

# Luôn chạy bằng người dùng của web (không phải root) để file mới không bị đổi chủ
if [ "$(id -un)" != "$APP_USER" ]; then exec sudo -u "$APP_USER" -H bash "$0" "$@"; fi
cd "$APP_DIR"

echo "==> Sao lưu trước khi cập nhật"
bash deploy/backup.sh

echo "==> Lấy code mới"
git pull --ff-only

echo "==> Build"
npm run build

echo "==> Khởi động lại web"
pm2 reload "$APP_NAME" --update-env
pm2 save >/dev/null

for i in $(seq 1 20); do
  if curl -fsS -o /dev/null http://127.0.0.1:5100/api/public/settings; then
    echo "✅ Cập nhật xong, web đang chạy ($(git log -1 --format='%h %s'))"
    exit 0
  fi
  sleep 1
done
echo "❌ Web không trả lời sau khi cập nhật. Xem lỗi: pm2 logs $APP_NAME --lines 100" >&2
exit 1
