// Đăng nhập bằng Google (Google Identity Services): trình duyệt nhận "thẻ" (ID token) từ Google rồi gửi lên,
// máy chủ kiểm tra chữ ký + đúng ứng dụng của mình (audience) với Google trước khi tin email trong thẻ.
const { OAuth2Client } = require('google-auth-library');

// Client ID là mã CÔNG KHAI (trang web nào dùng nút đăng nhập Google cũng lộ ra) — không phải bí mật.
// Đặt GOOGLE_CLIENT_ID trong .env để đổi sang client khác.
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '639181055073-k4c58us4gmcscvuek8jjdr1uib09ngdv.apps.googleusercontent.com';
const client = new OAuth2Client(GOOGLE_CLIENT_ID);

// Trả về { sub, email, name, picture } nếu thẻ hợp lệ và email đã được Google xác minh; ngược lại ném lỗi.
async function verifyGoogleCredential(credential) {
  const ticket = await client.verifyIdToken({ idToken: String(credential || ''), audience: GOOGLE_CLIENT_ID });
  const p = ticket.getPayload() || {};
  if (!p.sub || !p.email || p.email_verified !== true) throw new Error('Email Google chưa được xác minh');
  return { sub: p.sub, email: String(p.email).toLowerCase(), name: p.name || p.email.split('@')[0], picture: p.picture || null };
}

module.exports = { GOOGLE_CLIENT_ID, verifyGoogleCredential };
