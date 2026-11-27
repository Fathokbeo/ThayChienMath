// Thanh toán QR: tạo đơn, xem trạng thái đơn, webhook ngân hàng báo tiền về, trạng thái VIP của tôi.
// Phần quản trị (cài đặt tài khoản nhận tiền, gói VIP, khóa webhook, danh sách đơn) ở routes/siteAdmin.js.
const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');
const { authMiddleware } = require('../middleware/auth');
const pay = require('../services/payments');

// Công khai: có bật thanh toán không + các gói VIP (để trang đề / trang tài khoản hiện nút mua)
router.get('/config', (req, res) => {
  const db = getDb();
  const cfg = pay.paymentConfig(db);
  res.json({ enabled: pay.paymentsReady(cfg), bank_name: cfg.bank_name, vip_plans: cfg.vip_plans });
});

// Ngân hàng / dịch vụ đọc giao dịch gọi vào khi có tiền về tài khoản. Luôn trả 200 khi khóa đúng
// (kể cả giao dịch không khớp đơn nào) để dịch vụ không gửi lại mãi.
router.post('/webhook', (req, res) => {
  const db = getDb();
  if (!pay.webhookAuthorized(db, req)) return res.status(401).json({ success: false, message: 'Sai khóa webhook' });
  const results = pay.handleWebhook(db, req.body);
  res.json({ success: true, results });
});

router.use(authMiddleware);

router.get('/me', (req, res) => {
  const db = getDb();
  const orders = db.prepare(`SELECT code,kind,plan_id,title,amount,status,exam_id,file_kind,created_at,paid_at FROM payment_orders
    WHERE user_id=? ORDER BY id DESC LIMIT 30`).all(req.user.id);
  const files = db.prepare(`SELECT u.exam_id, u.kind, u.source, u.created_at, e.title FROM exam_unlocks u
    JOIN exam_papers e ON e.id=u.exam_id WHERE u.user_id=? ORDER BY u.created_at DESC LIMIT 100`).all(req.user.id);
  res.json({ ...pay.vipStatus(db, req.user), orders, files });
});

router.post('/orders', (req, res) => {
  const db = getDb();
  try {
    const order = pay.createOrder(db, req.user, req.body || {});
    res.status(201).json(pay.orderView(db, order));
  } catch (err) {
    if (err instanceof pay.PaymentError) return res.status(err.status).json({ message: err.message });
    throw err;
  }
});

// Trang hiện QR hỏi mỗi vài giây: đơn đã được ngân hàng báo trả chưa
router.get('/orders/:code', (req, res) => {
  const db = getDb();
  const order = db.prepare('SELECT * FROM payment_orders WHERE code=?').get(String(req.params.code).toUpperCase());
  if (!order || (order.user_id !== req.user.id && req.user.role !== 'admin')) return res.status(404).json({ message: 'Không tìm thấy đơn' });
  res.json(pay.orderView(db, order));
});

router.post('/orders/:code/cancel', (req, res) => {
  const db = getDb();
  const r = db.prepare("UPDATE payment_orders SET status='cancelled' WHERE code=? AND user_id=? AND status='pending'").run(String(req.params.code).toUpperCase(), req.user.id);
  res.json({ cancelled: r.changes > 0 });
});

module.exports = router;
