#!/usr/bin/env bash
# Cài đặt Thầy Chiến Math lên VPS Ubuntu (22.04 / 24.04) — chạy MỘT LẦN, bằng quyền root:
#   sudo bash /var/www/thaychienmath/deploy/setup-vps.sh
# Script hỏi: tên miền, email (cho chứng chỉ HTTPS), tài khoản quản trị, API key chấm bài AI.
# Chạy lại lần nữa vẫn an toàn: bước nào đã xong thì bỏ qua (không ghi đè backend/.env đã có).
set -euo pipefail
# Quyền tạo file mặc định: ai cũng đọc được (pm2, thư viện cài -g phải đọc được bằng user chạy web).
# File bí mật (.env) được khóa riêng bên dưới.
umask 022

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_USER="thaychien"
APP_NAME="thaychienmath"
BACKUP_DIR="/var/backups/thaychienmath"
ENV_FILE="$APP_DIR/backend/.env"

say()  { echo -e "\n\033[1;36m==> $*\033[0m"; }
warn() { echo -e "\033[1;33m[!] $*\033[0m"; }
die()  { echo -e "\033[1;31m[x] $*\033[0m" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "Cần chạy bằng quyền root: sudo bash $0"
grep -qi ubuntu /etc/os-release || warn "Script viết cho Ubuntu — hệ điều hành khác có thể lỗi."
[ -f "$APP_DIR/package.json" ] || die "Không thấy mã nguồn ở $APP_DIR (hãy git clone trước, xem HUONG_DAN_DEPLOY.md)."

# ── 1. Hỏi thông tin ───────────────────────────────────────────────────
say "Thông tin cài đặt"
read -rp "Tên miền chính (vd thaychienmath.vn, không có http/www): " DOMAIN
DOMAIN="${DOMAIN#http://}"; DOMAIN="${DOMAIN#https://}"; DOMAIN="${DOMAIN#www.}"; DOMAIN="${DOMAIN%/}"
[[ "$DOMAIN" =~ ^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$ ]] || die "Tên miền không hợp lệ: $DOMAIN"
read -rp "Email nhận thông báo chứng chỉ HTTPS: " EMAIL
[[ "$EMAIL" == *@*.* ]] || die "Email không hợp lệ."

if [ ! -f "$ENV_FILE" ]; then
  read -rp "Tên đăng nhập quản trị (chữ không dấu, vd quantri): " ADMIN_USERNAME
  [[ "$ADMIN_USERNAME" =~ ^[a-zA-Z0-9._-]{3,40}$ ]] || die "Tên đăng nhập không hợp lệ."
  while true; do
    read -rsp "Mật khẩu quản trị (ít nhất 10 ký tự, không hiện khi gõ): " ADMIN_PASSWORD; echo
    [ "${#ADMIN_PASSWORD}" -ge 10 ] || { warn "Quá ngắn, nhập lại."; continue; }
    read -rsp "Nhập lại mật khẩu: " ADMIN_PASSWORD2; echo
    [ "$ADMIN_PASSWORD" = "$ADMIN_PASSWORD2" ] && break
    warn "Hai lần nhập không khớp, nhập lại."
  done
  read -rsp "GEMINI_API_KEY (Enter để bỏ qua): " GEMINI_KEY; echo
  read -rsp "ANTHROPIC_API_KEY (Enter để bỏ qua): " ANTHROPIC_KEY; echo
else
  warn "Đã có $ENV_FILE — giữ nguyên (không hỏi lại tài khoản quản trị / API key)."
fi

# ── 2. Bộ nhớ ảo (VPS ít RAM dễ hết bộ nhớ khi build giao diện) ─────────
MEM_MB=$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)
if [ "$MEM_MB" -lt 2000 ] && ! swapon --show | grep -q .; then
  say "RAM ${MEM_MB}MB — tạo 2GB bộ nhớ ảo (swap)"
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# ── 3. Phần mềm hệ thống ───────────────────────────────────────────────
say "Cài phần mềm hệ thống (nginx, certbot, git, công cụ build...)"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
# cron: Ubuntu bản thu gọn (minimized) không có sẵn — thiếu thì sao lưu hằng đêm & tự động deploy không chạy
apt-get install -y curl ca-certificates git nginx rsync build-essential python3 ufw certbot python3-certbot-nginx cron sudo openssl
systemctl enable --now cron

if ! command -v node >/dev/null || [[ "$(node -v)" != v22* ]]; then
  say "Cài Node.js 22"
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
command -v pm2 >/dev/null || { say "Cài pm2"; npm install -g pm2; }

# ── 4. Người dùng chạy web (không chạy web bằng root) ──────────────────
id -u "$APP_USER" >/dev/null 2>&1 || useradd --create-home --shell /bin/bash "$APP_USER"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"
mkdir -p "$BACKUP_DIR" && chown "$APP_USER:$APP_USER" "$BACKUP_DIR" && chmod 700 "$BACKUP_DIR"
as_app() { sudo -u "$APP_USER" -H bash -c "cd '$APP_DIR' && $*"; }

# ── 5. File cấu hình bí mật backend/.env ───────────────────────────────
if [ ! -f "$ENV_FILE" ]; then
  say "Tạo backend/.env"
  umask 077
  cat > "$ENV_FILE" <<EOF
NODE_ENV=production
PORT=5100
FRONTEND_URL=https://$DOMAIN
JWT_SECRET=$(openssl rand -hex 48)
GEMINI_API_KEY=$GEMINI_KEY
ANTHROPIC_API_KEY=$ANTHROPIC_KEY
SEED_DEMO=0
# Chỉ dùng ở lần chạy đầu để tạo tài khoản quản trị — setup-vps.sh tự xóa sau khi tạo xong
ADMIN_USERNAME=$ADMIN_USERNAME
ADMIN_PASSWORD=$ADMIN_PASSWORD
EOF
  umask 022
  chown "$APP_USER:$APP_USER" "$ENV_FILE"; chmod 600 "$ENV_FILE"
fi

# ── 6. Build giao diện + cài thư viện backend ──────────────────────────
say "Build (có thể mất 3–10 phút)"
as_app "npm run build"

# ── 7. Chạy web bằng pm2, tự bật khi khởi động lại VPS ─────────────────
say "Khởi động web"
if as_app "pm2 describe $APP_NAME" >/dev/null 2>&1; then
  as_app "pm2 reload $APP_NAME --update-env"
else
  as_app "pm2 start deploy/ecosystem.config.js"
fi
as_app "pm2 save"
pm2 startup systemd -u "$APP_USER" --hp "/home/$APP_USER" >/dev/null

for i in $(seq 1 20); do
  curl -fsS -o /dev/null http://127.0.0.1:5100/api/public/settings && break
  sleep 1
  [ "$i" -eq 20 ] && die "Web không chạy lên được. Xem lỗi: sudo -u $APP_USER pm2 logs $APP_NAME"
done
# Tài khoản quản trị đã được tạo ở lần chạy đầu → xóa mật khẩu khỏi .env cho an toàn
if grep -q '^ADMIN_PASSWORD=' "$ENV_FILE"; then
  sed -i '/^ADMIN_PASSWORD=/d; /^ADMIN_USERNAME=/d; /^# Chỉ dùng ở lần chạy đầu/d' "$ENV_FILE"
  as_app "pm2 reload $APP_NAME --update-env" >/dev/null
fi

# ── 8. nginx ───────────────────────────────────────────────────────────
say "Cấu hình nginx"
SERVER_IP=$(curl -fsS https://api.ipify.org || true)
resolves_here() { getent ahosts "$1" | awk '{print $1}' | grep -qx "$SERVER_IP"; }
SERVER_NAMES="$DOMAIN"; CERT_DOMAINS="-d $DOMAIN"
if resolves_here "www.$DOMAIN"; then SERVER_NAMES="$DOMAIN www.$DOMAIN"; CERT_DOMAINS="$CERT_DOMAINS -d www.$DOMAIN"; fi
NGINX_SITE="/etc/nginx/sites-available/$APP_NAME"
if [ ! -f "$NGINX_SITE" ] || ! grep -q "listen 443" "$NGINX_SITE"; then
  sed "s/__SERVER_NAMES__/$SERVER_NAMES/" "$APP_DIR/deploy/nginx.conf.template" > "$NGINX_SITE"
fi
ln -sf "$NGINX_SITE" "/etc/nginx/sites-enabled/$APP_NAME"
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# ── 9. Tường lửa: chỉ mở SSH + web ─────────────────────────────────────
say "Bật tường lửa (SSH, HTTP, HTTPS)"
# Mở đúng cổng SSH đang dùng (VPS đổi cổng SSH khác 22 mà chỉ mở 22 thì sẽ tự khóa mình ở ngoài)
SSH_PORT="$(sshd -T 2>/dev/null | awk '/^port /{print $2; exit}')"
ufw allow "${SSH_PORT:-22}/tcp" >/dev/null
ufw allow OpenSSH >/dev/null
ufw allow 'Nginx Full' >/dev/null
ufw --force enable >/dev/null

# ── 10. HTTPS (Let's Encrypt, tự gia hạn) ─────────────────────────────
say "Cấp chứng chỉ HTTPS"
if resolves_here "$DOMAIN"; then
  # shellcheck disable=SC2086
  certbot --nginx $CERT_DOMAINS --redirect --agree-tos -m "$EMAIL" -n || warn "Cấp HTTPS lỗi — xem thông báo phía trên rồi chạy lại script."
else
  warn "Tên miền $DOMAIN chưa trỏ về IP $SERVER_IP của VPS này (bản ghi DNS có thể chưa cập nhật)."
  warn "Đợi DNS cập nhật (vài phút tới vài giờ) rồi chạy: sudo certbot --nginx $CERT_DOMAINS --redirect --agree-tos -m $EMAIL"
fi

# ── 11. Sao lưu tự động mỗi đêm 2:30 ──────────────────────────────────
say "Đặt lịch sao lưu hằng đêm"
touch /var/log/thaychienmath-backup.log && chown "$APP_USER:$APP_USER" /var/log/thaychienmath-backup.log
cat > /etc/cron.d/thaychienmath-backup <<EOF
30 2 * * * $APP_USER bash $APP_DIR/deploy/backup.sh >> /var/log/thaychienmath-backup.log 2>&1
EOF
chmod 644 /etc/cron.d/thaychienmath-backup

# ── 12. Tự động deploy: push lên GitHub là web tự cập nhật (kiểm tra mỗi phút) ──
say "Bật tự động deploy khi có code mới trên GitHub"
touch /var/log/thaychienmath-deploy.log && chown "$APP_USER:$APP_USER" /var/log/thaychienmath-deploy.log
cat > /etc/cron.d/thaychienmath-deploy <<EOF
* * * * * $APP_USER bash $APP_DIR/deploy/auto-deploy.sh >> /var/log/thaychienmath-deploy.log 2>&1
EOF
chmod 644 /etc/cron.d/thaychienmath-deploy

say "XONG!"
echo "  Web:          https://$DOMAIN"
echo "  Xem log:      sudo -u $APP_USER pm2 logs $APP_NAME"
echo "  Cập nhật:     tự động sau khi push lên GitHub (1–5 phút) — log: /var/log/thaychienmath-deploy.log"
echo "                (cập nhật ngay bằng tay: sudo bash $APP_DIR/deploy/update.sh)"
echo "  Sao lưu tại:  $BACKUP_DIR (mỗi đêm 2:30)"
echo "  Quên mật khẩu quản trị:  cd $APP_DIR/backend && sudo -u $APP_USER npm run admin:password"
