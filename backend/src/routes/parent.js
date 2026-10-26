// Phụ huynh: CHỈ XEM tiến độ học tập của con (không nộp bài, không xem bài giảng).
const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { childOverview, childClassDetail, childHomework, activityFeed } = require('../services/parentReport');

router.use(authMiddleware, requireRole('parent'));

const childrenOf = (db, parentId) => db.prepare(`
  SELECT u.id, u.username, u.full_name FROM parent_students ps JOIN users u ON u.id=ps.student_id
  WHERE ps.parent_id=? AND u.active=1 AND u.role='student' ORDER BY ps.created_at, u.full_name
`).all(parentId);

// Học sinh :sid có đúng là con của phụ huynh đang đăng nhập không → trả về học sinh hoặc null
function ownChild(db, parentId, sid) {
  return childrenOf(db, parentId).find((c) => c.id === Number(sid)) || null;
}

const me = (db, id) => db.prepare('SELECT id, notif_seen_at FROM users WHERE id=?').get(id);

// Danh sách con (để chọn khi có nhiều con) + số thông báo mới của từng con
router.get('/children', (req, res) => {
  const db = getDb();
  const parent = me(db, req.user.id);
  const now = new Date().toISOString();
  res.json(childrenOf(db, req.user.id).map((c) => ({ ...c, unread: activityFeed(childHomework(db, c.id, now), now, parent.notif_seen_at).unread })));
});

router.get('/children/:sid/overview', (req, res) => {
  const db = getDb();
  const child = ownChild(db, req.user.id, req.params.sid);
  if (!child) return res.status(403).json({ message: 'Không phải học sinh do bạn theo dõi' });
  res.json(childOverview(db, child, me(db, req.user.id)));
});

router.get('/children/:sid/classes/:cid', (req, res) => {
  const db = getDb();
  const child = ownChild(db, req.user.id, req.params.sid);
  if (!child) return res.status(403).json({ message: 'Không phải học sinh do bạn theo dõi' });
  const enrolled = db.prepare('SELECT 1 FROM class_students WHERE class_id=? AND student_id=?').get(req.params.cid, child.id);
  if (!enrolled) return res.status(403).json({ message: 'Con không học lớp này' });
  const detail = childClassDetail(db, child, req.params.cid);
  if (!detail) return res.status(404).json({ message: 'Không tìm thấy lớp' });
  res.json(detail);
});

// Đánh dấu đã xem hết thông báo
router.post('/notifications/seen', (req, res) => {
  getDb().prepare('UPDATE users SET notif_seen_at=? WHERE id=?').run(new Date().toISOString(), req.user.id);
  res.json({ message: 'OK' });
});

module.exports = router;
