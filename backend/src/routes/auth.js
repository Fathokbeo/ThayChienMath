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
const { verifyGoogleCredential } = require('../services/googleAuth');

// Hash giả để so sánh khi tên đăng nhập không tồn tại → thời gian phản hồi như nhau, không dò được tên có thật
const DUMMY_HASH = bcrypt.hashSync('khong-phai-mat-khau-that', 10);
const BAD_LOGIN = 'Tên đăng nhập hoặc mật khẩu không đúng';

// Mục đăng nhập trên giao diện (portal) → các vai trò được phép. Admin đăng nhập ở mục Giáo viên.
const PORTAL_ROLES = { teacher: ['teacher', 'admin'], student: ['student'], parent: ['parent'], guest: ['guest'] };
const PORTAL_OF_ROLE = { admin: 'Giáo viên', teacher: 'Giáo viên', student: 'Học sinh', parent: 'Phụ huynh', guest: 'Khách' };

const publicUser = (u) => ({
  id: u.id, username: u.username, role: u.role, full_name: u.full_name, parent_phone: u.parent_phone,
  email: u.email || null, avatar_url: u.avatar_url || null,
});

// Cấp token đăng nhập (+ cookie phiên để tải file) và trả về cho trình duyệt
function issueLogin(req, res, user) {
  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role, full_name: user.full_name },
    getJwtSecret(),
    { expiresIn: '7d' }
  );
  setSessionCookie(req, res, token); // để trình duyệt tải được file /uploads có kiểm tra quyền
  res.json({ token, user: publicUser(user) });
}

// Chặn tạo tài khoản dồn dập: tối đa 5 tài khoản / giờ / 1 địa chỉ IP
const signupHits = new Map();
function tooManySignups(ip) {
  const now = Date.now();
  const hit = signupHits.get(ip);
  if (!hit || now > hit.resetAt) { signupHits.set(ip, { count: 1, resetAt: now + 60 * 60 * 1000 }); return false; }
  hit.count += 1;
  if (signupHits.size > 5000) for (const [k, v] of signupHits) if (now > v.resetAt) signupHits.delete(k);
  return hit.count > 5;
}
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// Email đã dùng cho tài khoản nào chưa (làm tên đăng nhập hoặc ở cột email)
const findByEmail = (db, email) => db.prepare('SELECT * FROM users WHERE lower(username)=? OR lower(email)=? ORDER BY id LIMIT 1').get(email, email);

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

  issueLogin(req, res, user);
});

// Khách tự tạo tài khoản: họ tên + email (dùng làm tên đăng nhập) + mật khẩu
router.post('/register', (req, res) => {
  const b = req.body || {};
  const full_name = String(b.full_name ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
  const email = String(b.email ?? '').trim().toLowerCase().slice(0, 120);
  const password = typeof b.password === 'string' ? b.password : '';
  if (!full_name) return res.status(400).json({ field: 'full_name', message: 'Vui lòng nhập họ tên' });
  if (!EMAIL_RE.test(email)) return res.status(400).json({ field: 'email', message: 'Email không hợp lệ' });
  if (password.length < 6) return res.status(400).json({ field: 'password', message: 'Mật khẩu phải có ít nhất 6 ký tự' });
  const db = getDb();
  if (findByEmail(db, email)) return res.status(409).json({ field: 'email', message: 'Email này đã có tài khoản — hãy đăng nhập (hoặc dùng nút Đăng nhập bằng Google)' });
  if (tooManySignups(req.ip)) return res.status(429).json({ message: 'Bạn tạo quá nhiều tài khoản, vui lòng thử lại sau' });
  const r = db.prepare("INSERT INTO users (username,password,full_name,email,role) VALUES (?,?,?,?,'guest')")
    .run(email, bcrypt.hashSync(password, 10), full_name, email);
  issueLogin(req, res, db.prepare('SELECT * FROM users WHERE id=?').get(r.lastInsertRowid));
});

// Đăng nhập / đăng ký bằng Google. Lần đầu: tạo tài khoản khách theo email Google. Đã có tài khoản khách cùng
// email (tự đăng ký trước đó) → gắn Google vào đúng tài khoản đó. Email trùng tài khoản giáo viên/học sinh/phụ
// huynh thì KHÔNG tự gắn (email của các tài khoản này do admin gõ, chưa chắc là của chủ email) → báo dùng tên đăng nhập.
router.post('/google', async (req, res) => {
  let g;
  try { g = await verifyGoogleCredential(req.body?.credential); }
  catch { return res.status(401).json({ message: 'Đăng nhập Google không thành công, vui lòng thử lại' }); }
  const db = getDb();
  let user = db.prepare('SELECT * FROM users WHERE google_sub=?').get(g.sub);
  if (!user) {
    const same = findByEmail(db, g.email);
    if (same && same.role !== 'guest') {
      return res.status(409).json({ message: `Email này thuộc tài khoản ${PORTAL_OF_ROLE[same.role]} — hãy đăng nhập ở mục "${PORTAL_OF_ROLE[same.role]}" bằng tên đăng nhập và mật khẩu.` });
    }
    if (same) {
      db.prepare('UPDATE users SET google_sub=?, avatar_url=COALESCE(avatar_url, ?), email=COALESCE(email, ?) WHERE id=?').run(g.sub, g.picture, g.email, same.id);
      user = db.prepare('SELECT * FROM users WHERE id=?').get(same.id);
    } else {
      if (tooManySignups(req.ip)) return res.status(429).json({ message: 'Bạn tạo quá nhiều tài khoản, vui lòng thử lại sau' });
      // Mật khẩu ngẫu nhiên không ai biết: tài khoản này chỉ đăng nhập bằng Google
      const r = db.prepare("INSERT INTO users (username,password,full_name,email,role,google_sub,avatar_url) VALUES (?,?,?,?,'guest',?,?)")
        .run(g.email, bcrypt.hashSync(require('crypto').randomBytes(24).toString('hex'), 10), g.name.slice(0, 80), g.email, g.sub, g.picture);
      user = db.prepare('SELECT * FROM users WHERE id=?').get(r.lastInsertRowid);
    }
  }
  if (!user.active) return res.status(403).json({ message: 'Tài khoản đã bị khóa' });
  issueLogin(req, res, user);
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
