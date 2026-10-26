// Dữ liệu DEMO để xem thử web (vd bản deploy trên Render, gói free xóa sạch dữ liệu mỗi lần khởi động lại):
// 1 giáo viên, 2 lớp, 22 học sinh "Học sinh 1…22" (+ tài khoản phụ huynh tự tạo), bài tập lấy từ TOÀN BỘ đề,
// đáp án và bài làm THẬT trong thư mục dữ liệu (backend/demo/files) kèm kết quả AI đã chấm sẵn
// (backend/demo/grading.json). Bài chưa có kết quả → nạp ở trạng thái chờ, hàng đợi AI tự chấm (cần GEMINI_API_KEY).
// Mật khẩu mọi tài khoản demo: 123456 (admin giữ admin123). Trang đăng nhập hiện sẵn danh sách tài khoản demo.
//
// Chạy: tự động khi khởi động server nếu SEED_DEMO=1 (hoặc chạy trên Render) và database chưa có giáo viên nào,
//       hoặc thủ công: node src/db/demoSeed.js   (chỉ nạp khi database chưa có giáo viên)
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { ensureParentAccount } = require('../services/parentAccounts');

const DEMO_DIR = path.join(__dirname, '../../demo');
const UPLOADS = path.join(__dirname, '../../uploads');
const PASSWORD = '123456';
const DAY = 86400000;
const TEACHER = { username: 'thaychien', full_name: 'Thầy Chiến' };

// due: số ngày so với lúc nạp (âm = đã qua hạn). submissions: [số thứ tự học sinh, file bài làm (khóa trong grading.json)]
// Lớp 6A = Học sinh 1–12, Lớp 9A = Học sinh 13–22 (13–15 có bài ở cả 3 bài tập lớp 9)
const CLASSES = [
  {
    title: 'Lớp 6A', description: 'Toán 6 — ôn tập và kiểm tra học kì II',
    students: range(1, 12),
    chapters: [{ key: 'on-tap', title: 'Ôn tập học kì II', subject: 'algebra' }],
    homework: [
      {
        title: 'Kiểm tra học kì II — Toán 6', description: 'Đề 90 phút: Phần A trắc nghiệm 2đ + Phần B tự luận 8đ',
        chapter: 'on-tap', due: -3, de: ['de-toan6-hk2-de.pdf', 'ĐỀ KIỂM TRA HK2 TOÁN 6.pdf'], dapan: ['de-toan6-hk2.pdf', 'ĐỀ VÀ ĐÁP ÁN HK2 TOÁN 6.pdf'],
        submissions: 'abcdefghijkl'.split('').map((c, i) => [i + 1, `bai-lop6-${c}.pdf`]),
      },
      {
        // Bài đang mở: học sinh vào nộp thử được (cần GEMINI_API_KEY để AI chấm)
        title: 'Nộp thử: Kiểm tra học kì II — Toán 6', description: 'Làm lại đề kiểm tra học kì II — nộp ảnh chụp hoặc PDF bài làm để AI chấm',
        chapter: 'on-tap', due: 5, de: ['de-toan6-hk2-de.pdf', 'ĐỀ KIỂM TRA HK2 TOÁN 6.pdf'], dapan: ['de-toan6-hk2.pdf', 'ĐỀ VÀ ĐÁP ÁN HK2 TOÁN 6.pdf'],
        submissions: [],
      },
    ],
    comments: { 4: 'Con làm đủ các câu nhưng còn mất điểm ở câu hình học và câu cuối. Gia đình nhắc con ôn lại cách vẽ hình và trình bày lời giải từng bước.' },
  },
  {
    title: 'Lớp 9A', description: 'Toán 9 — hệ phương trình, bất phương trình, tam giác đồng dạng',
    students: range(13, 22),
    chapters: [
      { key: 'hpt', title: 'Hệ hai phương trình bậc nhất hai ẩn', subject: 'algebra' },
      { key: 'bpt', title: 'Bất phương trình bậc nhất một ẩn', subject: 'algebra' },
      { key: 'hinh', title: 'Ôn tập: Tam giác đồng dạng', subject: 'geometry' },
    ],
    homework: [
      {
        title: 'BTVN: Giải bài toán bằng cách lập hệ phương trình (P1)', description: 'Bài tập về nhà — có lời giải chi tiết',
        chapter: 'hpt', due: -9, de: ['hpt-p1.pdf', 'GIẢI BT BẰNG CÁCH LẬP HPT P1.pdf'], dapan: ['hpt-p1.pdf', 'LỜI GIẢI - LẬP HPT P1.pdf'],
        submissions: [[13, 'bai-lop9-hpt-a.pdf'], [14, 'bai-lop9-hpt-b.pdf']],
      },
      {
        title: 'BTVN: Toán thực tế bất phương trình', description: 'Bài toán thực tế giải bằng bất phương trình',
        chapter: 'bpt', due: -6, de: ['bpt-thuc-te.pdf', 'BTVN - Toán thực tế bất phương trình.pdf'], dapan: ['bpt-thuc-te.pdf', 'LỜI GIẢI - Toán thực tế bất phương trình.pdf'],
        submissions: [[15, 'bai-lop9-bpt-c.pdf']],
      },
      {
        title: 'Ôn tập: Tam giác đồng dạng', description: '5 câu chứng minh tam giác đồng dạng',
        chapter: 'hinh', due: -2, de: ['tam-giac-dong-dang-de.pdf', 'ĐỀ ÔN TẬP TAM GIÁC ĐỒNG DẠNG.pdf'], dapan: ['tam-giac-dong-dang-dap-an.pdf', 'ĐÁP ÁN TAM GIÁC ĐỒNG DẠNG.pdf'],
        submissions: [[13, 'bai-tgdd-3.pdf'], [14, 'bai-tgdd-5.pdf'], [15, 'bai-tgdd-9.pdf'], [16, 'bai-tgdd-1.pdf'], [17, 'bai-tgdd-2.pdf'],
          [18, 'bai-tgdd-4.pdf'], [19, 'bai-tgdd-6.pdf'], [20, 'bai-tgdd-7.pdf'], [21, 'bai-tgdd-8.pdf'], [22, 'bai-tgdd-10.pdf']],
      },
      {
        title: 'Nộp thử: Ôn tập tam giác đồng dạng', description: 'Làm lại 5 câu tam giác đồng dạng — nộp ảnh chụp hoặc PDF bài làm để AI chấm',
        chapter: 'hinh', due: 5, de: ['tam-giac-dong-dang-de.pdf', 'ĐỀ ÔN TẬP TAM GIÁC ĐỒNG DẠNG.pdf'], dapan: ['tam-giac-dong-dang-dap-an.pdf', 'ĐÁP ÁN TAM GIÁC ĐỒNG DẠNG.pdf'],
        submissions: [],
      },
    ],
    comments: { 16: 'Con làm bài tam giác đồng dạng khá chắc, trình bày rõ ràng. Gia đình động viên con giữ phong độ và làm thêm bài nâng cao.' },
  },
];

function range(a, b) { return Array.from({ length: b - a + 1 }, (_, i) => a + i); }
const studentUsername = (n) => `hs${n}`;
const studentName = (n) => `Học sinh ${n}`;

// Danh sách tài khoản demo cho trang đăng nhập (chỉ trả về khi database đang là bản demo)
function demoAccounts() {
  const classes = CLASSES.map((c) => ({ title: c.title, students: c.students.map(studentUsername) }));
  return {
    password: PASSWORD,
    teacher: [
      { username: TEACHER.username, password: PASSWORD, label: 'Giáo viên' },
      { username: 'admin', password: 'admin123', label: 'Quản trị' },
    ],
    classes,
  };
}

// Chép file demo vào uploads/<thư mục> với tên ngẫu nhiên (giống file người dùng tải lên)
function placeFile(subDir, demoName) {
  const dir = path.join(UPLOADS, subDir);
  fs.mkdirSync(dir, { recursive: true });
  const stored = `${crypto.randomUUID()}.pdf`;
  fs.copyFileSync(path.join(DEMO_DIR, 'files', demoName), path.join(dir, stored));
  return stored;
}

function seedDemo(db) {
  const grading = JSON.parse(fs.readFileSync(path.join(DEMO_DIR, 'grading.json'), 'utf8'));
  const hash = bcrypt.hashSync(PASSWORD, 10);
  const now = Date.now();
  const iso = (ms) => new Date(ms).toISOString();
  const insUser = db.prepare('INSERT INTO users (username,password,plain_password,full_name,role,created_by) VALUES (?,?,?,?,?,?)');

  db.transaction(() => {
    const teacherId = insUser.run(TEACHER.username, hash, PASSWORD, TEACHER.full_name, 'teacher', null).lastInsertRowid;
    const courseId = db.prepare('INSERT INTO courses (title,description,created_by) VALUES (?,?,?)')
      .run('Toán THCS — Thầy Chiến', 'Lớp 6 và lớp 9: bài tập về nhà, kiểm tra, chấm điểm bằng AI', teacherId).lastInsertRowid;
    const assistantId = db.prepare('INSERT INTO assistants (full_name,phone) VALUES (?,?)').run('Trợ giảng 1', '0912 345 678').lastInsertRowid;

    for (const cls of CLASSES) {
      const classId = db.prepare('INSERT INTO classes (course_id,title,description,teacher_id) VALUES (?,?,?,?)')
        .run(courseId, cls.title, cls.description, teacherId).lastInsertRowid;
      const studentIds = {};
      cls.students.forEach((n, i) => {
        studentIds[n] = insUser.run(studentUsername(n), hash, PASSWORD, studentName(n), 'student', teacherId).lastInsertRowid;
        ensureParentAccount(db, studentIds[n], { studentPassword: PASSWORD, createdBy: teacherId }); // mật khẩu PH = 123456
        db.prepare('INSERT INTO class_students (class_id,student_id,sort_order) VALUES (?,?,?)').run(classId, studentIds[n], i + 1);
      });
      db.prepare('INSERT INTO class_assistants (class_id,assistant_id) VALUES (?,?)').run(classId, assistantId);

      const chapterIds = {};
      cls.chapters.forEach((ch, i) => {
        chapterIds[ch.key] = db.prepare('INSERT INTO chapters (class_id,title,chapter_order,subject) VALUES (?,?,?,?)')
          .run(classId, ch.title, i + 1, ch.subject).lastInsertRowid;
      });

      cls.homework.forEach((hw, i) => {
        const due = now + hw.due * DAY;
        const hwId = db.prepare(`
          INSERT INTO homework (class_id,title,description,pdf_file,answer_file,due_date,answer_visible_date,max_score,chapter_id,hw_order,exam_type,pdf_name,answer_name,created_at)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        `).run(classId, hw.title, hw.description, placeFile('homework', hw.de[0]), placeFile('homework', hw.dapan[0]),
          iso(due), iso(due), 10, chapterIds[hw.chapter], i + 1, 'thpt', hw.de[1], hw.dapan[1],
          new Date(due - 7 * DAY).toISOString().replace('T', ' ').slice(0, 19)).lastInsertRowid;

        hw.submissions.forEach(([n, file], k) => {
          const g = grading[file];
          const submitted = due - DAY + k * 47 * 60000; // nộp trước hạn 1 ngày, mỗi bạn cách nhau ít phút
          const stored = placeFile('submissions', file);
          // Có kết quả chấm sẵn → 'done'; chưa có → 'pending' để hàng đợi AI chấm khi server chạy
          db.prepare(`
            INSERT INTO submissions (homework_id,student_id,file_path,files,submitted_at,score,feedback,graded_at,graded_by_ai,grading_details,grading_status,grading_attempts,submit_count)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1)
          `).run(hwId, studentIds[n], stored, JSON.stringify([stored]), iso(submitted),
            g ? g.score : null, g ? g.feedback : null, g ? iso(submitted + 3 * 60000) : null, g ? 1 : 0,
            g ? JSON.stringify(g.grading_details) : null, g ? 'done' : 'pending', g ? 1 : 0);
        });
      });

      for (const [n, comment] of Object.entries(cls.comments || {})) {
        db.prepare('INSERT INTO student_comments (class_id,student_id,comment,updated_by) VALUES (?,?,?,?)').run(classId, studentIds[n], comment, teacherId);
      }
    }
    // Đánh dấu database là bản demo → trang đăng nhập hiện danh sách tài khoản thử
    db.prepare("INSERT OR REPLACE INTO site_settings (key,value) VALUES ('demo_mode','1')").run();
  })();
}

const isDemo = (db) => !!db.prepare("SELECT 1 FROM site_settings WHERE key='demo_mode' AND value='1'").get();

// Chỉ nạp khi database chưa có giáo viên nào (tránh nạp trùng / ghi đè dữ liệu thật)
function seedDemoIfEmpty(db) {
  if (db.prepare("SELECT 1 FROM users WHERE role='teacher' LIMIT 1").get()) return false;
  seedDemo(db);
  console.log('🌱 Đã nạp dữ liệu demo (giáo viên thaychien / học sinh hs1…hs22, mật khẩu 123456)');
  return true;
}

module.exports = { seedDemoIfEmpty, isDemo, demoAccounts };

if (require.main === module) {
  require('dotenv').config({ path: path.join(__dirname, '../../.env') });
  const { getDb } = require('./database');
  if (!seedDemoIfEmpty(getDb())) console.log('Database đã có giáo viên — không nạp dữ liệu demo.');
}
