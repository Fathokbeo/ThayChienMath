# Đưa Thầy Chiến Math lên web thật (VPS + tên miền riêng)

Mô hình: **1 VPS Ubuntu** chạy cả giao diện lẫn backend (Node.js), **nginx** đứng trước để nhận
HTTPS và chuyển vào web, **pm2** giữ web luôn chạy. Database SQLite và file tải lên nằm ngay trên VPS,
được **sao lưu tự động mỗi đêm**.

---

## 1. Chuẩn bị

**VPS** (thuê ở nhà cung cấp bất kỳ):

| | Tối thiểu | Nên dùng |
|---|---|---|
| Hệ điều hành | Ubuntu 22.04 | **Ubuntu 24.04** |
| RAM | 1 GB (script tự tạo thêm bộ nhớ ảo) | 2 GB |
| Ổ đĩa | 25 GB | 40 GB trở lên — video bài giảng tốn chỗ |

Sau khi thuê, bạn có: **địa chỉ IP** của VPS và **mật khẩu root** (hoặc khóa SSH).

**Tên miền** — vào trang quản lý tên miền (nơi bạn mua), mục DNS, tạo 2 bản ghi:

| Loại | Tên (Host) | Giá trị |
|---|---|---|
| A | `@` | IP của VPS |
| A | `www` | IP của VPS |

DNS cập nhật mất từ vài phút tới vài giờ. Kiểm tra trên máy tính: `ping tenmien.vn` ra đúng IP là được.

---

## 2. Cài đặt (làm 1 lần, khoảng 15 phút)

**Bước 1 — Đăng nhập VPS.** Trên Windows mở PowerShell:

```bash
ssh root@IP_CUA_VPS
```

**Bước 2 — Lấy mã nguồn về VPS:**

```bash
git clone https://github.com/Fathokbeo/ThayChienMath.git /var/www/thaychienmath
```

> Nếu repo GitHub để **riêng tư**: GitHub sẽ hỏi tài khoản — mật khẩu là một *Personal access token*
> (GitHub → Settings → Developer settings → Personal access tokens, quyền đọc repo).

**Bước 3 — Chạy script cài đặt:**

```bash
sudo bash /var/www/thaychienmath/deploy/setup-vps.sh
```

Script hỏi lần lượt:
- **Tên miền** — vd `thaychienmath.vn` (không gõ `https://`, không gõ `www`)
- **Email** — để Let's Encrypt báo khi chứng chỉ HTTPS sắp hết hạn (chứng chỉ tự gia hạn)
- **Tên đăng nhập + mật khẩu quản trị** — mật khẩu ít nhất 10 ký tự. **Ghi lại cẩn thận.**
- **GEMINI_API_KEY / ANTHROPIC_API_KEY** — để chấm bài bằng AI; Enter để bỏ qua, thêm sau được (mục 5)

Rồi tự làm hết: cài Node.js 22, nginx, pm2 · tạo `backend/.env` với khóa bí mật ngẫu nhiên · build ·
chạy web · cấu hình nginx · bật tường lửa · cấp HTTPS · đặt lịch sao lưu.

**Bước 4 — Mở `https://tenmien.vn`**, đăng nhập mục **Giáo viên** bằng tài khoản quản trị vừa tạo.
Web bắt đầu **trống** — vào trang quản trị để tạo giáo viên, khóa học, lớp, nội dung trang chủ.

> Script báo *"Tên miền chưa trỏ về IP"*: DNS chưa cập nhật xong. Web vẫn chạy được bằng `http://IP`.
> Đợi DNS xong thì chạy lại `sudo bash /var/www/thaychienmath/deploy/setup-vps.sh` (an toàn, không mất gì)
> để cấp HTTPS.

---

## 3. Cập nhật khi có code mới

Push code lên GitHub như bình thường, rồi trên VPS:

```bash
sudo bash /var/www/thaychienmath/deploy/update.sh
```

Script tự: sao lưu → lấy code mới → build → khởi động lại → kiểm tra web còn chạy.

---

## 4. Sao lưu & khôi phục

- **Tự động mỗi đêm 2:30** vào `/var/backups/thaychienmath/`:
  - `db/mathweb-<ngày>.db.gz` — database, giữ 14 ngày gần nhất
  - `uploads/` — bản sao đề bài, bài nộp, video, ảnh
- Bản sao lưu đang nằm **cùng VPS** — VPS hỏng là mất cả. **Mỗi tuần nên tải về máy tính**
  (PowerShell trên máy bạn):

  ```bash
  scp -r root@IP_CUA_VPS:/var/backups/thaychienmath D:\SaoLuu\thaychienmath
  ```

- Sao lưu ngay lúc bất kỳ: `sudo -u thaychien bash /var/www/thaychienmath/deploy/backup.sh`

**Khôi phục database** (vd xóa nhầm dữ liệu) — thay `<ngày>` bằng bản muốn lấy lại:

```bash
sudo -u thaychien pm2 stop thaychienmath
cd /var/www/thaychienmath/backend/data
sudo -u thaychien cp mathweb.db mathweb.db.truoc-khoi-phuc
sudo -u thaychien rm -f mathweb.db-wal mathweb.db-shm
gunzip -c /var/backups/thaychienmath/db/mathweb-<ngày>.db.gz | sudo -u thaychien tee mathweb.db >/dev/null
sudo -u thaychien pm2 start thaychienmath
```

> ⚠️ Database lưu **mật khẩu học sinh dạng chữ thường** (để giáo viên xem lại cho học sinh). Giữ file
> sao lưu cẩn thận như giữ sổ mật khẩu — không gửi qua Zalo/email, không để ở thư mục chia sẻ.

---

## 5. Việc thường gặp

| Việc | Lệnh trên VPS |
|---|---|
| Xem log / lỗi | `sudo -u thaychien pm2 logs thaychienmath` |
| Khởi động lại web | `sudo -u thaychien pm2 restart thaychienmath` |
| Quên / đổi mật khẩu quản trị | `cd /var/www/thaychienmath/backend && sudo -u thaychien npm run admin:password` |
| Thêm / đổi API key chấm AI | `sudo nano /var/www/thaychienmath/backend/.env` → sửa dòng `GEMINI_API_KEY=` / `ANTHROPIC_API_KEY=` → lưu (Ctrl+O, Enter, Ctrl+X) → `sudo -u thaychien pm2 restart thaychienmath --update-env` |
| Xem dung lượng ổ đĩa | `df -h /` |

**Lỗi thường gặp**
- *502 Bad Gateway* — web Node đang không chạy: xem log bằng lệnh ở bảng trên.
- *Tải video lên bị lỗi 413* — file quá 520MB (giới hạn trong `deploy/nginx.conf.template`).
- *Chấm AI không chạy* — chưa có API key, hoặc key sai/hết hạn mức: xem log.

---

## 6. App Android trỏ về web thật

Sửa `frontend/.env.android` trên máy tính:

```
VITE_API_URL=https://tenmien.vn
```

rồi build lại app (`cd frontend && npm run build:android`) và chạy bằng Android Studio.
App cũ (đang trỏ về bản demo Render) sẽ không thấy dữ liệu thật cho tới khi cài bản mới.

---

## 7. Kiểm tra sau khi lên web

- [ ] `https://tenmien.vn` mở được, có ổ khóa HTTPS; `http://` tự chuyển sang `https://`
- [ ] Trang đăng nhập **không** hiện khung "Tài khoản dùng thử"
- [ ] Đăng nhập quản trị được; tạo thử 1 giáo viên, 1 lớp, 1 học sinh
- [ ] Học sinh nộp thử 1 bài có ảnh → AI chấm ra điểm (nếu đã có API key)
- [ ] Xem được đề PDF, ảnh bài nộp; tải lên được video bài giảng
- [ ] Sáng hôm sau có file trong `/var/backups/thaychienmath/db/`
