// Dữ liệu DEMO để xem thử web (vd bản deploy trên Render, gói free xóa sạch dữ liệu mỗi lần khởi động lại):
// 1 giáo viên, 2 lớp, 7 học sinh (+ tài khoản phụ huynh tự tạo), bài tập lấy từ đề/đáp án/bài làm THẬT
// (backend/demo/files) kèm kết quả AI đã chấm sẵn (backend/demo/grading.json) — không cần gọi AI.
// Họ tên học sinh trên web là tên giả. Mật khẩu mọi tài khoản demo: 123456 (admin giữ admin123).
//
// Chạy: tự động khi khởi động server nếu SEED_DEMO=1 và database chưa có giáo viên nào,
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

const STUDENTS = {
  hs6a: 'Phạm Gia Hân', hs6b: 'Trần Bảo Ngọc', hs6c: 'Lê Minh Châu', hs6d: 'Vũ Thu Trang',
  hs9a: 'Đặng Quốc Bảo', hs9b: 'Phan Tuấn Kiệt', hs9c: 'Hồ Gia Huy',
};

// due: số ngày so với lúc nạp (âm = đã qua hạn). submissions: [tên đăng nhập, file bài làm (khóa trong grading.json)]
const CLASSES = [
  {
    title: 'Lớp 6A', description: 'Toán 6 — ôn tập và kiểm tra học kì II',
    students: ['hs6a', 'hs6b', 'hs6c', 'hs6d'],
    chapters: [{ key: 'on-tap', title: 'Ôn tập học kì II', subject: 'algebra' }],
    homework: [{
      title: 'Kiểm tra học kì II — Toán 6', description: 'Đề 90 phút: Phần A trắc nghiệm 2đ + Phần B tự luận 8đ',
      chapter: 'on-tap', due: -3, de: ['de-toan6-hk2.pdf', 'ĐỀ KIỂM TRA HK2 TOÁN 6.pdf'], dapan: ['de-toan6-hk2.pdf', 'ĐỀ VÀ ĐÁP ÁN HK2 TOÁN 6.pdf'],
      submissions: [['hs6a', 'bai-lop6-a.pdf'], ['hs6b', 'bai-lop6-b.pdf'], ['hs6c', 'bai-lop6-c.pdf'], ['hs6d', 'bai-lop6-d.pdf']],
    }],
    comments: { hs6d: 'Thu Trang làm đủ các câu nhưng còn mất điểm ở câu hình học và câu cuối. Gia đình nhắc con ôn lại cách vẽ hình và trình bày lời giải từng bước.' },
  },
  {
    title: 'Lớp 9A', description: 'Toán 9 — hệ phương trình, bất phương trình, hình học',
    students: ['hs9a', 'hs9b', 'hs9c'],
    chapters: [
      { key: 'hpt', title: 'Hệ hai phương trình bậc nhất hai ẩn', subject: 'algebra' },
      { key: 'bpt', title: 'Bất phương trình bậc nhất một ẩn', subject: 'algebra' },
      { key: 'hinh', title: 'Ôn tập: Tam giác đồng dạng', subject: 'geometry' },
    ],
    homework: [
      {
        title: 'BTVN: Giải bài toán bằng cách lập hệ phương trình (P1)', description: 'Bài tập về nhà — có lời giải chi tiết',
        chapter: 'hpt', due: -6, de: ['hpt-p1.pdf', 'GIẢI BT BẰNG CÁCH LẬP HPT P1.pdf'], dapan: ['hpt-p1.pdf', 'LỜI GIẢI - LẬP HPT P1.pdf'],
        submissions: [['hs9a', 'bai-lop9-hpt-a.pdf'], ['hs9b', 'bai-lop9-hpt-b.pdf']],
      },
      {
        title: 'BTVN: Toán thực tế bất phương trình', description: 'Bài toán thực tế giải bằng bất phương trình',
        chapter: 'bpt', due: -2, de: ['bpt-thuc-te.pdf', 'BTVN - Toán thực tế bất phương trình.pdf'], dapan: ['bpt-thuc-te.pdf', 'LỜI GIẢI - Toán thực tế bất phương trình.pdf'],
        submissions: [['hs9c', 'bai-lop9-bpt-c.pdf']],
      },
      {
        // Bài đang mở: học sinh vào nộp thử được (cần GEMINI_API_KEY để AI chấm)
        title: 'Ôn tập: Tam giác đồng dạng', description: '5 câu chứng minh tam giác đồng dạng — nộp ảnh chụp hoặc PDF bài làm',
        chapter: 'hinh', due: 4, de: ['tam-giac-dong-dang-de.pdf', 'ĐỀ ÔN TẬP TAM GIÁC ĐỒNG DẠNG.pdf'], dapan: ['tam-giac-dong-dang-dap-an.pdf', 'ĐÁP ÁN TAM GIÁC ĐỒNG DẠNG.pdf'],
        submissions: [],
      },
    ],
    comments: { hs9a: 'Quốc Bảo làm bài hệ phương trình rất tốt (9,25 điểm) nhưng chưa nộp bài bất phương trình. Gia đình nhắc con nộp bài đúng hạn.' },
  },
];

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
    const teacherId = insUser.run('thaychien', hash, PASSWORD, 'Thầy Chiến', 'teacher', null).lastInsertRowid;
    const courseId = db.prepare('INSERT INTO courses (title,description,created_by) VALUES (?,?,?)')
      .run('Toán THCS — Thầy Chiến', 'Lớp 6 và lớp 9: bài tập về nhà, kiểm tra, chấm điểm bằng AI', teacherId).lastInsertRowid;
    const assistantId = db.prepare('INSERT INTO assistants (full_name,phone) VALUES (?,?)').run('Nguyễn Minh Thư', '0912 345 678').lastInsertRowid;

    const studentIds = {};
    for (const [username, fullName] of Object.entries(STUDENTS)) {
      studentIds[username] = insUser.run(username, hash, PASSWORD, fullName, 'student', teacherId).lastInsertRowid;
      ensureParentAccount(db, studentIds[username], { studentPassword: PASSWORD, createdBy: teacherId }); // mật khẩu PH = 123456
    }

    for (const cls of CLASSES) {
      const classId = db.prepare('INSERT INTO classes (course_id,title,description,teacher_id) VALUES (?,?,?,?)')
        .run(courseId, cls.title, cls.description, teacherId).lastInsertRowid;
      cls.students.forEach((u, i) => db.prepare('INSERT INTO class_students (class_id,student_id,sort_order) VALUES (?,?,?)').run(classId, studentIds[u], i + 1));
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

        hw.submissions.forEach(([u, file], k) => {
          const g = grading[file];
          const submitted = due - DAY + k * 47 * 60000; // nộp trước hạn 1 ngày, mỗi bạn cách nhau ít phút
          const stored = placeFile('submissions', file);
          db.prepare(`
            INSERT INTO submissions (homework_id,student_id,file_path,files,submitted_at,score,feedback,graded_at,graded_by_ai,grading_details,grading_status,grading_attempts,submit_count)
            VALUES (?,?,?,?,?,?,?,?,1,?,'done',1,1)
          `).run(hwId, studentIds[u], stored, JSON.stringify([stored]), iso(submitted), g.score, g.feedback,
            iso(submitted + 3 * 60000), JSON.stringify(g.grading_details));
        });
      });

      for (const [u, comment] of Object.entries(cls.comments || {})) {
        db.prepare('INSERT INTO student_comments (class_id,student_id,comment,updated_by) VALUES (?,?,?,?)').run(classId, studentIds[u], comment, teacherId);
      }
    }
  })();
}

// Chỉ nạp khi database chưa có giáo viên nào (tránh nạp trùng / ghi đè dữ liệu thật)
function seedDemoIfEmpty(db) {
  if (db.prepare("SELECT 1 FROM users WHERE role='teacher' LIMIT 1").get()) return false;
  seedDemo(db);
  console.log('🌱 Đã nạp dữ liệu demo (giáo viên thaychien / học sinh hs6a…hs9c, mật khẩu 123456)');
  return true;
}

module.exports = { seedDemoIfEmpty };

if (require.main === module) {
  require('dotenv').config({ path: path.join(__dirname, '../../.env') });
  const { getDb } = require('./database');
  if (!seedDemoIfEmpty(getDb())) console.log('Database đã có giáo viên — không nạp dữ liệu demo.');
}
