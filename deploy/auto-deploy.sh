#!/usr/bin/env bash
# Tự động deploy: cron gọi mỗi phút (setup-vps.sh đặt lịch). Thấy nhánh main trên GitHub có commit mới
# → chạy update.sh (sao lưu → lấy code → build → khởi động lại). Nhờ vậy chỉ cần `git push` là web tự cập nhật.
# Nhật ký: /var/log/thaychienmath-deploy.log
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STATE_DIR="$HOME/.thaychienmath"
mkdir -p "$STATE_DIR"

# Lần chạy trước (build mất vài phút) chưa xong thì bỏ qua lượt này
exec 9>"$STATE_DIR/auto-deploy.lock"
flock -n 9 || exit 0

cd "$APP_DIR"
git fetch -q origin main
LOCAL="$(git rev-parse HEAD)"
REMOTE="$(git rev-parse origin/main)"
[ "$LOCAL" = "$REMOTE" ] && exit 0

# Commit này đã cập nhật lỗi rồi → không build lại mỗi phút; push bản sửa mới sẽ thử lại
[ "$(cat "$STATE_DIR/failed-commit" 2>/dev/null || true)" = "$REMOTE" ] && exit 0

echo "[$(date '+%F %T')] Có code mới: $(git log -1 --format='%h %s' "$REMOTE")"
if bash deploy/update.sh; then
  rm -f "$STATE_DIR/failed-commit"
else
  echo "$REMOTE" > "$STATE_DIR/failed-commit"
  echo "[$(date '+%F %T')] ❌ Cập nhật lỗi — web vẫn chạy bản cũ. Sửa code rồi push lại."
fi
