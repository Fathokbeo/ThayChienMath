// Quản trị phần tuyển sinh & đề thi của trang công khai: ca thi thử đầu vào, đơn đăng ký học, đề thi.
// Gắn tại /api/admin/site (chỉ admin).
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { getDb } = require('../db/database');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { uploadExam } = require('../middleware/upload');

router.use(authMiddleware, requireRole('admin'));

const EXAM_DIR = path.join(__dirname, '../../uploads/exams');
const rmExamFile = (name) => {
  if (!name) return;
  const f = path.join(EXAM_DIR, path.basename(name));
  if (fs.existsSync(f)) { try { fs.unlinkSync(f); } catch {} }
};
const isIsoDate = (v) => typeof v === 'string' && !Number.isNaN(Date.parse(v));
const optInt = (v) => (v === '' || v == null ? null : Math.max(0, parseInt(v, 10) || 0));

// ── Ca thi thử đầu vào ────────────────────────────────────────────────
router.get('/slots', (req, res) => {
  res.json(getDb().prepare(`
    SELECT s.*, (SELECT COUNT(*) FROM course_registrations r WHERE r.slot_id=s.id AND r.status<>'cancelled') taken
    FROM placement_slots s ORDER BY s.start_at DESC
  `).all());
});

router.post('/slots', (req, res) => {
  const { start_at, location, capacity, note } = req.body || {};
  if (!isIsoDate(start_at)) return res.status(400).json({ message: 'Cần chọn ngày giờ thi' });
  const r = getDb().prepare('INSERT INTO placement_slots (start_at,location,capacity,note) VALUES (?,?,?,?)')
    .run(new Date(start_at).toISOString(), location || null, optInt(capacity), note || null);
  res.status(201).json({ id: r.lastInsertRowid });
});

router.put('/slots/:id', (req, res) => {
  const { start_at, location, capacity, note, active } = req.body || {};
  if (start_at !== undefined && !isIsoDate(start_at)) return res.status(400).json({ message: 'Ngày giờ thi không hợp lệ' });
  const db = getDb();
  const cur = db.prepare('SELECT * FROM placement_slots WHERE id=?').get(req.params.id);
  if (!cur) return res.status(404).json({ message: 'Không tìm thấy ca thi' });
  db.prepare('UPDATE placement_slots SET start_at=?, location=?, capacity=?, note=?, active=? WHERE id=?').run(
    start_at !== undefined ? new Date(start_at).toISOString() : cur.start_at,
    location !== undefined ? (location || null) : cur.location,
    capacity !== undefined ? optInt(capacity) : cur.capacity,
    note !== undefined ? (note || null) : cur.note,
    active !== undefined ? (active ? 1 : 0) : cur.active,
    cur.id,
  );
  // Đơn đã đăng ký ca này vẫn hiện đúng giờ mới
  if (start_at !== undefined) db.prepare('UPDATE course_registrations SET slot_start_at=? WHERE slot_id=?').run(new Date(start_at).toISOString(), cur.id);
  res.json({ message: 'Đã cập nhật' });
});

router.delete('/slots/:id', (req, res) => {
  // Đơn đã chọn ca này giữ lại giờ thi (slot_start_at), chỉ bỏ liên kết
  getDb().prepare('DELETE FROM placement_slots WHERE id=?').run(req.params.id);
  res.json({ message: 'Đã xóa ca thi' });
});

// ── Đơn đăng ký học ───────────────────────────────────────────────────
const STATUSES = ['new', 'contacted', 'enrolled', 'cancelled'];

router.get('/registrations', (req, res) => {
  const where = []; const vals = [];
  if (STATUSES.includes(req.query.status)) { where.push('status=?'); vals.push(req.query.status); }
  res.json(getDb().prepare(`
    SELECT * FROM course_registrations ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY (status='new') DESC, created_at DESC LIMIT 500
  `).all(...vals));
});

// Số đơn mới (chưa xử lý) — hiện thông báo ở trang Tổng quan của admin
router.get('/registrations/new-count', (req, res) => {
  res.json({ count: getDb().prepare("SELECT COUNT(*) n FROM course_registrations WHERE status='new'").get().n });
});

router.put('/registrations/:id', (req, res) => {
  const { status, admin_note } = req.body || {};
  if (status !== undefined && !STATUSES.includes(status)) return res.status(400).json({ message: 'Trạng thái không hợp lệ' });
  const sets = []; const vals = [];
  if (status !== undefined) { sets.push('status=?'); vals.push(status); }
  if (admin_note !== undefined) { sets.push('admin_note=?'); vals.push(String(admin_note).slice(0, 1000) || null); }
  if (!sets.length) return res.json({ message: 'Không có gì thay đổi' });
  getDb().prepare(`UPDATE course_registrations SET ${sets.join(',')} WHERE id=?`).run(...vals, req.params.id);
  res.json({ message: 'Đã cập nhật' });
});

router.delete('/registrations/:id', (req, res) => {
  getDb().prepare('DELETE FROM course_registrations WHERE id=?').run(req.params.id);
  res.json({ message: 'Đã xóa đơn' });
});

// ── Đề thi (Đề và chuyên môn) ─────────────────────────────────────────
router.get('/exams', (req, res) => {
  res.json(getDb().prepare('SELECT * FROM exam_papers ORDER BY COALESCE(published_at, created_at) DESC, id DESC').all());
});

const examFields = (b) => ({
  title: String(b.title || '').trim().slice(0, 200),
  grade: String(b.grade || '').trim().slice(0, 30) || null,
  description: String(b.description || '').trim().slice(0, 20000) || null,
  published_at: /^\d{4}-\d{2}-\d{2}$/.test(b.published_at || '') ? b.published_at : null,
});
const uploaded = (req, field) => req.files?.[field]?.[0]?.filename || null;

router.post('/exams', uploadExam, (req, res) => {
  const f = examFields(req.body || {});
  if (!f.title) {
    rmExamFile(uploaded(req, 'thumbnail')); rmExamFile(uploaded(req, 'pdf'));
    return res.status(400).json({ message: 'Cần tên đề' });
  }
  const r = getDb().prepare('INSERT INTO exam_papers (title,grade,description,published_at,thumbnail,pdf_file,active) VALUES (?,?,?,?,?,?,?)')
    .run(f.title, f.grade, f.description, f.published_at || new Date().toISOString().slice(0, 10),
      uploaded(req, 'thumbnail'), uploaded(req, 'pdf'), req.body.active === '0' ? 0 : 1);
  res.status(201).json({ id: r.lastInsertRowid });
});

router.put('/exams/:id', uploadExam, (req, res) => {
  const db = getDb();
  const cur = db.prepare('SELECT * FROM exam_papers WHERE id=?').get(req.params.id);
  if (!cur) return res.status(404).json({ message: 'Không tìm thấy đề' });
  const f = examFields({ ...cur, ...req.body });
  if (!f.title) return res.status(400).json({ message: 'Cần tên đề' });
  const thumb = uploaded(req, 'thumbnail'); const pdf = uploaded(req, 'pdf');
  // Thay file mới thì xóa file cũ; remove_pdf=1 / remove_thumbnail=1 → bỏ file đang có
  const nextThumb = thumb || (req.body.remove_thumbnail === '1' ? null : cur.thumbnail);
  const nextPdf = pdf || (req.body.remove_pdf === '1' ? null : cur.pdf_file);
  if (nextThumb !== cur.thumbnail) rmExamFile(cur.thumbnail);
  if (nextPdf !== cur.pdf_file) rmExamFile(cur.pdf_file);
  db.prepare('UPDATE exam_papers SET title=?, grade=?, description=?, published_at=?, thumbnail=?, pdf_file=?, active=? WHERE id=?').run(
    f.title, f.grade, f.description, f.published_at || cur.published_at, nextThumb, nextPdf,
    req.body.active === undefined ? cur.active : (req.body.active === '0' || req.body.active === false ? 0 : 1), cur.id,
  );
  res.json({ message: 'Đã cập nhật' });
});

router.delete('/exams/:id', (req, res) => {
  const db = getDb();
  const cur = db.prepare('SELECT thumbnail,pdf_file FROM exam_papers WHERE id=?').get(req.params.id);
  if (cur) { rmExamFile(cur.thumbnail); rmExamFile(cur.pdf_file); db.prepare('DELETE FROM exam_papers WHERE id=?').run(req.params.id); }
  res.json({ message: 'Đã xóa đề' });
});

module.exports = router;
