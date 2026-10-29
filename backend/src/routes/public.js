const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');

router.get('/ads', (req, res) => {
  const db = getDb();
  res.json(db.prepare('SELECT * FROM advertisements WHERE active=1 ORDER BY ad_order,created_at').all());
});

// Danh sách khóa học công khai — kèm sĩ số để dùng luôn cho mục "Khóa học tiêu biểu" ở trang chủ
router.get('/courses', (req, res) => {
  const db = getDb();
  res.json(db.prepare(`
    SELECT c.id, c.title, c.description, c.thumbnail, c.price, c.open_registration,
    (SELECT COUNT(DISTINCT cs.student_id) FROM class_students cs JOIN classes cl ON cs.class_id=cl.id
     WHERE cl.course_id=c.id AND cl.active=1) student_count
    FROM courses c WHERE c.active=1 ORDER BY c.created_at DESC
  `).all());
});

// Chi tiết công khai 1 khóa học: thông tin giáo viên, sĩ số, tên các chương (không kèm bài giảng/bài tập bên trong)
router.get('/courses/:id', (req, res) => {
  const db = getDb();
  const course = db.prepare('SELECT id,title,description,thumbnail,price,open_registration FROM courses WHERE id=? AND active=1').get(req.params.id);
  if (!course) return res.status(404).json({ message: 'Không tìm thấy khóa học' });

  const classes = db.prepare(`
    SELECT cl.id, cl.title, u.full_name teacher_name,
    (SELECT COUNT(*) FROM class_students cs WHERE cs.class_id=cl.id) student_count
    FROM classes cl LEFT JOIN users u ON cl.teacher_id=u.id
    WHERE cl.course_id=? AND cl.active=1 ORDER BY cl.created_at DESC
  `).all(req.params.id);

  const chapterStmt = db.prepare('SELECT id,title FROM chapters WHERE class_id=? ORDER BY chapter_order, id');
  const withChapters = classes.map((c) => ({ ...c, chapters: chapterStmt.all(c.id) }));

  res.json({ ...course, classes: withChapters });
});

// ── Nội dung trang công khai (chỉ lấy mục đang bật) ────────────────────
router.get('/featured-students', (req, res) => {
  const db = getDb();
  res.json(db.prepare('SELECT * FROM featured_students WHERE active=1 ORDER BY display_order, created_at DESC').all());
});

router.get('/staff', (req, res) => {
  const db = getDb();
  res.json(db.prepare('SELECT * FROM staff WHERE active=1 ORDER BY display_order, created_at DESC').all());
});

router.get('/featured-courses', (req, res) => {
  const db = getDb();
  res.json(db.prepare('SELECT * FROM featured_courses WHERE active=1 ORDER BY display_order, created_at DESC').all());
});

router.get('/achievements', (req, res) => {
  const db = getDb();
  res.json(db.prepare('SELECT * FROM achievements WHERE active=1 ORDER BY display_order, created_at DESC').all());
});

router.get('/settings', (req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT key,value FROM site_settings').all();
  const obj = {};
  rows.forEach(r => { obj[r.key] = r.value; });
  res.json(obj);
});

// ── Đăng ký học + ca thi thử đầu vào ──────────────────────────────────
// Ca còn mở: đang bật, chưa tới giờ thi; kèm số chỗ còn lại (null = không giới hạn)
function openSlots(db) {
  return db.prepare(`
    SELECT s.id, s.start_at, s.location, s.note, s.capacity,
      (SELECT COUNT(*) FROM course_registrations r WHERE r.slot_id=s.id AND r.status<>'cancelled') taken
    FROM placement_slots s WHERE s.active=1 AND s.start_at > ? ORDER BY s.start_at
  `).all(new Date().toISOString()).map(({ taken, ...s }) => ({
    ...s, remaining: s.capacity == null ? null : Math.max(0, s.capacity - taken),
  }));
}

router.get('/placement-slots', (req, res) => {
  res.json(openSlots(getDb()));
});

// Chặn gửi dồn: tối đa 5 đơn / 15 phút / 1 địa chỉ IP
const regHits = new Map();
function tooManyRegistrations(ip) {
  const now = Date.now();
  const hit = regHits.get(ip);
  if (!hit || now > hit.resetAt) { regHits.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 }); return false; }
  hit.count += 1;
  if (regHits.size > 5000) for (const [k, v] of regHits) if (now > v.resetAt) regHits.delete(k);
  return hit.count > 5;
}

const cleanText = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

router.post('/registrations', (req, res) => {
  const db = getDb();
  const b = req.body || {};
  const student_name = cleanText(b.student_name, 80);
  const school = cleanText(b.school, 120);
  const class_name = cleanText(b.class_name, 20);
  const note = cleanText(b.note, 500) || null;
  const phone = String(b.parent_phone ?? '').replace(/[\s.()-]/g, '');
  const score = b.last_score === '' || b.last_score == null ? null : Number(String(b.last_score).replace(',', '.'));

  if (!student_name || !school || !class_name) return res.status(400).json({ message: 'Vui lòng điền đủ họ tên học sinh, trường và lớp' });
  if (!/^(0|\+84)\d{9,10}$/.test(phone)) return res.status(400).json({ message: 'Số điện thoại phụ huynh không hợp lệ' });
  if (score === null || !Number.isFinite(score) || score < 0 || score > 10) return res.status(400).json({ message: 'Điểm tổng kết phải là số từ 0 đến 10' });

  const course = db.prepare('SELECT id,title,open_registration FROM courses WHERE id=? AND active=1').get(b.course_id);
  if (!course || !course.open_registration) return res.status(400).json({ message: 'Khóa học này hiện chưa nhận đăng ký' });

  // Có ca thi đang mở thì bắt buộc chọn 1 ca còn chỗ; chưa có ca nào thì cho gửi không kèm ca (trung tâm gọi lại hẹn)
  const slots = openSlots(db);
  let slot = null;
  if (slots.length > 0) {
    slot = slots.find((s) => s.id === Number(b.slot_id));
    if (!slot) return res.status(400).json({ message: 'Vui lòng chọn ca thi thử đầu vào' });
    if (slot.remaining === 0) return res.status(400).json({ message: 'Ca thi này đã đủ chỗ, vui lòng chọn ca khác' });
  }

  if (tooManyRegistrations(req.ip)) return res.status(429).json({ message: 'Bạn gửi quá nhiều đơn, vui lòng thử lại sau ít phút' });

  db.prepare(`INSERT INTO course_registrations
    (course_id,course_title,student_name,parent_phone,school,class_name,last_score,slot_id,slot_start_at,note,ip)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(
    course.id, course.title, student_name, phone, school, class_name, score,
    slot ? slot.id : null, slot ? slot.start_at : null, note, req.ip,
  );
  res.status(201).json({ message: 'Đã gửi đăng ký', slot_start_at: slot ? slot.start_at : null });
});

// ── Đề và chuyên môn ──────────────────────────────────────────────────
const DEFAULT_EXAM_GRADES = '6,7,8,9';
function examGrades(db) {
  const row = db.prepare("SELECT value FROM site_settings WHERE key='exam_grades'").get();
  return String(row?.value || DEFAULT_EXAM_GRADES).split(',').map((g) => g.trim()).filter(Boolean);
}

router.get('/exam-grades', (req, res) => {
  res.json(examGrades(getDb()));
});

// ?grade=8 &q=từ khóa &limit=6
router.get('/exams', (req, res) => {
  const db = getDb();
  const where = ['active=1']; const vals = [];
  if (req.query.grade) { where.push('grade=?'); vals.push(String(req.query.grade)); }
  if (req.query.q) { where.push('(title LIKE ? OR description LIKE ?)'); const q = `%${String(req.query.q).slice(0, 80)}%`; vals.push(q, q); }
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 200, 1), 200);
  res.json(db.prepare(`
    SELECT id,title,grade,thumbnail,pdf_file,published_at,created_at FROM exam_papers
    WHERE ${where.join(' AND ')} ORDER BY COALESCE(published_at, created_at) DESC, id DESC LIMIT ${limit}
  `).all(...vals));
});

router.get('/exams/:id', (req, res) => {
  const db = getDb();
  const exam = db.prepare('SELECT id,title,grade,description,thumbnail,pdf_file,published_at,created_at FROM exam_papers WHERE id=? AND active=1').get(req.params.id);
  if (!exam) return res.status(404).json({ message: 'Không tìm thấy đề' });
  const related = db.prepare(`
    SELECT id,title,grade,thumbnail,published_at,created_at FROM exam_papers
    WHERE active=1 AND id<>? AND grade IS ? ORDER BY COALESCE(published_at, created_at) DESC LIMIT 4
  `).all(exam.id, exam.grade);
  res.json({ ...exam, related });
});

// Bản demo: danh sách tài khoản thử để hiện ở trang đăng nhập. Database thật (không nạp demo) → null
router.get('/demo-accounts', (req, res) => {
  const { isDemo, demoAccounts } = require('../db/demoSeed');
  res.json(isDemo(getDb()) ? demoAccounts() : null);
});

module.exports = router;
