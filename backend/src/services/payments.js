// Thanh toán chuyển khoản QR (VietQR) + quyền tải đề (mọi tài khoản / học sinh / VIP / mua lẻ).
//
// Luồng: người dùng bấm Mua → tạo đơn (payment_orders) có mã riêng, vd "EGK7M2QX" → web hiện QR VietQR đã điền
// sẵn số tiền + nội dung = mã đơn → người dùng quét bằng app ngân hàng → dịch vụ đọc giao dịch (SePay / Casso…)
// gọi webhook /api/payments/webhook → khớp mã đơn + đủ tiền → đánh dấu đã trả, mở quyền ngay. Admin cũng xác nhận tay được.
const crypto = require('crypto');

const ACCESS = ['account', 'student', 'vip', 'buy'];
const STAFF = ['admin', 'teacher'];
const STUDENT_ROLES = ['student'];
const CODE_PREFIX = 'EG';
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // bỏ 0/O, 1/I cho khỏi đọc nhầm
const ORDER_REUSE_MS = 2 * 60 * 60 * 1000; // đơn chưa trả trong 2 giờ → dùng lại, không tạo đơn mới

const setting = (db, key) => db.prepare('SELECT value FROM site_settings WHERE key=?').get(key)?.value || '';
const setSetting = (db, key, value) => db.prepare('INSERT INTO site_settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key, String(value ?? ''));

const parseAccess = (v) => [...new Set(String(v || '').split(',').map((s) => s.trim()).filter((s) => ACCESS.includes(s)))];
const accessString = (v) => parseAccess(Array.isArray(v) ? v.join(',') : v).join(',');
const toPrice = (v) => { const n = parseInt(String(v ?? '').replace(/[^\d]/g, ''), 10); return Number.isFinite(n) && n > 0 ? n : null; };

// ── Cài đặt ─────────────────────────────────────────────────────────────
function vipPlans(db) {
  try {
    const list = JSON.parse(setting(db, 'vip_plans') || '[]');
    return (Array.isArray(list) ? list : []).map((p, i) => ({
      id: String(p.id || `g${i + 1}`), name: String(p.name || `Gói ${i + 1}`).slice(0, 60),
      price: toPrice(p.price) || 0, days: Math.max(1, parseInt(p.days, 10) || 30), word_quota: Math.max(0, parseInt(p.word_quota, 10) || 0),
    })).filter((p) => p.price > 0);
  } catch { return []; }
}

function paymentConfig(db) {
  return {
    enabled: setting(db, 'payments_enabled') === '1',
    bank_bin: setting(db, 'bank_bin'), bank_name: setting(db, 'bank_name'),
    bank_account: setting(db, 'bank_account'), bank_account_name: setting(db, 'bank_account_name'),
    webhook_key: setting(db, 'payment_webhook_key'),
    vip_plans: vipPlans(db),
  };
}
// Bật thanh toán khi đã có đủ thông tin tài khoản nhận tiền
const paymentsReady = (c) => c.enabled && /^\d{6}$/.test(c.bank_bin) && !!c.bank_account && !!c.bank_account_name;

function saveConfig(db, body) {
  db.transaction(() => {
    if (body.payments_enabled !== undefined) setSetting(db, 'payments_enabled', body.payments_enabled ? '1' : '0');
    for (const k of ['bank_bin', 'bank_name', 'bank_account', 'bank_account_name']) {
      if (body[k] !== undefined) setSetting(db, k, String(body[k]).trim().slice(0, 80));
    }
    if (body.bank_account_name !== undefined) setSetting(db, 'bank_account_name', String(body.bank_account_name).trim().toUpperCase().slice(0, 80));
    if (Array.isArray(body.vip_plans)) {
      setSetting(db, 'vip_plans', JSON.stringify(body.vip_plans.slice(0, 6).map((p, i) => ({
        id: String(p.id || crypto.randomBytes(3).toString('hex')).slice(0, 20), name: String(p.name || `Gói ${i + 1}`).slice(0, 60),
        price: toPrice(p.price) || 0, days: Math.max(1, parseInt(p.days, 10) || 30), word_quota: Math.max(0, parseInt(p.word_quota, 10) || 0),
      }))));
    }
  })();
  return paymentConfig(db);
}

function rotateWebhookKey(db) {
  const key = crypto.randomBytes(24).toString('base64url');
  setSetting(db, 'payment_webhook_key', key);
  return key;
}

// ── QR VietQR (chuẩn EMVCo của NAPAS) — mọi app ngân hàng Việt Nam quét được ──
const tlv = (id, value) => `${id}${String(value.length).padStart(2, '0')}${value}`;
function crc16(str) {
  let crc = 0xffff;
  for (const ch of Buffer.from(str, 'utf8')) {
    crc ^= ch << 8;
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}
function vietQrPayload({ bin, account, amount, content }) {
  const merchant = tlv('00', 'A000000727') + tlv('01', tlv('00', bin) + tlv('01', account)) + tlv('02', 'QRIBFTTA');
  let s = tlv('00', '01') + tlv('01', amount ? '12' : '11') + tlv('38', merchant) + tlv('53', '704');
  if (amount) s += tlv('54', String(amount));
  s += tlv('58', 'VN');
  if (content) s += tlv('62', tlv('08', content.slice(0, 25)));
  s += '6304';
  return s + crc16(s);
}

// ── Quyền tải 1 bản đề cho 1 người ──────────────────────────────────────
const isVip = (u) => !!(u?.vip_until && new Date(u.vip_until) > new Date());

function userRow(db, user) {
  return user ? db.prepare('SELECT id, role, vip_until, vip_word_quota FROM users WHERE id=? AND active=1').get(user.id) || null : null;
}

// Trả về: { has_file, allowed, via, options } — options cho biết người dùng có thể làm gì để được tải
function fileAccess(db, exam, kind, user) {
  const file = kind === 'pdf' ? exam.pdf_file : exam.docx_file;
  const flags = parseAccess(kind === 'pdf' ? exam.pdf_access : exam.docx_access);
  const price = toPrice(kind === 'pdf' ? exam.pdf_price : exam.docx_price);
  const base = { has_file: !!file, flags, price: flags.includes('buy') ? price : null };
  if (!file) return { ...base, allowed: false, via: null };
  const u = userRow(db, user);
  if (u && STAFF.includes(u.role)) return { ...base, allowed: true, via: 'staff' };
  if (u) {
    const unlocked = db.prepare('SELECT source FROM exam_unlocks WHERE user_id=? AND exam_id=? AND kind=?').get(u.id, exam.id, kind);
    if (unlocked) return { ...base, allowed: true, via: unlocked.source === 'buy' ? 'bought' : 'vip' };
    if (flags.includes('account')) return { ...base, allowed: true, via: 'account' };
    if (flags.includes('student') && STUDENT_ROLES.includes(u.role)) return { ...base, allowed: true, via: 'student' };
    if (flags.includes('vip') && isVip(u)) {
      // VIP: PDF tải thoải mái; Word mỗi file mới trừ 1 lượt
      if (kind === 'pdf') return { ...base, allowed: true, via: 'vip' };
      if ((u.vip_word_quota || 0) > 0) return { ...base, allowed: true, via: 'vip_quota', quota_left: u.vip_word_quota };
      return { ...base, allowed: false, via: null, vip_out_of_quota: true };
    }
  }
  return { ...base, allowed: false, via: null, need_login: !u && flags.length > 0 };
}

// Ghi nhận lượt tải VIP (file Word lần đầu tải) — gọi ngay trước khi gửi file
function consumeVipQuota(db, userId, examId, kind) {
  return db.transaction(() => {
    const u = db.prepare('SELECT vip_word_quota FROM users WHERE id=?').get(userId);
    if (!u || (u.vip_word_quota || 0) <= 0) return false;
    const r = db.prepare("INSERT OR IGNORE INTO exam_unlocks (user_id, exam_id, kind, source) VALUES (?,?,?,'vip')").run(userId, examId, kind);
    if (r.changes) db.prepare('UPDATE users SET vip_word_quota = vip_word_quota - 1 WHERE id=?').run(userId);
    return true;
  })();
}

// ── Đơn thanh toán ──────────────────────────────────────────────────────
function newCode(db) {
  for (;;) {
    const bytes = crypto.randomBytes(6);
    const code = CODE_PREFIX + [...bytes].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
    if (!db.prepare('SELECT 1 FROM payment_orders WHERE code=?').get(code)) return code;
  }
}

class PaymentError extends Error { constructor(status, message) { super(message); this.status = status; } }

function createOrder(db, user, body) {
  const cfg = paymentConfig(db);
  if (!paymentsReady(cfg)) throw new PaymentError(503, 'Trung tâm chưa bật thanh toán trực tuyến');
  let item;
  if (body.kind === 'vip') {
    const plan = cfg.vip_plans.find((p) => p.id === String(body.plan_id));
    if (!plan) throw new PaymentError(400, 'Gói VIP không hợp lệ');
    item = { kind: 'vip', plan_id: plan.id, exam_id: null, file_kind: null, amount: plan.price, title: `${plan.name} · ${plan.days} ngày` + (plan.word_quota ? ` · ${plan.word_quota} lượt tải Word` : '') };
  } else if (body.kind === 'file') {
    const fileKind = body.file_kind === 'pdf' ? 'pdf' : 'docx';
    const exam = db.prepare('SELECT * FROM exam_papers WHERE id=? AND active=1').get(body.exam_id);
    if (!exam) throw new PaymentError(404, 'Không tìm thấy đề');
    const acc = fileAccess(db, exam, fileKind, user);
    if (acc.allowed) throw new PaymentError(400, 'Bạn đã tải được file này rồi');
    if (!acc.has_file || !acc.flags.includes('buy') || !acc.price) throw new PaymentError(400, 'File này không bán lẻ');
    item = { kind: 'file', plan_id: null, exam_id: exam.id, file_kind: fileKind, amount: acc.price, title: `File ${fileKind === 'pdf' ? 'PDF' : 'Word'}: ${exam.title}`.slice(0, 200) };
  } else throw new PaymentError(400, 'Loại đơn không hợp lệ');

  // Đơn cùng món, chưa trả, còn mới → dùng lại (bấm Mua nhiều lần không sinh nhiều mã)
  const since = new Date(Date.now() - ORDER_REUSE_MS).toISOString().replace('T', ' ').slice(0, 19);
  const existing = db.prepare(`SELECT * FROM payment_orders WHERE user_id=? AND status='pending' AND kind=? AND amount=?
    AND COALESCE(plan_id,'')=? AND COALESCE(exam_id,0)=? AND COALESCE(file_kind,'')=? AND created_at >= ? ORDER BY id DESC LIMIT 1`)
    .get(user.id, item.kind, item.amount, item.plan_id || '', item.exam_id || 0, item.file_kind || '', since);
  if (existing) return existing;
  const code = newCode(db);
  const r = db.prepare('INSERT INTO payment_orders (code,user_id,kind,plan_id,exam_id,file_kind,title,amount) VALUES (?,?,?,?,?,?,?,?)')
    .run(code, user.id, item.kind, item.plan_id, item.exam_id, item.file_kind, item.title, item.amount);
  return db.prepare('SELECT * FROM payment_orders WHERE id=?').get(r.lastInsertRowid);
}

// Thông tin đơn gửi cho người mua: kèm chuỗi QR + tài khoản nhận để chuyển tay nếu không quét được
function orderView(db, order) {
  const cfg = paymentConfig(db);
  return {
    code: order.code, kind: order.kind, title: order.title, amount: order.amount, status: order.status,
    exam_id: order.exam_id, file_kind: order.file_kind, created_at: order.created_at, paid_at: order.paid_at,
    bank: { name: cfg.bank_name, bin: cfg.bank_bin, account: cfg.bank_account, account_name: cfg.bank_account_name },
    qr: order.status === 'pending' && paymentsReady(cfg)
      ? vietQrPayload({ bin: cfg.bank_bin, account: cfg.bank_account, amount: order.amount, content: order.code }) : null,
  };
}

// Đánh dấu đã trả + mở quyền (1 lần duy nhất, an toàn khi webhook gọi lặp)
function markPaid(db, orderId, { amount, via, txn }) {
  return db.transaction(() => {
    const o = db.prepare('SELECT * FROM payment_orders WHERE id=?').get(orderId);
    if (!o || o.status === 'paid') return false;
    db.prepare("UPDATE payment_orders SET status='paid', paid_amount=?, paid_at=CURRENT_TIMESTAMP, paid_via=?, provider_txn=? WHERE id=?")
      .run(amount ?? o.amount, via, txn || null, o.id);
    if (o.kind === 'file' && o.user_id) {
      db.prepare("INSERT OR REPLACE INTO exam_unlocks (user_id, exam_id, kind, source) VALUES (?,?,?,'buy')").run(o.user_id, o.exam_id, o.file_kind);
    }
    if (o.kind === 'vip' && o.user_id) {
      const plan = vipPlans(db).find((p) => p.id === o.plan_id) || { days: 30, word_quota: 0 };
      const u = db.prepare('SELECT vip_until FROM users WHERE id=?').get(o.user_id);
      const from = u?.vip_until && new Date(u.vip_until) > new Date() ? new Date(u.vip_until) : new Date();
      from.setDate(from.getDate() + plan.days);
      db.prepare('UPDATE users SET vip_until=?, vip_word_quota=COALESCE(vip_word_quota,0)+? WHERE id=?').run(from.toISOString(), plan.word_quota, o.user_id);
    }
    return true;
  })();
}

// ── Webhook báo giao dịch ngân hàng ─────────────────────────────────────
// Nhận được cả kiểu SePay (1 giao dịch: content, transferAmount, transferType, id) lẫn kiểu Casso (data: [{ description, amount, tid }]).
// Xác thực bằng khóa bí mật admin tạo trong trang Thanh toán, gửi qua header Authorization: "Apikey <khóa>" (SePay),
// "secure-token: <khóa>" (Casso), "x-api-key: <khóa>", hoặc ?key=<khóa> trên đường dẫn.
function webhookAuthorized(db, req) {
  const key = setting(db, 'payment_webhook_key');
  if (!key) return false;
  const auth = String(req.headers.authorization || '');
  const given = auth.replace(/^(apikey|bearer)\s+/i, '') || req.headers['secure-token'] || req.headers['x-api-key'] || req.query.key || '';
  const a = Buffer.from(String(given)); const b = Buffer.from(key);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function handleWebhook(db, body) {
  const list = Array.isArray(body?.data) ? body.data : body ? [body] : [];
  const results = [];
  for (const tx of list) {
    const amount = Number(tx.transferAmount ?? tx.amount ?? 0);
    const outgoing = String(tx.transferType || '').toLowerCase() === 'out' || amount <= 0;
    const txn = String(tx.id ?? tx.tid ?? tx.referenceCode ?? '') || null;
    if (outgoing) { results.push({ txn, skipped: 'outgoing' }); continue; }
    if (txn && db.prepare('SELECT 1 FROM payment_orders WHERE provider_txn=?').get(txn)) { results.push({ txn, skipped: 'duplicate' }); continue; }
    const text = String(tx.content || tx.description || tx.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const codes = text.match(new RegExp(`${CODE_PREFIX}[${CODE_ALPHABET}]{6}`, 'g')) || [];
    const order = codes.map((c) => db.prepare("SELECT * FROM payment_orders WHERE code=? AND status='pending'").get(c)).find(Boolean);
    if (!order) { results.push({ txn, skipped: 'no_order' }); continue; }
    if (amount < order.amount) { results.push({ txn, code: order.code, skipped: 'amount_too_low' }); continue; }
    markPaid(db, order.id, { amount, via: 'webhook', txn });
    results.push({ txn, code: order.code, paid: true });
  }
  return results;
}

// Trạng thái VIP gửi cho người dùng (trang tài khoản, trang đề)
function vipStatus(db, user) {
  const u = userRow(db, user);
  return { vip: isVip(u), vip_until: u?.vip_until || null, word_quota: u?.vip_word_quota || 0 };
}

module.exports = {
  ACCESS, PaymentError, parseAccess, accessString, toPrice, paymentConfig, paymentsReady, saveConfig, rotateWebhookKey,
  vietQrPayload, fileAccess, consumeVipQuota, createOrder, orderView, markPaid, webhookAuthorized, handleWebhook, vipStatus, vipPlans,
};
