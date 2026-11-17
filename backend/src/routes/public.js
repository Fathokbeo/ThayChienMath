const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { getDb } = require('../db/database');
const { userFromRequest, userFromFileTicket } = require('../services/security');
const { EXAM_DOCS_DIR } = require('../middleware/upload');
const { getForm, getFormFields, validateSubmission } = require('../services/registrationForm');
const { examGrades, examMeta } = require('../services/examMenu');
const { rankCourses, rankCoursesByInterest, parseTags } = require('../services/courseTags');

const EXAMS_DIR = path.join(__dirname, '../../uploads/exams');

router.get('/ads', (req, res) => {
  const db = getDb();
  res.json(db.prepare('SELECT * FROM advertisements WHERE active=1 ORDER BY ad_order,created_at').all());
});

// Danh sách khóa học công khai — chỉ các khóa admin chọn hiện ở trang chủ (show_on_home), kèm sĩ số
// ?grade=9&category=Đề HSG → sắp khóa phù hợp nhất lên đầu (theo nhãn AI đã lưu, không gọi AI); không có → mới nhất trước
// interest / viewed: bảng tổng hợp mức quan tâm của khách (trang chủ) → xếp khóa hợp nhất lên đầu mục Khóa học
function publicCourses(db, grade, category, interest, viewed) {
  const rows = db.prepare(`
    SELECT c.id, c.title, c.description, c.thumbnail, c.price, c.open_registration, c.ai_tags,
    (SELECT COUNT(DISTINCT cs.student_id) FROM class_students cs JOIN classes cl ON cs.class_id=cl.id
     WHERE cl.course_id=c.id AND cl.active=1) student_count
    FROM courses c WHERE c.active=1 AND COALESCE(c.show_on_home,1)=1 ORDER BY c.created_at DESC
  `).all();
  return (interest || viewed ? rankCoursesByInterest(rows, interest || [], category, viewed) : rankCourses(rows, grade, category)).map(({ ai_tags, ...c }) => ({ ...c, fit_grades: parseTags(ai_tags)?.grades || [] }));
}
const q = (v) => (v ? String(v).slice(0, 60) : '');

// ?interest=10|Đề HK1:3.4,10|:1.2,9|Đề HSG:0.6 — mức quan tâm (đã mờ dần theo thời gian) theo cặp lớp|loại đề
// (trang chủ, xem lib/interest.ts ở frontend). Vẫn đọc dạng cũ 10:6,8:2 (lớp:số lần xem) của bản web cũ còn trong cache.
const parseInterest = (v) => {
  if (!v) return null;
  const list = String(v).slice(0, 900).split(',').slice(0, 12).map((p) => {
    const i = p.lastIndexOf(':');
    const [g, c] = (i > 0 ? p.slice(0, i) : p).split('|');
    return { grade: String(g || '').trim().slice(0, 40), category: String(c || '').trim().slice(0, 40) || null,
      weight: Math.min(1000, Math.max(0, parseFloat(p.slice(i + 1)) || 0)) };
  }).filter((x) => x.grade && x.weight > 0);
  return list.length ? list : null;
};
// ?courses=12:1.8,5:0.9 — các khóa khách đã mở xem chi tiết (mức quan tâm)
const parseViewed = (v) => {
  if (!v) return null;
  const m = new Map(String(v).slice(0, 300).split(',').slice(0, 10).map((p) => {
    const [id, w] = p.split(':');
    return [parseInt(id, 10), Math.min(5, Math.max(0, parseFloat(w) || 0))];
  }).filter(([id, w]) => id > 0 && w > 0));
  return m.size ? m : null;
};

router.get('/courses', (req, res) => {
  res.json(publicCourses(getDb(), q(req.query.grade), q(req.query.category), parseInterest(req.query.interest), parseViewed(req.query.courses)));
});

// Tài khoản khách: lưu mức quan tâm lên máy chủ để gợi ý khóa học theo người dùng, kể cả khi đổi máy.
// Chỉ tài khoản khách; dữ liệu chỉ là lớp / loại đề / mã khóa học kèm thời điểm, đã kiểm tra & giới hạn kích thước.
function guestOnly(req, res) {
  const user = userFromRequest(req);
  if (!user || user.role !== 'guest') { res.status(403).json({ message: 'Chỉ dành cho tài khoản khách' }); return null; }
  return user;
}
router.get('/my-interest', (req, res) => {
  const user = guestOnly(req, res); if (!user) return;
  const row = getDb().prepare('SELECT data FROM user_interest WHERE user_id=?').get(user.id);
  let data = { ev: [], courses: {} };
  try { if (row) data = JSON.parse(row.data); } catch { /* hỏng → coi như rỗng */ }
  res.json(data);
});
router.put('/my-interest', (req, res) => {
  const user = guestOnly(req, res); if (!user) return;
  const now = Date.now();
  const str = (s) => String(s || '').replace(/[,:|]/g, ' ').trim().slice(0, 40);
  const okTime = (t) => Number.isFinite(t) && t > now - 400 * 864e5 && t < now + 864e5;
  const ev = (Array.isArray(req.body?.ev) ? req.body.ev : []).slice(0, 80)
    .map((e) => ({ g: str(e && e.g), c: str(e && e.c) || undefined, w: Math.min(5, Math.max(0, +(e && e.w) || 0)), t: +(e && e.t) }))
    .filter((e) => e.g && e.w > 0 && okTime(e.t));
  const courses = {};
  Object.entries(req.body?.courses && typeof req.body.courses === 'object' ? req.body.courses : {}).slice(0, 20).forEach(([id, x]) => {
    const n = parseInt(id, 10); const t = +(x && x.t); const w = Math.min(5, Math.max(0, +(x && x.w) || 0));
    if (n > 0 && w > 0 && okTime(t)) courses[n] = { w, t };
  });
  getDb().prepare(`INSERT INTO user_interest (user_id,data,updated_at) VALUES (?,?,CURRENT_TIMESTAMP)
    ON CONFLICT(user_id) DO UPDATE SET data=excluded.data, updated_at=CURRENT_TIMESTAMP`).run(user.id, JSON.stringify({ ev, courses }));
  res.json({ ok: true });
});

// Gợi ý khóa học dưới 1 đề: chỉ các khóa đúng lớp hoặc đúng mục tiêu (điểm ≥ 6), tối đa ?limit (mặc định 3)
router.get('/courses/recommend', (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 3, 1), 12);
  res.json(publicCourses(getDb(), q(req.query.grade), q(req.query.category)).filter((c) => c.match >= 6).slice(0, limit));
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

// ── Nội dung trang công khai ───────────────────────────────────────────
// (Học sinh tiêu biểu, Giáo viên, Khóa tiêu biểu, Thành tích đã gỡ khỏi trang chủ → không mở API công khai nữa,
// tránh lộ SĐT/Facebook giáo viên; dữ liệu vẫn giữ trong database.)

// Chỉ trả các mục cài đặt trang web cần hiện; mục nội bộ (biểu mẫu đăng ký, SĐT liên hệ phụ huynh...) không ra ngoài
const PUBLIC_SETTINGS = ['hero_title', 'hero_subtitle', 'contact_address', 'contact_phone', 'contact_email', 'contact_hours',
  'contact_facebook', 'stats_students', 'stats_teachers', 'stats_courses', 'stats_years',
  // Tên + dòng mô tả các mục trang chủ (admin tự đặt)
  'home_exams_title', 'home_exams_subtitle', 'home_news_title', 'home_news_subtitle', 'home_courses_title', 'home_courses_subtitle'];
router.get('/settings', (req, res) => {
  const db = getDb();
  const rows = db.prepare(`SELECT key,value FROM site_settings WHERE key IN (${PUBLIC_SETTINGS.map(() => '?').join(',')})`).all(...PUBLIC_SETTINGS);
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

// Biểu mẫu đăng ký (admin soạn): lời giới thiệu + các câu hỏi đang bật
router.get('/registration-form', (req, res) => {
  const { intro, fields } = getForm(getDb());
  res.json({ intro, fields: fields.filter((f) => f.enabled).map(({ locked, enabled, ...f }) => f) });
});

router.post('/registrations', (req, res) => {
  const db = getDb();
  const b = req.body || {};
  const checked = validateSubmission(getFormFields(db), b);
  if (checked.error) return res.status(400).json({ message: checked.error });
  const v = checked.values;

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
    (course_id,course_title,student_name,parent_phone,school,class_name,last_score,slot_id,slot_start_at,note,extra,ip)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    course.id, course.title, v.student_name, v.parent_phone, v.school, v.class_name, v.last_score,
    slot ? slot.id : null, slot ? slot.start_at : null, v.note, v.extra.length ? JSON.stringify(v.extra) : null, req.ip,
  );
  res.status(201).json({ message: 'Đã gửi đăng ký', slot_start_at: slot ? slot.start_at : null });
});

// ── Tin tức ───────────────────────────────────────────────────────────
const NEWS_ORDER = 'ORDER BY COALESCE(published_at, created_at) DESC, id DESC';

// ?limit=6 — danh sách không kèm nội dung đầy đủ cho nhẹ
router.get('/news', (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 200);
  res.json(getDb().prepare(`SELECT id,title,summary,image,video,published_at,created_at FROM news_posts WHERE active=1 ${NEWS_ORDER} LIMIT ${limit}`).all());
});

router.get('/news/:id', (req, res) => {
  const db = getDb();
  const post = db.prepare('SELECT id,title,summary,content,image,video,published_at,created_at FROM news_posts WHERE id=? AND active=1').get(req.params.id);
  if (!post) return res.status(404).json({ message: 'Không tìm thấy bài viết' });
  const related = db.prepare(`SELECT id,title,summary,image,video,published_at,created_at FROM news_posts WHERE active=1 AND id<>? ${NEWS_ORDER} LIMIT 3`).all(post.id);
  res.json({ ...post, related });
});

// ── Đề và chuyên môn ──────────────────────────────────────────────────
router.get('/exam-grades', (req, res) => {
  res.json(examGrades(getDb()));
});

// Lớp + loại đề + thanh menu + số đề theo lớp/loại (dựng thanh menu đề ở trang chủ / trang Đề)
router.get('/exam-meta', (req, res) => {
  res.json(examMeta(getDb()));
});

// ?grade=8 &category=Đề HK1 &q=từ khóa &limit=6
router.get('/exams', (req, res) => {
  const db = getDb();
  const where = ['active=1']; const vals = [];
  if (req.query.grade) { where.push('grade=?'); vals.push(String(req.query.grade)); }
  if (req.query.category) { where.push('category=?'); vals.push(String(req.query.category)); }
  if (req.query.q) { where.push('(title LIKE ? OR description LIKE ?)'); const q = `%${String(req.query.q).slice(0, 80)}%`; vals.push(q, q); }
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 200, 1), 200);
  res.json(db.prepare(`
    SELECT id,title,grade,category,thumbnail,pdf_file,(docx_file IS NOT NULL) has_docx,published_at,created_at FROM exam_papers
    WHERE ${where.join(' AND ')} ORDER BY COALESCE(published_at, created_at) DESC, id DESC LIMIT ${limit}
  `).all(...vals));
});

router.get('/exams/:id', (req, res) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM exam_papers WHERE id=? AND active=1').get(req.params.id);
  if (!row) return res.status(404).json({ message: 'Không tìm thấy đề' });
  // Không trả tên file Word ra ngoài: bản Word chỉ tải qua /exams/:id/file/docx (có kiểm tra quyền)
  const exam = {
    id: row.id, title: row.title, grade: row.grade, category: row.category, description: row.description, thumbnail: row.thumbnail,
    pdf_file: row.pdf_file, published_at: row.published_at, created_at: row.created_at, has_docx: !!row.docx_file,
    pdf_download: row.pdf_file ? (row.pdf_download || 'all') : 'none',
    docx_download: row.docx_file ? (row.docx_download || 'all') : 'none',
  };
  const related = db.prepare(`
    SELECT id,title,grade,thumbnail,published_at,created_at FROM exam_papers
    WHERE active=1 AND id<>? AND grade IS ? ORDER BY COALESCE(published_at, created_at) DESC LIMIT 4
  `).all(exam.id, exam.grade);
  res.json({ ...exam, related });
});

// Tải đề theo quyền admin đặt cho từng bản (PDF / Word). Dùng được với link thường (<a href>):
// web gửi kèm cookie phiên, app gắn vé ?t= (xem fileUrl ở frontend). Admin luôn tải được.
router.get('/exams/:id/file/:kind', (req, res) => {
  const kind = req.params.kind;
  if (kind !== 'pdf' && kind !== 'docx') return res.status(404).json({ message: 'Không tìm thấy file' });
  const exam = getDb().prepare('SELECT * FROM exam_papers WHERE id=? AND active=1').get(req.params.id);
  const file = exam && (kind === 'pdf' ? exam.pdf_file : exam.docx_file);
  if (!file) return res.status(404).json({ message: 'Không tìm thấy file' });
  const mode = (kind === 'pdf' ? exam.pdf_download : exam.docx_download) || 'all';
  const user = userFromRequest(req) || userFromFileTicket(req);
  if (user?.role !== 'admin') {
    if (mode === 'none') return res.status(403).json({ message: 'Đề này không cho tải về' });
    if (mode === 'login' && !user) return res.status(401).json({ message: 'Vui lòng đăng nhập để tải đề này' });
  }
  const full = path.join(kind === 'pdf' ? EXAMS_DIR : EXAM_DOCS_DIR, path.basename(file));
  if (!fs.existsSync(full)) return res.status(404).json({ message: 'Không tìm thấy file' });
  const safeTitle = String(exam.title || '').replace(/[\\/:*?"<>|\r\n]+/g, ' ').trim().slice(0, 150) || 'de-thi';
  res.setHeader('Cache-Control', 'private, no-store');
  res.download(full, safeTitle + path.extname(file));
});

// Bản demo: danh sách tài khoản thử để hiện ở trang đăng nhập. Database thật (không nạp demo) → null
router.get('/demo-accounts', (req, res) => {
  const { isDemo, demoAccounts } = require('../db/demoSeed');
  res.json(isDemo(getDb()) ? demoAccounts() : null);
});

module.exports = router;
