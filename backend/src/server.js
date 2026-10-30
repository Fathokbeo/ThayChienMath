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
app.use(cors({ origin: [FRONTEND_URL, 'http://localhost:5174', 'https://localhost', 'capacitor://localhost'], credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');       // không đoán kiểu file → chặn vài kiểu tấn công qua file tải lên
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');            // chỉ trang mình được nhúng iframe (trình xem PDF vẫn chạy)
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
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
app.use((err, req, res, next) => {
  const { redactSecrets } = require('./services/security');
  const safe = redactSecrets(err.message || 'Lỗi server');
  console.error('[ERROR]', safe);
  res.status(err.status || 500).json({ message: safe });
});

const server = app.listen(PORT, () => {
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
