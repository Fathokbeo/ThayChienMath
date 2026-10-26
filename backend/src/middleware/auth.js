const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../services/security');
const { getDb } = require('../db/database');

// API chỉ chấp nhận token ở header Authorization (KHÔNG nhận cookie phiên), nên cookie dùng cho
// /uploads không thể bị lợi dụng để gọi API thay người dùng từ trang web khác (CSRF).
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Unauthorized' });
  try {
    const decoded = jwt.verify(token, getJwtSecret());
    // Token còn hạn nhưng tài khoản đã bị xóa/vô hiệu hóa, hoặc bị đổi quyền → không còn hiệu lực.
    // Vai trò lấy từ DB (không tin vai trò ghi trong token cũ).
    const row = getDb().prepare('SELECT role,active FROM users WHERE id=?').get(decoded.id);
    if (!row || !row.active) return res.status(401).json({ message: 'Tài khoản không còn hiệu lực' });
    req.user = { ...decoded, role: row.role };
    next();
  } catch {
    res.status(401).json({ message: 'Token không hợp lệ' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Không có quyền truy cập' });
    }
    next();
  };
}

module.exports = { authMiddleware, requireRole };
