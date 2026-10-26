// Tài khoản phụ huynh: MỖI học sinh có sẵn 1 tài khoản phụ huynh, tạo tự động cùng lúc với học sinh.
// - Tên đăng nhập nội bộ: "<tên đăng nhập con>_ph". Ở mục "Phụ huynh" của trang đăng nhập, phụ huynh chỉ
//   cần gõ TÊN ĐĂNG NHẬP CỦA CON (hoặc tên đầy đủ _ph) + mật khẩu phụ huynh.
// - Mật khẩu mặc định: SĐT phụ huynh (chỉ lấy chữ số, nếu đủ 6 số) — dễ nhớ với phụ huynh; chưa có SĐT
//   thì dùng chung mật khẩu của con (dùng lại hash → không tốn thêm thời gian khi nhập hàng loạt).
// Một phụ huynh có thể được admin gán thêm con khác (bảng parent_students), nên xóa học sinh chỉ xóa
// tài khoản phụ huynh khi không còn con nào.
const bcrypt = require('bcryptjs');

const PARENT_SUFFIX = '_ph';

function phoneDigits(phone) {
  const d = String(phone || '').replace(/\D/g, '');
  return d.length >= 6 ? d : '';
}

function uniqueParentUsername(db, studentUsername) {
  const base = `${studentUsername}${PARENT_SUFFIX}`;
  let name = base;
  for (let i = 2; db.prepare('SELECT 1 FROM users WHERE username=?').get(name); i++) name = `${base}${i}`;
  return name;
}

// Tài khoản phụ huynh (đầu tiên) của 1 học sinh, hoặc undefined.
function parentOf(db, studentId) {
  return db.prepare(`
    SELECT u.* FROM parent_students ps JOIN users u ON u.id=ps.parent_id
    WHERE ps.student_id=? AND u.role='parent' ORDER BY ps.created_at, u.id LIMIT 1
  `).get(studentId);
}

// Đảm bảo học sinh có tài khoản phụ huynh; chưa có thì tạo. studentPassword: mật khẩu (chưa mã hóa)
// của học sinh nếu biết — dùng làm mật khẩu phụ huynh khi không có SĐT. Trả về tài khoản phụ huynh.
function ensureParentAccount(db, studentId, { studentPassword, createdBy } = {}) {
  const existing = parentOf(db, studentId);
  if (existing) return existing;
  const st = db.prepare("SELECT * FROM users WHERE id=? AND role='student'").get(studentId);
  if (!st) return null;

  const phone = phoneDigits(st.parent_phone);
  let plain, hash;
  if (phone) { plain = phone; hash = bcrypt.hashSync(phone, 10); }
  else { plain = studentPassword || st.plain_password || null; hash = st.password; }

  const username = uniqueParentUsername(db, st.username);
  const r = db.prepare(
    'INSERT INTO users (username,password,plain_password,full_name,parent_phone,role,created_by) VALUES (?,?,?,?,?,?,?)'
  ).run(username, hash, plain, `Phụ huynh ${st.full_name}`, st.parent_phone || null, 'parent', createdBy || st.created_by || null);
  db.prepare('INSERT OR IGNORE INTO parent_students (parent_id,student_id) VALUES (?,?)').run(r.lastInsertRowid, studentId);
  return db.prepare('SELECT * FROM users WHERE id=?').get(r.lastInsertRowid);
}

// Tạo bù tài khoản phụ huynh cho mọi học sinh chưa có (chạy khi khởi động server).
function ensureAllParentAccounts(db) {
  const missing = db.prepare(`
    SELECT id FROM users WHERE role='student'
    AND id NOT IN (SELECT ps.student_id FROM parent_students ps JOIN users p ON p.id=ps.parent_id)
  `).all();
  if (missing.length === 0) return 0;
  db.transaction(() => missing.forEach(({ id }) => ensureParentAccount(db, id)))();
  return missing.length;
}

// Xóa tài khoản phụ huynh không còn con nào (sau khi xóa học sinh — liên kết tự xóa theo khóa ngoại).
function removeOrphanParents(db) {
  db.prepare("DELETE FROM users WHERE role='parent' AND id NOT IN (SELECT parent_id FROM parent_students)").run();
}

// Đổi SĐT phụ huynh ở học sinh → cập nhật luôn SĐT hiển thị trên tài khoản phụ huynh (không đổi mật khẩu).
function syncParentPhone(db, studentId, phone) {
  db.prepare(`
    UPDATE users SET parent_phone=? WHERE role='parent' AND id IN (SELECT parent_id FROM parent_students WHERE student_id=?)
  `).run(phone || null, studentId);
}

// Từ thứ người dùng gõ ở mục "Phụ huynh" (tên đăng nhập của con, hoặc tên tài khoản phụ huynh) → tài khoản phụ huynh.
function findParentForLogin(db, typed) {
  const u = db.prepare('SELECT * FROM users WHERE username=? AND active=1').get(typed);
  if (!u) return null;
  if (u.role === 'parent') return u;
  if (u.role === 'student') {
    const p = parentOf(db, u.id);
    return p && p.active ? p : null;
  }
  return null;
}

module.exports = { ensureParentAccount, ensureAllParentAccounts, removeOrphanParents, syncParentPhone, parentOf, findParentForLogin, PARENT_SUFFIX };
