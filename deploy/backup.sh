#!/usr/bin/env bash
# Sao lưu database + file tải lên. setup-vps.sh đặt lịch chạy mỗi đêm 2:30; update.sh chạy trước mỗi lần cập nhật.
#   - Database: 1 bản nén mỗi lần chạy, giữ KEEP_DAYS ngày gần nhất
#   - File tải lên (đề, bài nộp, video...): chép thêm file mới vào 1 bản sao (không xóa file cũ trong bản sao)
# Bản sao lưu nằm CÙNG VPS — nên định kỳ tải về máy khác (xem HUONG_DAN_DEPLOY.md, mục Sao lưu).
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/thaychienmath}"
KEEP_DAYS="${KEEP_DAYS:-14}"
TS="$(date +%Y-%m-%d_%H%M)"

mkdir -p "$BACKUP_DIR/db" "$BACKUP_DIR/uploads"
cd "$APP_DIR/backend"
node scripts/backup-db.js "$BACKUP_DIR/db/mathweb-$TS.db"
gzip -f "$BACKUP_DIR/db/mathweb-$TS.db"
rsync -a "$APP_DIR/backend/uploads/" "$BACKUP_DIR/uploads/"
find "$BACKUP_DIR/db" -name 'mathweb-*.db.gz' -mtime +"$KEEP_DAYS" -delete
echo "[$(date '+%F %T')] Sao lưu xong: db/mathweb-$TS.db.gz"
