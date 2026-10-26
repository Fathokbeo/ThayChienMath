# Thầy Chiến Math

Ứng dụng web full-stack học Toán của Thầy Chiến: quản lý khóa học, lớp học, bài giảng, bài tập với **chấm điểm bằng AI (Google Gemini)**, cùng các trang giới thiệu công khai do admin tự quản lý.

## Tính năng

**4 vai trò:** Admin · Giáo viên · Học sinh · Phụ huynh

- **Admin:** quản lý tài khoản (xem được mật khẩu, xóa/vô hiệu hóa, chọn nhiều), khóa học, lớp học, quảng cáo banner, và toàn bộ nội dung trang giới thiệu (học sinh tiêu biểu, giáo viên, khóa học tiêu biểu, thành tích, liên hệ).
- **Giáo viên:** tạo khóa học và lớp học bên trong khóa, tạo tài khoản học sinh, thêm/đổi lớp cho học sinh, soạn bài giảng (YouTube/video), giao bài tập (PDF) kèm đáp án để **AI tự chấm**.
- **Học sinh:** xem lớp/bài giảng, nộp bài (PDF/ảnh) và nhận điểm + nhận xét tự động ngay sau khi nộp.
- **Phụ huynh:** tài khoản tự tạo cùng học sinh. Đăng nhập mục "Phụ huynh" bằng tên đăng nhập của con, mật khẩu mặc định = SĐT phụ huynh (chưa có SĐT thì dùng mật khẩu của con). Chỉ xem: điểm TB + thứ hạng tháng, nộp bài, việc cần chú ý, bài sắp đến hạn, nhận xét tổng quát (tự động + giáo viên viết), biểu đồ điểm so với TB lớp, thông báo hoạt động, nhận xét từng bài (mở cùng lúc với đáp án).

## Công nghệ

- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS v4
- **Backend:** Node.js + Express 5 + better-sqlite3 + JWT + multer
- **AI chấm bài:** Google Gemini (`gemini-2.5-flash`)

## Cài đặt

### 1. Backend
```bash
cd backend
npm install
cp .env.example .env        # rồi điền GEMINI_API_KEY của bạn
node src/server.js          # chạy tại http://localhost:5100
```

### 2. Frontend
```bash
cd frontend
npm install
npm run dev                 # chạy tại http://localhost:5174
```

Hoặc trên Windows chạy `start.bat` để mở cả hai cùng lúc.

### Tài khoản mặc định
- Admin: `admin` / `admin123` (đổi mật khẩu ngay sau khi đăng nhập)

## Dữ liệu demo (bản xem thử)

Chạy trên Render (tự nhận biết qua biến `RENDER`) hoặc đặt `SEED_DEMO=1`: khi database còn trống, server tự nạp dữ liệu demo
lấy từ đề, đáp án và bài làm thật (`backend/demo/`) kèm kết quả AI đã chấm sẵn. Họ tên học sinh trên web là tên giả.
Chạy tay: `cd backend && npm run seed:demo`.

| Vai trò | Mục đăng nhập | Tên đăng nhập | Mật khẩu |
|---|---|---|---|
| Quản trị | Giáo viên | `admin` | `admin123` |
| Giáo viên | Giáo viên | `thaychien` | `123456` |
| Học sinh lớp 6A (Học sinh 1–12) | Học sinh | `hs1` … `hs12` | `123456` |
| Học sinh lớp 9A (Học sinh 13–22) | Học sinh | `hs13` … `hs22` | `123456` |
| Phụ huynh | Phụ huynh | tên đăng nhập của con (vd `hs1`) | `123456` |

Ở bản demo, trang đăng nhập hiện sẵn khung "Tài khoản dùng thử": bấm một tài khoản là đăng nhập luôn.

Dữ liệu: đề KT HK2 Toán 6 (12 bài làm), BTVN lập hệ phương trình (2 bài), toán thực tế bất phương trình (1 bài),
ôn tập tam giác đồng dạng (10 bài) — tất cả đã được AI chấm sẵn; mỗi lớp có thêm 1 bài "Nộp thử" đang mở để nộp bài mới.

Render gói free không lưu dữ liệu lâu dài: mỗi lần deploy / khởi động lại, dữ liệu trở về bộ demo này.
Khi dùng thật: đặt `SEED_DEMO=0`, gắn ổ đĩa lưu trữ (persistent disk) và đổi mật khẩu admin.

## Cấu hình môi trường (`backend/.env`)

| Biến | Mô tả |
|------|-------|
| `PORT` | Cổng backend (mặc định 5100) |
| `JWT_SECRET` | Chuỗi bí mật ký JWT |
| `GEMINI_API_KEY` | Google Gemini API key ([lấy tại đây](https://aistudio.google.com/apikey)) |
| `FRONTEND_URL` | URL frontend cho CORS |

## Lưu ý bảo mật

- `backend/.env` và `backend/data/*.db` **không** được đưa lên Git (đã cấu hình trong `.gitignore`).
- Database lưu mật khẩu dạng plaintext để admin xem được — hãy giữ file `data/mathweb.db` an toàn, không chia sẻ.
