# Đưa app Thầy Chiến Math lên Google Play

App Android (`frontend/android`, mã ứng dụng **`vn.thaychienmath.app`**) dùng chung giao diện với web và gọi máy
chủ thật **https://edugrade.vn**. Thư mục `store/` chứa sẵn ảnh cho trang ứng dụng:

| File | Dùng cho |
|---|---|
| `icon-512.png` | Biểu tượng ứng dụng (512×512) |
| `feature-graphic.png` | Ảnh bìa (1024×500) |
| `tao-anh-cua-hang.ps1` | Tạo lại 2 ảnh trên khi đổi logo |

---

## Bước 1 — Thử app trên điện thoại thật

Build app mới nhất (trong thư mục `frontend`):

```bash
npm run build:android
```

Rồi mở Android Studio (`npm run android`), cắm điện thoại (bật *Gỡ lỗi USB*), bấm ▶ Run.
Hoặc cài file APK đã build sẵn: `frontend/android/app/build/outputs/apk/debug/app-debug.apk`
(chép sang điện thoại, mở file, cho phép "cài ứng dụng không rõ nguồn").

Thử lần lượt — ghi lại chỗ nào lỗi:

- [ ] Mở app: màn chờ có logo A+; đồng hồ/pin **không đè** lên thanh trên cùng; thanh dưới không bị thanh cử chỉ che
- [ ] Trang chủ: khóa học có học phí, bấm **Đăng ký** gửi được đơn; mục Đề và chuyên môn mở được đề, xem được PDF
- [ ] Đăng nhập đủ 4 mục: **Giáo viên**, **Học sinh**, **Phụ huynh** (tên đăng nhập của con), **quản trị**
- [ ] Học sinh: mở bài tập, **chụp ảnh bài làm bằng camera** nộp bài; xem đề PDF; xem điểm & nhận xét
- [ ] Giáo viên: xem bài nộp, ảnh bài làm; **tải PDF nhận xét / Excel bảng điểm** → hiện bảng Chia sẻ (lưu Drive, gửi Zalo)
- [ ] Nút **Back** của điện thoại: đóng menu/hộp thoại trước, rồi lùi trang; ở trang chính thì thu nhỏ app (không thoát nhầm về trang đăng nhập)
- [ ] Điện thoại bật **chế độ tối**: chữ & biểu tượng trên thanh trạng thái vẫn nhìn rõ
- [ ] Tắt mạng giữa chừng rồi bật lại: app không treo, tải lại được

---

## Bước 2 — Tạo khóa ký app (làm 1 lần, cực kỳ quan trọng)

Google Play chỉ nhận bản cập nhật được ký bằng **đúng khóa của lần đầu**. Mất khóa = không cập nhật app được nữa.

1. Android Studio → **Build → Generate Signed App Bundle or APK** → chọn **Android App Bundle** → Next.
2. **Key store path → Create new…**
   - Lưu file ở chỗ an toàn **ngoài thư mục dự án**, vd `D:\KhoaKyApp\thaychienmath.jks`
   - Tự đặt mật khẩu kho khóa + mật khẩu khóa (alias vd `thaychienmath`), điền họ tên/tổ chức
3. Chọn bản **release** → Create. File kết quả: `frontend/android/app/release/app-release.aab`.
4. **Sao lưu ngay** file `.jks` và 2 mật khẩu vào ít nhất 2 nơi (USB, ổ đám mây riêng). Không gửi qua Zalo/email, không đưa lên GitHub (`.gitignore` đã chặn `*.jks`, `*.keystore`).
5. Khi tạo app trên Play Console, dùng **Play App Signing** (mặc định) — Google giữ thêm một khóa phát hành, khóa của bạn là khóa tải lên.

---

## Bước 3 — Tài khoản Google Play Console

- Đăng ký tại https://play.google.com/console — phí **25 USD một lần**, xác minh danh tính (CCCD) và số điện thoại; duyệt mất vài ngày.
- Tài khoản **cá nhân** mới: bắt buộc **thử nghiệm kín với ít nhất 12 người trong 14 ngày** trước khi được phát hành công khai (bước 6). Tài khoản **tổ chức** (doanh nghiệp, cần số D-U-N-S) không bị yêu cầu này.

---

## Bước 4 — Trang ứng dụng (chép sẵn)

**Tên ứng dụng** (≤ 30 ký tự): `Thầy Chiến Math`

**Mô tả ngắn** (≤ 80 ký tự):

> Học Toán THCS: bài tập, nộp bài bằng ảnh, chấm điểm AI, phụ huynh theo dõi.

**Mô tả đầy đủ:**

> Thầy Chiến Math là ứng dụng học Toán THCS (lớp 6–9) dành cho học sinh, phụ huynh và giáo viên của trung tâm Thầy Chiến Math.
>
> DÀNH CHO HỌC SINH
> • Xem bài giảng, video và tài liệu của lớp
> • Làm bài tập, chụp ảnh bài làm bằng điện thoại để nộp
> • Nhận điểm và nhận xét chi tiết từng câu, xem đáp án và video chữa bài
> • Nhắc hạn nộp bài, bảng xếp hạng trong lớp
>
> DÀNH CHO PHỤ HUYNH
> • Đăng nhập bằng tên đăng nhập của con
> • Theo dõi điểm, bài đã nộp, bài còn thiếu và nhận xét của thầy cô
>
> DÀNH CHO GIÁO VIÊN
> • Giao bài, xem bài nộp, chấm bài nhanh với hỗ trợ của AI
> • Thống kê lớp, xuất bảng điểm Excel và phiếu nhận xét PDF
>
> KHO ĐỀ & ĐĂNG KÝ HỌC
> • Kho đề kiểm tra, đề khảo sát Toán theo từng lớp
> • Xem học phí các khóa học, đăng ký học và chọn lịch thi thử đầu vào
>
> Tài khoản học sinh do trung tâm cấp. Website: https://edugrade.vn

**Đồ họa:** biểu tượng `store/icon-512.png`, ảnh bìa `store/feature-graphic.png`, và **ít nhất 2 ảnh chụp màn hình điện thoại** — chụp trên điện thoại thật khi thử ở bước 1 (gợi ý: trang chủ, thẻ bài tập có điểm, trang xem đề, trang phụ huynh).

**Danh mục:** Giáo dục · **Email liên hệ:** email của trung tâm (bắt buộc, hiện công khai)

**Chính sách quyền riêng tư:** `https://edugrade.vn/chinh-sach-bao-mat`

> Trước khi gửi duyệt: vào trang quản trị → **Nội dung trang → Liên hệ & Trang chủ**, điền điện thoại/email/địa chỉ —
> trang chính sách bảo mật lấy thông tin liên hệ từ đây.

---

## Bước 5 — Mục "Nội dung ứng dụng" (App content)

**Quyền truy cập ứng dụng (App access)** — app cần đăng nhập nên phải đưa tài khoản cho người duyệt của Google:
tạo 1 lớp thử + 1 tài khoản học sinh thử (có vài bài tập) trên edugrade.vn, rồi chọn *"Toàn bộ hoặc một số chức năng bị hạn chế"* và điền tên đăng nhập / mật khẩu / hướng dẫn: *"Mở app → Đăng nhập → chọn mục Học sinh"*.
Giữ tài khoản này hoạt động suốt thời gian app trên cửa hàng.

**Quảng cáo:** Không có quảng cáo.

**An toàn dữ liệu (Data safety)** — câu trả lời gợi ý (khớp với chính sách bảo mật):

| Câu hỏi | Trả lời |
|---|---|
| Có thu thập/chia sẻ dữ liệu người dùng? | **Có** thu thập |
| Mã hóa khi truyền? | **Có** (HTTPS) |
| Người dùng yêu cầu xóa dữ liệu được không? | **Có** — URL: `https://edugrade.vn/chinh-sach-bao-mat#xoa-du-lieu` |
| Thông tin cá nhân → **Tên** | Thu thập · Bắt buộc · Mục đích: *Chức năng ứng dụng*, *Quản lý tài khoản* |
| Thông tin cá nhân → **Số điện thoại** | Thu thập (số phụ huynh) · Bắt buộc · *Chức năng ứng dụng*, *Quản lý tài khoản* |
| **Ảnh** | Thu thập (ảnh bài làm) · Bắt buộc khi nộp bài · *Chức năng ứng dụng* |
| **Tệp và tài liệu** | Thu thập (PDF bài làm) · *Chức năng ứng dụng* |
| Hoạt động trong ứng dụng → **Nội dung khác do người dùng tạo** | Thu thập (câu trả lời, bài làm) · *Chức năng ứng dụng* |
| Có **chia sẻ** cho bên thứ ba? | **Không** — gửi bài cho AI (Google, Anthropic) để chấm là *nhà cung cấp dịch vụ xử lý thay cho trung tâm*, Google không tính là "chia sẻ" |

**Đối tượng mục tiêu:** chọn **đúng độ tuổi người dùng thật**. Học sinh lớp 6–7 khoảng 11–13 tuổi → nhóm tuổi có cả **dưới 13** → app thuộc **chính sách Gia đình (Families)** của Google. App đã đáp ứng các điểm chính: không quảng cáo, không SDK theo dõi/quảng cáo, có chính sách bảo mật, không thu thập vị trí hay mã quảng cáo. Đừng chọn "chỉ 18+" để né — Google có thể gỡ app nếu khai sai.

**Phân loại nội dung:** làm bảng hỏi, danh mục *Giáo dục / Tham khảo*; trả lời *Không* cho bạo lực, nội dung người lớn, cờ bạc… → thường ra mức *Mọi lứa tuổi*.

---

## Bước 6 — Thử nghiệm kín → phát hành

1. **Kiểm thử → Thử nghiệm kín → Tạo bản phát hành**, tải `app-release.aab` lên.
2. Thêm **ít nhất 12 người thử** (email Gmail — giáo viên, phụ huynh), gửi họ đường link tham gia; họ phải **giữ cài app 14 ngày liền**.
3. Sau 14 ngày: **Bản phát hành chính thức → Xin quyền truy cập bản chính thức**, trả lời vài câu về đợt thử nghiệm → gửi duyệt (thường 1–7 ngày).

---

## Cập nhật app sau này

- Sửa **giao diện/tính năng web**: chỉ cần push code — web tự cập nhật; **app trên điện thoại vẫn chạy giao diện cũ đóng gói sẵn** cho tới khi phát hành bản app mới.
- Phát hành bản app mới:
  1. `frontend/android/app/build.gradle`: tăng `versionCode` (vd `1` → `2`) và `versionName` (vd `1.0.1`)
  2. `cd frontend && npm run build:android`
  3. Android Studio → Generate Signed App Bundle (cùng file `.jks`) → tải `.aab` lên Play Console
- Thay đổi chỉ ở **backend** (API, chấm bài…) không cần phát hành lại app.
