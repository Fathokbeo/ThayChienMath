#!/usr/bin/env bash
# Tăng bảo mật cho VPS — chạy bằng quyền root, chạy lại nhiều lần vẫn an toàn:
#   sudo bash /var/www/thaychienmath/deploy/harden-vps.sh            # chặn dò mật khẩu SSH, ẩn phiên bản nginx, khóa database
#   sudo bash /var/www/thaychienmath/deploy/harden-vps.sh --key-only # + TẮT đăng nhập SSH bằng mật khẩu (chỉ dùng khóa SSH)
# setup-vps.sh gọi script này (không kèm --key-only) ở bước cuối.
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_USER="$(stat -c %U "$APP_DIR")"
KEY_ONLY=0; [ "${1:-}" = "--key-only" ] && KEY_ONLY=1

say()  { echo -e "\n\033[1;36m==> $*\033[0m"; }
warn() { echo -e "\033[1;33m[!] $*\033[0m"; }
[ "$(id -u)" -eq 0 ] || { echo "Cần chạy bằng quyền root: sudo bash $0" >&2; exit 1; }

# ── 1. fail2ban: ai đăng nhập SSH sai 5 lần trong 10 phút bị chặn IP 1 giờ ──
say "Chặn dò mật khẩu SSH (fail2ban)"
command -v fail2ban-client >/dev/null || { export DEBIAN_FRONTEND=noninteractive; apt-get update -y; apt-get install -y fail2ban; }
cat > /etc/fail2ban/jail.d/thaychienmath-sshd.local <<'EOF'
[sshd]
enabled = true
backend = systemd
maxretry = 5
findtime = 10m
bantime = 1h
EOF
systemctl enable --now fail2ban
systemctl restart fail2ban

# ── 2. nginx: không lộ số phiên bản trong header / trang lỗi ──
say "Ẩn phiên bản nginx"
echo 'server_tokens off;' > /etc/nginx/conf.d/thaychienmath-security.conf
nginx -t && systemctl reload nginx

# ── 3. Database + file cấu hình: chỉ người dùng chạy web đọc được ──
say "Khóa quyền đọc database và .env"
chmod 700 "$APP_DIR/backend/data"
find "$APP_DIR/backend/data" -maxdepth 1 -type f -name 'mathweb.db*' -exec chmod 600 {} +
[ -f "$APP_DIR/backend/.env" ] && chmod 600 "$APP_DIR/backend/.env"
chown -R "$APP_USER:$APP_USER" "$APP_DIR/backend/data"

# ── 4. (Tùy chọn) Chỉ cho đăng nhập SSH bằng khóa, tắt mật khẩu ──
if [ "$KEY_ONLY" -eq 1 ]; then
  say "Tắt đăng nhập SSH bằng mật khẩu"
  if [ ! -s /root/.ssh/authorized_keys ]; then
    warn "root CHƯA có khóa SSH (/root/.ssh/authorized_keys trống) — KHÔNG tắt mật khẩu để tránh bị khóa ngoài. Thêm khóa trước rồi chạy lại."
  else
    # Tên 00-... để được đọc TRƯỚC các file cloud-init (giá trị đọc trước được dùng)
    cat > /etc/ssh/sshd_config.d/00-thaychienmath-hardening.conf <<'EOF'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin prohibit-password
MaxAuthTries 4
EOF
    sshd -t && (systemctl reload ssh 2>/dev/null || systemctl reload sshd)
    echo "Đã tắt đăng nhập bằng mật khẩu. Đăng nhập: ssh -i <khóa riêng> root@<IP>. Kẹt thì dùng Console của nhà cung cấp VPS."
  fi
fi

say "XONG"
fail2ban-client status sshd | sed -n '1,8p' || true
sshd -T 2>/dev/null | grep -E '^(passwordauthentication|permitrootlogin) ' || true
