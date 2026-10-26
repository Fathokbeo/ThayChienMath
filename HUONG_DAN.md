# Hướng dẫn cài đặt Thầy Chiến Math

## Yêu cầu
- Node.js v20.19+ hoặc v22.12+
- Google Gemini API key (để dùng chức năng AI chấm bài) — lấy tại https://aistudio.google.com/apikey

## Cài đặt lần đầu
```
cd backend
npm install
cd ../frontend
npm install
```
Tạo file `backend/.env` (xem mẫu `backend/.env.example`) và điền `GEMINI_API_KEY`, `JWT_SECRET`.
File `.env` không được đưa lên git.

## Khởi động

### Cách 1: Double-click `start.bat`

### Cách 2: Terminal riêng
```
# Terminal 1 - Backend (cổng 5100):
cd backend
node src/server.js

# Terminal 2 - Giao diện (cổng 5174):
cd frontend
npm run dev
```
Chạy được song song với web AplusHoangMai (cổng 5000/5173).

## Truy cập
- Web: http://localhost:5174
- Tài khoản mặc định: admin / admin123 (nhớ đổi mật khẩu)

## Kiểm tra (backend phải đang chạy)
```
cd backend
node test-scoring.js     # chấm điểm tự động (không cần server)
node test-all.js         # toàn bộ API, có chấm AI thật
node test-features.js    # điểm cao nhất, bài cần làm, file bài tập, xếp hạng
node test-users.js; node test-classstudents.js; node test-content.js
node test-multifile.js; node test-newfeatures.js; node test-delete.js; node test-grading.js
node test-parent.js      # tài khoản phụ huynh, đăng nhập theo mục, trang phụ huynh
```
Các test tạo dữ liệu thử trong database. Trước khi dùng thật, xóa `backend/data/mathweb.db`
(và file trong `backend/uploads/*`) để bắt đầu với database sạch.

## Tính năng
- Admin: quản lý tài khoản, khóa học, lớp học, trợ giảng, nội dung trang giới thiệu, quảng cáo
- Giáo viên: khóa học, lớp, chương, bài giảng, bài tập (trắc nghiệm / đúng-sai / trả lời ngắn / tự luận / HSA),
  AI chấm bài, nhận xét lớp (xuất PDF / Excel), xếp hạng tháng, trợ giảng
- Phụ huynh (tự tạo cùng học sinh; đăng nhập mục Phụ huynh bằng tên đăng nhập của con): điểm, thứ hạng,
  tiến độ nộp bài, bài sắp đến hạn, nhận xét tổng quát + nhận xét từng bài, biểu đồ điểm, thông báo hoạt động của con
- Học sinh: bài giảng, bài tập cần làm, làm & nộp bài (nhiều lần — lấy điểm cao nhất), xem điểm,
  nhận xét, đáp án, video chữa, xếp hạng lớp
