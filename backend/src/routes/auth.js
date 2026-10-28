const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDb } = require('../db/database');
const {
  getJwtSecret, setSessionCookie, clearSessionCookie, userFromRequest, signFileTicket,
  loginBlockedFor, recordLoginFailure, clearLoginFailures,
} = require('../services/security');
const { findParentForLogin } = require('../services/parentAccounts');

// Hash giả để so sánh khi tên đăng nhập không tồn tại → thời gian phản hồi như nhau, không dò được tên có thật
const DUMMY_HASH = bcrypt.hashSync('khong-phai-mat-khau-that', 10);
const BAD_LOGIN = 'Tên đăng nhập hoặc mật khẩu không đúng';

// Mục đăng nhập trên giao diện (portal) → các vai trò được phép. Admin đăng nhập ở mục Giáo viên.
const PORTAL_ROLES = { teacher: ['teacher', 'admin'], student: ['student'], parent: ['parent'] };
const PORTAL_OF_ROLE = { admin: 'Giáo viên', teacher: 'Giáo viên', student: 'Học sinh', parent: 'Phụ huynh' };

router.post('/login', (req, res) => {
  const { username, password, portal } = req.body || {};
  if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ message: 'Vui lòng nhập tên đăng nhập và mật khẩu' });
  }

  // Sai quá nhiều lần thì khóa tạm, tránh bị dò mật khẩu hàng loạt
  const wait = loginBlockedFor(req, username);
  if (wait > 0) {
    return res.status(429).json({ message: `Sai quá nhiều lần. Vui lòng thử lại sau ${Math.ceil(wait / 60)} phút.` });
  }

  const db = getDb();
  // Mục Phụ huynh: gõ tên đăng nhập CỦA CON (hoặc tên tài khoản phụ huynh) → tài khoản phụ huynh của con
  const user = portal === 'parent'
    ? findParentForLogin(db, username)
    : db.prepare("SELECT * FROM users WHERE username=? AND active=1").get(username);

  if (!user) {
    bcrypt.compareSync(password, DUMMY_HASH);
    recordLoginFailure(req, username);
    return res.status(401).json({ field: 'password', message: BAD_LOGIN });
  }
  if (!bcrypt.compareSync(password, user.password)) {
    recordLoginFailure(req, username);
    return res.status(401).json({ field: 'password', message: BAD_LOGIN });
  }
  clearLoginFailures(req, username);
  // Đúng mật khẩu nhưng chọn nhầm mục (vd tài khoản học sinh mà bấm mục Giáo viên) → chỉ đúng mục cần chọn
  if (PORTAL_ROLES[portal] && !PORTAL_ROLES[portal].includes(user.role)) {
    return res.status(403).json({ field: 'portal', message: `Đây là tài khoản ${PORTAL_OF_ROLE[user.role]} — hãy chọn mục "${PORTAL_OF_ROLE[user.role]}" để đăng nhập.` });
  }

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role, full_name: user.full_name },
    getJwtSecret(),
    { expiresIn: '7d' }
  );
  setSessionCookie(req, res, token); // để trình duyệt tải được file /uploads có kiểm tra quyền

  res.json({
    token,
    user: { id: user.id, username: user.username, role: user.role, full_name: user.full_name, parent_phone: user.parent_phone },
  });
});

// Cấp lại cookie phiên cho người đang đăng nhập sẵn (token còn trong trình duyệt từ trước khi có tính
// năng này), để họ không phải đăng nhập lại mới xem được file.
router.post('/session', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token || !userFromRequest(req)) return res.status(401).json({ message: 'Unauthorized' });
  setSessionCookie(req, res, token);
  res.json({ message: 'OK' });
});

// App Android: cấp vé xem file /uploads (thay cho cookie phiên, vì app khác tên miền máy chủ).
router.post('/file-ticket', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const user = token && userFromRequest(req);
  if (!user) return res.status(401).json({ message: 'Unauthorized' });
  res.json({ ticket: signFileTicket(user) });
});

router.post('/logout', (req, res) => {
  clearSessionCookie(res);
  res.json({ message: 'Đã đăng xuất' });
});

router.get('/me', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Unauthorized' });
  try {
    const user = jwt.verify(token, getJwtSecret());
    res.json(user);
  } catch {
    res.status(401).json({ message: 'Token không hợp lệ' });
  }
});

// Change own password
router.put('/change-password', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Unauthorized' });

  let user;
  try {
    user = jwt.verify(token, getJwtSecret());
  } catch {
    return res.status(401).json({ message: 'Token không hợp lệ' });
  }

  const { old_password, new_password } = req.body || {};
  if (typeof old_password !== 'string' || typeof new_password !== 'string') {
    return res.status(400).json({ message: 'Thiếu mật khẩu' });
  }
  if (new_password.length < 6) return res.status(400).json({ message: 'Mật khẩu mới phải có ít nhất 6 ký tự' });
  const db = getDb();
  const dbUser = db.prepare('SELECT * FROM users WHERE id=? AND active=1').get(user.id);
  if (!dbUser) return res.status(401).json({ message: 'Tài khoản không còn hiệu lực' });

  if (!bcrypt.compareSync(old_password, dbUser.password)) {
    return res.status(400).json({ message: 'Mật khẩu cũ không đúng' });
  }

  const hash = bcrypt.hashSync(new_password, 10);
  db.prepare('UPDATE users SET password=?,plain_password=? WHERE id=?').run(hash, new_password, user.id);
  res.json({ message: 'Đổi mật khẩu thành công' });
});

module.exports = router;
