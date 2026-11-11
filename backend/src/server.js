require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 5100;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5174';

// Chạy sau nginx: tin cậy 1 lớp proxy để lấy đúng IP thật của client (dùng cho chặn dò mật khẩu).
app.set('trust proxy', 1);
app.disable('x-powered-by'); // không quảng cáo "Express" cho người dò lỗ hổng

// https://localhost = app Android (Capacitor), capacitor://localhost = app iOS. API chỉ nhận token ở header
// Authorization nên mở thêm 2 origin này không tạo đường CSRF.
const IS_PROD = process.env.NODE_ENV === 'production';
// localhost:5174 (máy lập trình) chỉ mở khi không chạy bản thật
app.use(cors({ origin: [FRONTEND_URL, ...(IS_PROD ? [] : ['http://localhost:5174']), 'https://localhost', 'capacitor://localhost'], credentials: true }));
// File tải lên đi qua multer (multipart) nên JSON không cần lớn — chặn gửi khối dữ liệu khổng lồ làm treo máy chủ
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// Chính sách nội dung (CSP) cho các trang web: chỉ chạy script của chính web + Google (nút đăng nhập) + YouTube/Vimeo
// (trình phát video), không nhúng plugin, không cho trang lạ nhúng web vào khung. Nếu lỡ bị chèn mã HTML lạ thì
// trình duyệt cũng không chạy script đó → không lấy được token đăng nhập.
const CSP = [
  "script-src 'self' https://accounts.google.com https://www.youtube.com https://s.ytimg.com https://player.vimeo.com",
  "frame-src 'self' https://accounts.google.com https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join('; ');

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');       // không đoán kiểu file → chặn vài kiểu tấn công qua file tải lên
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');            // chỉ trang mình được nhúng iframe (trình xem PDF vẫn chạy)
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  if (!req.path.startsWith('/uploads/')) res.setHeader('Content-Security-Policy', CSP); // file tải lên có CSP riêng
  // Chạy HTTPS (qua nginx) → bảo trình duyệt luôn dùng HTTPS cho tên miền này
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') res.setHeader('Strict-Transport-Security', 'max-age=15552000');
  next();
});

const SAFE_INLINE_EXT = new Set(['.pdf', '.jpg', '.jpeg', '.png', '.webp', '.gif', '.mp4', '.webm', '.mov', '.mkv', '.avi']);

// File tải lên: kiểm tra quyền TRƯỚC khi phục vụ. Ảnh trang giới thiệu vẫn công khai; đề bài, đáp án,
// bài nộp, video và tài liệu bài giảng thì phải đăng nhập đúng lớp mới tải được.
const { uploadsAuth, PUBLIC_DIRS } = require('./middleware/uploadsAuth');
app.use('/uploads', uploadsAuth, express.static(path.join(__dirname, '../uploads'), {
  setHeaders: (res, filePath) => {
    const dir = path.basename(path.dirname(filePath));
    // Lớp phòng thủ thứ 2 cho file cũ đã lưu với đuôi nguy hiểm (.html/.svg...): luôn tải xuống, không cho
    // trình duyệt mở và chạy script trên tên miền của web. Đuôi file mới do server tự đặt theo whitelist.
    if (!SAFE_INLINE_EXT.has(path.extname(filePath).toLowerCase())) {
      res.setHeader('Content-Disposition', 'attachment');
      res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'");
    }
    // Không cho proxy/CDN dùng chung bộ nhớ đệm cho file riêng tư
    if (!PUBLIC_DIRS.has(dir)) res.setHeader('Cache-Control', 'private, no-cache');
  },
}));

// Routes — public first to avoid auth middleware catch-all
app.use('/api/auth', require('./routes/auth'));
app.use('/api/public', require('./routes/public'));
app.use('/api/admin/content', require('./routes/content'));  // trước /api/admin
app.use('/api/admin/site', require('./routes/siteAdmin')); // tuyển sinh + đề thi (trước /api/admin)
app.use('/api/admin', require('./routes/admin'));
app.use('/api/teacher', require('./routes/teacher'));
app.use('/api/student', require('./routes/student'));
app.use('/api/parent', require('./routes/parent'));
app.use('/api', require('./routes/homework'));

// Initialize DB (creates tables + default admin)
const { getDb, checkpointDb, closeDb } = require('./db/database');
const db = getDb();
// Gộp nhật ký WAL về file database chính: ngay khi khởi động + mỗi 10 phút (xem checkpointDb)
checkpointDb();
setInterval(checkpointDb, 10 * 60 * 1000).unref();

// Bản xem thử (vd Render gói free — dữ liệu mất sau mỗi lần khởi động lại): database còn trống thì tự nạp
// dữ liệu demo (giáo viên, học sinh, phụ huynh, bài tập + kết quả chấm thật). Bật khi SEED_DEMO=1, hoặc mặc
// định khi chạy trên Render (Render tự đặt biến RENDER) — kể cả service tạo tay không qua render.yaml.
// Tắt hẳn: SEED_DEMO=0.
const seedDemo = process.env.SEED_DEMO === '1' || (process.env.RENDER && process.env.SEED_DEMO !== '0');
if (seedDemo) require('./db/demoSeed').seedDemoIfEmpty(db);

// Bật hàng đợi chấm bài AI nền (phục hồi bài còn dở + thử lại khi lỗi)
require('./services/gradingQueue').startGradingWorker();

// Gắn nhãn AI cho khóa học chưa có (lần đầu / đổi tên-mô tả) — chạy nền sau khi khởi động, kiểm tra lại mỗi 30 phút
{
  const { tagPendingCourses } = require('./services/courseTags');
  const runTagging = () => tagPendingCourses().catch((e) => console.error('[course-tags]', e.message));
  setTimeout(runTagging, 5000).unref();
  setInterval(runTagging, 30 * 60e3).unref();
}

// Serve frontend build (single-service deploy). Nếu đã build frontend, phục vụ luôn.
const frontendDist = path.join(__dirname, '../../frontend/dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  // SPA fallback: mọi request không phải /api hay /uploads trả về index.html
  app.get(/^\/(?!api|uploads).*/, (req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
  console.log('🌐 Đang phục vụ frontend từ frontend/dist');
}

// Global error handler — always return JSON. Che bí mật (API key...) trước khi trả lỗi ra ngoài.
// Lỗi kỹ thuật (database, dữ liệu gửi lên sai cú pháp, file quá lớn) không trả nguyên văn ra ngoài.
app.use((err, req, res, next) => {
  const { redactSecrets } = require('./services/security');
  const safe = redactSecrets(err.message || 'Lỗi server');
  console.error('[ERROR]', safe);
  if (err.type === 'entity.parse.failed') return res.status(400).json({ message: 'Dữ liệu gửi lên không hợp lệ' });
  if (err.type === 'entity.too.large' || err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ message: 'Dữ liệu / file gửi lên quá lớn' });
  if (err.name === 'MulterError') return res.status(400).json({ message: 'File gửi lên không hợp lệ' });
  if (String(err.code || '').startsWith('SQLITE_')) return res.status(500).json({ message: 'Lỗi máy chủ, vui lòng thử lại' });
  res.status(err.status || 500).json({ message: safe });
});

// Bản thật trên VPS: chỉ nhận kết nối từ chính máy (nginx chuyển vào), không mở cổng 5100 ra Internet
// (Render cần nghe mọi địa chỉ nên để mặc định). Đặt HOST để đổi.
const HOST = process.env.HOST || (IS_PROD && !process.env.RENDER ? '127.0.0.1' : undefined);
const server = app.listen(PORT, HOST, () => {
  console.log(`✅ Server chạy tại http://localhost:${PORT}`);
  console.log(`📐 THẦY CHIẾN MATH`);
});

// pm2 gửi SIGINT khi restart/reload/stop (deploy): ngừng nhận request mới, đóng database đúng cách để
// SQLite gộp hết nhật ký WAL vào mathweb.db rồi mới thoát. Request đang chạy dở quá 1,5s thì thôi chờ.
function shutdown(signal) {
  console.log(`[server] Nhận ${signal}, đang tắt...`);
  server.close();
  setTimeout(() => { closeDb(); process.exit(0); }, 1500).unref();
  server.once('close', () => { closeDb(); process.exit(0); });
}
process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));
