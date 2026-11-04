const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { getDb } = require('../db/database');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { uploadContent } = require('../middleware/upload');
const { sanitizeNewsHtml, inlineImages } = require('../services/newsContent');

router.use(authMiddleware, requireRole('admin'));

// Cấu hình từng bộ nội dung: bảng + các trường text cho phép
const COLLECTIONS = {
  'featured-students': { table: 'featured_students', dir: 'featured_students', fields: ['name', 'exam', 'achievement', 'description', 'display_order', 'active'] },
  'staff':             { table: 'staff',              dir: 'staff',              fields: ['name', 'role_title', 'staff_type', 'description', 'facebook_url', 'phone', 'display_order', 'active'] },
  'featured-courses':  { table: 'featured_courses',   dir: 'featured_courses',   fields: ['title', 'student_count', 'description', 'display_order', 'active'] },
  'achievements':      { table: 'achievements',       dir: 'achievements',       fields: ['year', 'title', 'description', 'display_order', 'active'] },
  // Tin tức: bài mới nhất lên đầu (theo ngày đăng)
  'news':              { table: 'news_posts',         dir: 'news',               fields: ['title', 'summary', 'content', 'published_at', 'display_order', 'active'],
                         orderBy: 'COALESCE(published_at, created_at) DESC, id DESC', clean: { content: sanitizeNewsHtml } },
};

// Giá trị 1 trường gửi lên → giá trị lưu (active/display_order là số; trường có hàm làm sạch thì làm sạch)
const fieldValue = (cfg, f, v) => (f === 'active' ? (v === 'false' || v === '0' ? 0 : 1)
  : f === 'display_order' ? (parseInt(v) || 0)
  : cfg.clean?.[f] ? cfg.clean[f](v) : v);

// Ảnh chèn trong nội dung bài tin không còn dùng (bài bị sửa bỏ ảnh / bị xóa) → xóa file
function rmUnusedInlineImages(oldHtml, newHtml) {
  const keep = inlineImages(newHtml);
  for (const name of inlineImages(oldHtml)) if (!keep.has(name)) rmImage('news', name);
}

function rmImage(dir, name) {
  if (!name) return;
  const f = path.join(__dirname, '../../uploads', dir, name);
  if (fs.existsSync(f)) { try { fs.unlinkSync(f); } catch {} }
}

// ── Site settings (liên hệ, hero, số liệu) ─────────────────────────────
router.get('/settings', (req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT key,value FROM site_settings').all();
  const obj = {};
  rows.forEach(r => { obj[r.key] = r.value; });
  res.json(obj);
});

router.put('/settings', (req, res) => {
  const db = getDb();
  const stmt = db.prepare('INSERT INTO site_settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
  db.transaction(() => {
    for (const [k, v] of Object.entries(req.body || {})) stmt.run(k, String(v ?? ''));
  })();
  res.json({ message: 'Đã lưu thông tin' });
});

// Ảnh chèn vào giữa bài tin tức (trình soạn thảo gọi khi admin bấm nút chèn ảnh / dán ảnh)
router.post('/news/inline-image', uploadContent.news.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Chưa chọn ảnh' });
  res.status(201).json({ url: `/uploads/news/${req.file.filename}` });
});

// Middleware chọn multer theo loại nội dung
function imageUploadFor(req, res, next) {
  const up = uploadContent[req.params.collection];
  if (!up) return res.status(404).json({ message: 'Loại nội dung không hợp lệ' });
  up.single('image')(req, res, next);
}

// ── List (admin: tất cả, kể cả ẩn) ─────────────────────────────────────
router.get('/:collection', (req, res) => {
  const cfg = COLLECTIONS[req.params.collection];
  if (!cfg) return res.status(404).json({ message: 'Loại nội dung không hợp lệ' });
  const db = getDb();
  res.json(db.prepare(`SELECT * FROM ${cfg.table} ORDER BY ${cfg.orderBy || 'display_order, created_at DESC'}`).all());
});

// ── Create ─────────────────────────────────────────────────────────────
router.post('/:collection', imageUploadFor, (req, res) => {
  const cfg = COLLECTIONS[req.params.collection];
  if (!cfg) return res.status(404).json({ message: 'Loại nội dung không hợp lệ' });
  const db = getDb();

  const cols = []; const vals = [];
  cfg.fields.forEach(f => {
    if (req.body[f] !== undefined) {
      cols.push(f);
      vals.push(fieldValue(cfg, f, req.body[f]));
    }
  });
  if (req.file) { cols.push('image'); vals.push(req.file.filename); }
  if (cols.length === 0) return res.status(400).json({ message: 'Thiếu dữ liệu' });

  const placeholders = cols.map(() => '?').join(',');
  const r = db.prepare(`INSERT INTO ${cfg.table} (${cols.join(',')}) VALUES (${placeholders})`).run(...vals);
  res.status(201).json({ id: r.lastInsertRowid });
});

// ── Update ─────────────────────────────────────────────────────────────
router.put('/:collection/:id', imageUploadFor, (req, res) => {
  const cfg = COLLECTIONS[req.params.collection];
  if (!cfg) return res.status(404).json({ message: 'Loại nội dung không hợp lệ' });
  const db = getDb();
  const existing = db.prepare(`SELECT * FROM ${cfg.table} WHERE id=?`).get(req.params.id);
  if (!existing) return res.status(404).json({ message: 'Không tìm thấy' });

  const sets = []; const vals = [];
  cfg.fields.forEach(f => {
    if (req.body[f] !== undefined) {
      sets.push(`${f}=?`);
      vals.push(fieldValue(cfg, f, req.body[f]));
    }
  });
  if (req.file) { sets.push('image=?'); vals.push(req.file.filename); rmImage(cfg.dir, existing.image); }
  if (sets.length === 0) return res.json({ message: 'Không có gì thay đổi' });

  vals.push(req.params.id);
  db.prepare(`UPDATE ${cfg.table} SET ${sets.join(',')} WHERE id=?`).run(...vals);
  if (req.params.collection === 'news' && req.body.content !== undefined) {
    rmUnusedInlineImages(existing.content, db.prepare('SELECT content FROM news_posts WHERE id=?').get(existing.id).content);
  }
  res.json({ message: 'Đã cập nhật' });
});

// ── Delete (hard) ──────────────────────────────────────────────────────
router.delete('/:collection/:id', (req, res) => {
  const cfg = COLLECTIONS[req.params.collection];
  if (!cfg) return res.status(404).json({ message: 'Loại nội dung không hợp lệ' });
  const db = getDb();
  const existing = db.prepare(`SELECT * FROM ${cfg.table} WHERE id=?`).get(req.params.id);
  if (existing) {
    rmImage(cfg.dir, existing.image);
    if (req.params.collection === 'news') rmUnusedInlineImages(existing.content, '');
    db.prepare(`DELETE FROM ${cfg.table} WHERE id=?`).run(req.params.id);
  }
  res.json({ message: 'Đã xóa' });
});

module.exports = router;
