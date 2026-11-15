// Gọi Claude cho mọi việc AI của web (chấm bài, đọc barem, gắn nhãn khóa học…). Chỉ dùng Claude, không còn Gemini.
//
// Tiết kiệm chi phí:
//  1. BATCH API (−50% mọi token): các lượt gọi phát sinh từ HÀNG ĐỢI CHẤM BÀI NỀN được gom lại ~20 giây rồi gửi
//     thành 1 lô (Message Batches). Kết quả thường có sau vài phút (tối đa 24 giờ) thay vì ngay lập tức — chấm vốn
//     chạy nền nên học sinh không phải chờ. Giáo viên bấm "Chấm lại" thì vẫn gọi trực tiếp (có kết quả ngay).
//     Lô đang chạy + kết quả lô (giữ 3 ngày) được lưu vào DB (bảng ai_batch_requests) → server khởi động lại / cập
//     nhật code giữa chừng: bài được chấm lại nhưng các lượt đã có kết quả dùng lại luôn, không trả tiền lần 2.
//  2. LƯU CACHE phần giống nhau cho cả lớp (đề + barem + hướng dẫn chấm): đánh dấu cache_control ở cuối phần đó,
//     các bài sau của cùng đề chỉ tính ~10% giá phần này.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { AsyncLocalStorage } = require('async_hooks');
const Anthropic = require('@anthropic-ai/sdk');
const { getDb } = require('../db/database');
const { recordUsage, underBudget } = require('./aiUsage');

// ── MODEL THEO VIỆC ─────────────────────────────────────────────────────────────────────────────────
// Admin chọn model cho 5 nhóm việc ở trang Tổng quan (lưu site_settings.ai_models); chưa chọn → mặc định dưới đây
// (hoặc CLAUDE_MODEL_<NHÓM> trong .env). Mức suy nghĩ cố định theo việc (đổi qua .env CLAUDE_EFFORT_<VIỆC>).
const MODEL_OPTIONS = [
  { id: 'claude-opus-5-5', label: 'Opus 5.5', note: 'mạnh nhất, đắt nhất' },
  { id: 'claude-sonnet-5-5', label: 'Sonnet 5.5', note: 'cân bằng' },
  { id: 'claude-haiku-5-5', label: 'Haiku 5.5', note: 'nhanh, rẻ nhất' },
];
const MODEL_GROUPS = {
  grade:  { label: 'Chấm chính', hint: 'Lượt chấm quyết định điểm khi 2 lượt khớp nhau', default: 'claude-sonnet-5-5' },
  check:  { label: 'Chấm đối chiếu', hint: 'Lượt chấm độc lập thứ 2 + xem học sinh có làm từng ý không', default: 'claude-haiku-5-5' },
  review: { label: 'Phân xử khi lệch', hint: 'Chỉ chạy khi 2 lượt cho điểm khác nhau, chỉ chấm lại các ý lệch', default: 'claude-opus-5-5' },
  rubric: { label: 'Đọc barem & đáp án', hint: '1 lần cho mỗi đề: lập khung ý chấm, đọc đáp án trắc nghiệm', default: 'claude-opus-5-5' },
  light:  { label: 'Việc nhỏ', hint: 'Tóm tắt chủ đề đề bài, gắn nhãn khóa học', default: 'claude-haiku-5-5' },
};
// Việc → [nhóm model, mức suy nghĩ]
const ROLES = {
  grade: ['grade', 'high'], check: ['check', 'medium'], attempted: ['check', 'medium'], review: ['review', 'high'],
  rubric: ['rubric', 'high'], extract: ['rubric', 'medium'], overview: ['light', 'low'], tagging: ['light', 'low'],
};
const MODEL_IDS = new Set(MODEL_OPTIONS.map((m) => m.id));

function chosenModels() {
  let saved = {};
  try { saved = JSON.parse(getDb().prepare("SELECT value FROM site_settings WHERE key='ai_models'").get()?.value || '{}') || {}; } catch { saved = {}; }
  return Object.fromEntries(Object.entries(MODEL_GROUPS).map(([g, def]) => [g,
    MODEL_IDS.has(saved[g]) ? saved[g] : (process.env[`CLAUDE_MODEL_${g.toUpperCase()}`] || def.default)]));
}
function roleConfig(role) {
  const [group, effort] = ROLES[role];
  return { model: chosenModels()[group], effort: process.env[`CLAUDE_EFFORT_${role.toUpperCase()}`] || effort };
}
function saveModels(input) {
  const cur = chosenModels();
  for (const g of Object.keys(MODEL_GROUPS)) {
    if (input && input[g] !== undefined) {
      if (!MODEL_IDS.has(input[g])) throw Object.assign(new Error('Model không hợp lệ'), { status: 400 });
      cur[g] = input[g];
    }
  }
  getDb().prepare("INSERT INTO site_settings (key,value) VALUES ('ai_models',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(JSON.stringify(cur));
  return cur;
}
// Tương thích chỗ cũ đọc CLAUDE_ROLES.<việc>.model
const CLAUDE_ROLES = new Proxy({}, { get: (_, role) => (ROLES[role] ? roleConfig(role) : undefined) });

// ── KHÓA API ───────────────────────────────────────────────────────────────────────────────────────
// Admin dán khóa ở trang Tổng quan (lưu site_settings.anthropic_api_key — KHÔNG bao giờ gửi lại về trình duyệt);
// chưa có thì dùng ANTHROPIC_API_KEY trong .env. Đổi khóa → tự tạo lại client, không cần khởi động lại server.
const KEY_RE = /^sk-ant-api\d*-[A-Za-z0-9_-]{20,}$/;
const KEY_SETTING = 'anthropic_api_key';

function storedKey() {
  try { return getDb().prepare('SELECT value FROM site_settings WHERE key=?').get(KEY_SETTING)?.value || ''; } catch { return ''; }
}
function currentKey() {
  const stored = storedKey();
  if (stored) return { key: stored, source: 'admin' };
  const env = (process.env.ANTHROPIC_API_KEY || '').trim();
  return env ? { key: env, source: 'env' } : { key: '', source: null };
}
const newClient = (key) => new Anthropic({ apiKey: key, timeout: 10 * 60e3, maxRetries: 3 });

let client = null; let clientKey = null;
// Client theo khóa hiện tại (null nếu chưa có khóa đúng dạng)
function api() {
  const { key } = currentKey();
  if (!KEY_RE.test(key)) return null;
  if (key !== clientKey) { client = newClient(key); clientKey = key; }
  return client;
}

// Cho trang admin: có khóa chưa, từ đâu, vài ký tự đầu/cuối (không bao giờ trả cả khóa)
function keyInfo() {
  const { key, source } = currentKey();
  return { source, valid: KEY_RE.test(key), hint: key ? `${key.slice(0, 13)}…${key.slice(-4)}` : null };
}

// Admin lưu khóa mới: kiểm tra dạng + gọi thử API (liệt kê model — không tốn tiền) rồi mới lưu
async function saveApiKey(raw) {
  const key = String(raw || '').trim();
  if (/^sk-ant-(usr|oat|sid)/.test(key)) {
    throw Object.assign(new Error('Đây là mã đăng nhập tài khoản Claude (gói đăng ký), không phải khóa API. Hãy tạo khóa ở console.anthropic.com → API Keys (dạng sk-ant-api03-…).'), { status: 400 });
  }
  if (!KEY_RE.test(key)) throw Object.assign(new Error('Khóa không đúng dạng — khóa API Claude bắt đầu bằng sk-ant-api03-'), { status: 400 });
  try {
    await newClient(key).models.list({ limit: 1 });
  } catch (err) {
    const s = err.status;
    const msg = s === 401 ? 'Anthropic báo khóa không hợp lệ hoặc đã bị xóa'
      : s === 403 ? 'Khóa không có quyền dùng API (kiểm tra tài khoản trên console.anthropic.com)'
        : `Không kiểm tra được khóa với Anthropic (${s || 'lỗi mạng'}) — thử lại sau`;
    throw Object.assign(new Error(msg), { status: s === 401 || s === 403 ? 400 : 502 });
  }
  getDb().prepare('INSERT INTO site_settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(KEY_SETTING, key);
  console.log('[claude] admin đã cài khóa API mới → AI chấm bài BẬT');
  setTimeout(() => { try { require('./gradingQueue').sweepPending(); } catch { /* bỏ qua */ } }, 1000); // chấm luôn bài đang chờ
  return keyInfo();
}

function removeApiKey() {
  getDb().prepare('DELETE FROM site_settings WHERE key=?').run(KEY_SETTING);
  return keyInfo();
}

const claudeConfigured = () => !!api();
// Claude dùng được ngay lúc này không (có khóa + chưa chạm trần ngân sách tháng)
const claudeReady = () => {
  if (!api()) return false;
  try { return underBudget(); } catch { return false; }
};

// Lỗi "AI không dùng được" (chưa có khóa / hết ngân sách) — hàng đợi giữ bài ở trạng thái chờ, không tính lượt thử
function aiOffError() {
  const e = new Error(api() ? 'Đã chạm trần ngân sách AI tháng này — bài sẽ được chấm khi tăng trần hoặc sang tháng mới'
    : 'Chưa cài khóa API Claude (admin dán khóa ở trang Tổng quan) nên AI chưa chấm được');
  e.code = 'AI_OFF';
  return e;
}

// ── Nội dung gửi Claude ────────────────────────────────────────────────────────────────────────────
// Ảnh điện thoại thường 4–10MB, Claude nhận tối đa 5MB/ảnh → thu nhỏ (cạnh dài 2400px, JPEG 85%) — vẫn rõ chữ viết tay.
const MAX_IMAGE_BYTES = 3.6 * 1024 * 1024; // base64 nở thêm 1/3 → còn dưới 5MB
const MIME = { '.pdf': 'application/pdf', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif' };

async function fileBlock(filePath) {
  const mime = MIME[path.extname(filePath).toLowerCase()];
  if (!mime) throw new Error(`Claude không đọc được loại file ${path.extname(filePath) || '(không đuôi)'}`);
  let buf = fs.readFileSync(filePath);
  if (mime === 'application/pdf') {
    return { type: 'document', source: { type: 'base64', media_type: mime, data: buf.toString('base64') } };
  }
  let media = mime;
  if (buf.length > MAX_IMAGE_BYTES) {
    const sharp = require('sharp');
    for (const [side, q] of [[2400, 85], [2000, 80], [1600, 75]]) {
      buf = await sharp(buf).rotate().resize({ width: side, height: side, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: q }).toBuffer();
      media = 'image/jpeg';
      if (buf.length <= MAX_IMAGE_BYTES) break;
    }
  }
  return { type: 'image', source: { type: 'base64', media_type: media, data: buf.toString('base64') } };
}

const text = (t) => ({ type: 'text', text: t });
// Đánh dấu "lưu cache tới đây" cho khối cuối cùng của phần giống nhau giữa các bài nộp
const cached = (block) => ({ ...block, cache_control: { type: 'ephemeral' } });

// ── BATCH ──────────────────────────────────────────────────────────────────────────────────────────
// Chỉ các lượt gọi chạy BÊN TRONG batchScope (hàng đợi chấm nền bọc mỗi bài bằng runInBatchScope) mới đi đường lô.
const batchScope = new AsyncLocalStorage();
const runInBatchScope = (fn) => batchScope.run({ batch: true }, fn);

// Admin bật/tắt ở trang Tổng quan (mặc định BẬT). Tắt → mọi lượt gọi trực tiếp (nhanh hơn, giá gấp đôi).
function batchEnabled() {
  try {
    const row = getDb().prepare("SELECT value FROM site_settings WHERE key='ai_batch_mode'").get();
    return (row ? row.value : (process.env.CLAUDE_BATCH ?? '1')) !== '0';
  } catch { return false; }
}
const inBatchMode = () => !!(batchScope.getStore()?.batch && batchEnabled());

const WINDOW_MS = +process.env.CLAUDE_BATCH_WINDOW_MS || 20_000; // gom yêu cầu trong 20 giây rồi gửi 1 lô
const POLL_MS = +process.env.CLAUDE_BATCH_POLL_MS || 30_000;     // hỏi trạng thái lô mỗi 30 giây
const MAX_LOT_BYTES = 150 * 1024 * 1024;                          // giới hạn của API là 256MB / lô

const waiters = new Map(); // custom_id → [{ resolve, reject }]
let lot = [];              // yêu cầu đang gom: { id, params, label, bytes }
let lotBytes = 0;
let lotTimer = null;
const polling = new Set(); // batch id đang chờ kết quả
let pollTimer = null;

function batchInfraError(msg) { const e = new Error(msg); e.batchInfra = true; return e; }

// Gửi 1 yêu cầu theo lô → Promise<{ message, cost }>. Yêu cầu GIỐNG HỆT nhau (cùng mã băm) chỉ gửi 1 lần.
function batchCreate(params, label) {
  const body = JSON.stringify(params);
  const id = crypto.createHash('sha256').update(body).digest('hex'); // 64 ký tự [0-9a-f] — đúng chuẩn custom_id
  const db = getDb();
  return new Promise((resolve, reject) => {
    const row = db.prepare('SELECT status,batch_id,result,cost FROM ai_batch_requests WHERE custom_id=?').get(id);
    if (row && row.status === 'succeeded') { // đã có kết quả (vd chấm dở rồi server khởi động lại) → dùng lại
      return resolve({ message: JSON.parse(row.result), cost: 0 }); // tiền đã ghi lúc kết quả về
    }
    const list = waiters.get(id);
    if (list) { list.push({ resolve, reject }); return; } // đang có yêu cầu giống hệt chờ kết quả
    waiters.set(id, [{ resolve, reject }]);
    if (row && row.status === 'pending' && row.batch_id) { watchBatch(row.batch_id); return; }
    db.prepare(`INSERT INTO ai_batch_requests (custom_id,label,status) VALUES (?,?,'queued')
      ON CONFLICT(custom_id) DO UPDATE SET status='queued', batch_id=NULL, result=NULL, error=NULL, created_at=CURRENT_TIMESTAMP`).run(id, label || null);
    lot.push({ id, params, bytes: body.length });
    lotBytes += body.length;
    if (lotBytes >= MAX_LOT_BYTES) flushLot();
    else if (!lotTimer) lotTimer = setTimeout(flushLot, WINDOW_MS);
  });
}

function settle(id, fn) {
  const list = waiters.get(id) || [];
  waiters.delete(id);
  list.forEach(fn);
  return list.length;
}

async function flushLot() {
  clearTimeout(lotTimer); lotTimer = null;
  const reqs = lot; lot = []; lotBytes = 0;
  if (!reqs.length) return;
  const db = getDb();
  db.prepare("DELETE FROM ai_batch_requests WHERE status='succeeded' AND created_at < datetime('now','-3 days')").run();
  try {
    const batch = await api().messages.batches.create({ requests: reqs.map((r) => ({ custom_id: r.id, params: r.params })) });
    const upd = db.prepare("UPDATE ai_batch_requests SET status='pending', batch_id=? WHERE custom_id=?");
    db.transaction(() => reqs.forEach((r) => upd.run(batch.id, r.id)))();
    console.log(`[claude-batch] đã gửi lô ${batch.id}: ${reqs.length} yêu cầu (${(reqs.reduce((s, r) => s + r.bytes, 0) / 1048576).toFixed(1)}MB)`);
    watchBatch(batch.id);
  } catch (err) {
    console.error(`[claude-batch] gửi lô lỗi: ${err.message} → các yêu cầu sẽ gọi trực tiếp`);
    const del = db.prepare('DELETE FROM ai_batch_requests WHERE custom_id=?');
    reqs.forEach((r) => { del.run(r.id); settle(r.id, (w) => w.reject(batchInfraError(`gửi lô lỗi: ${err.message}`))); });
  }
}

function watchBatch(batchId) {
  polling.add(batchId);
  if (!pollTimer) pollTimer = setInterval(pollBatches, POLL_MS);
}

let pollingNow = false;
async function pollBatches() {
  if (pollingNow) return;
  pollingNow = true;
  try {
    for (const batchId of [...polling]) {
      let batch;
      try { batch = await api().messages.batches.retrieve(batchId); } catch (err) {
        if (err.status === 404) { dropBatch(batchId, 'lô không còn trên máy chủ'); } else console.warn(`[claude-batch] hỏi lô ${batchId} lỗi: ${err.message}`);
        continue;
      }
      if (batch.processing_status !== 'ended') continue;
      await collectResults(batchId);
      polling.delete(batchId);
    }
  } finally {
    pollingNow = false;
    if (!polling.size) { clearInterval(pollTimer); pollTimer = null; }
  }
}

async function collectResults(batchId) {
  const db = getDb();
  const labelOf = db.prepare('SELECT label FROM ai_batch_requests WHERE custom_id=?');
  const store = db.prepare("UPDATE ai_batch_requests SET status='succeeded', result=?, cost=? WHERE custom_id=?");
  const del = db.prepare('DELETE FROM ai_batch_requests WHERE custom_id=?');
  let ok = 0, bad = 0, total = 0;
  for await (const r of await api().messages.batches.results(batchId)) {
    const id = r.custom_id;
    if (r.result.type === 'succeeded') {
      const msg = r.result.message;
      const cost = recordUsage({ model: msg.model, label: labelOf.get(id)?.label, usage: msg.usage || {}, batch: true });
      total += cost; ok++;
      store.run(JSON.stringify(msg), cost, id); // giữ 3 ngày: chấm dở mà server khởi động lại thì dùng lại
      settle(id, (w) => w.resolve({ message: msg, cost }));
    } else {
      bad++;
      const why = r.result.type === 'errored' ? (r.result.error?.error?.message || r.result.error?.message || 'lỗi') : r.result.type;
      del.run(id);
      settle(id, (w) => w.reject(batchInfraError(`yêu cầu trong lô ${r.result.type}: ${why}`)));
    }
  }
  console.log(`[claude-batch] lô ${batchId} xong: ${ok} thành công, ${bad} lỗi, $${total.toFixed(4)}`);
  // Yêu cầu không có trong kết quả (hiếm) → cho gọi lại
  db.prepare("SELECT custom_id FROM ai_batch_requests WHERE batch_id=? AND status='pending'").all(batchId)
    .forEach(({ custom_id }) => { del.run(custom_id); settle(custom_id, (w) => w.reject(batchInfraError('thiếu kết quả trong lô'))); });
}

function dropBatch(batchId, why) {
  polling.delete(batchId);
  const db = getDb();
  db.prepare('SELECT custom_id FROM ai_batch_requests WHERE batch_id=?').all(batchId).forEach(({ custom_id }) => {
    settle(custom_id, (w) => w.reject(batchInfraError(why)));
  });
  db.prepare('DELETE FROM ai_batch_requests WHERE batch_id=?').run(batchId);
}

// Khởi động server: theo dõi tiếp các lô đang chạy dở, bỏ yêu cầu chưa kịp gửi, dọn kết quả cũ không ai dùng
function resumeBatches() {
  if (!api()) { console.warn('[claude] Chưa có khóa API Claude → AI chấm bài đang TẮT (admin dán khóa ở trang Tổng quan)'); return; }
  try {
    const db = getDb();
    db.prepare("DELETE FROM ai_batch_requests WHERE status='queued' OR created_at < datetime('now','-3 days')").run();
    const ids = db.prepare("SELECT DISTINCT batch_id FROM ai_batch_requests WHERE status='pending' AND batch_id IS NOT NULL").all();
    ids.forEach(({ batch_id }) => watchBatch(batch_id));
    if (ids.length) { console.log(`[claude-batch] theo dõi tiếp ${ids.length} lô đang chạy`); setTimeout(pollBatches, 5000); }
  } catch (err) { console.error('[claude-batch] resume lỗi:', err.message); }
}

// ── 1 LƯỢT GỌI ────────────────────────────────────────────────────────────────────────────────────
// Model có "dự phòng phía máy chủ" khi bị từ chối vì chính sách an toàn (chỉ dùng khi gọi trực tiếp)
const SERVER_FALLBACK_MODELS = new Set(['claude-opus-5-5', 'claude-sonnet-5-5']);

async function realtime(params, label) {
  const resp = SERVER_FALLBACK_MODELS.has(params.model)
    ? await api().beta.messages.create({ ...params, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' })
    : await api().messages.create(params);
  const cost = recordUsage({ model: resp.model || params.model, label, usage: resp.usage || {} });
  return { message: resp, cost };
}

function parseError(msg) { const e = new Error(msg); e.isParseError = true; return e; }

// content: mảng khối nội dung Claude. → { text, model, cost, batch }
async function callClaude(role, content, label, { maxTokens = 16000, forceRealtime = false } = {}) {
  if (!claudeReady()) throw aiOffError();
  const { model, effort } = roleConfig(role);
  const params = {
    model,
    max_tokens: maxTokens,
    thinking: { type: 'adaptive' },
    output_config: { effort },
    messages: [{ role: 'user', content }],
  };
  let res; let batch = false;
  if (!forceRealtime && inBatchMode()) {
    try { res = await batchCreate(params, role); batch = true; } catch (err) {
      if (!err.batchInfra) throw err;
      console.warn(`[claude] ${label}: ${err.message} → gọi trực tiếp`);
    }
  }
  if (!res) res = await realtime(params, role);
  const msg = res.message;
  if (msg.stop_reason === 'refusal') throw new Error(`Claude từ chối trả lời (${msg.stop_details?.category || 'không rõ'})`);
  if (msg.stop_reason === 'max_tokens') throw parseError('Claude trả lời bị cắt cụt (max_tokens)');
  return { text: msg.content.filter((b) => b.type === 'text').map((b) => b.text).join(''), model: msg.model || model, cost: res.cost, batch };
}

const aiStats = { calls: 0, failed: 0, reviewsSkipped: 0, reviewsPartial: 0, byModel: {} };

// Gọi + đọc kết quả. Lỗi (JSON hỏng, bị từ chối, mạng…) → thử lại 1 lần GỌI TRỰC TIẾP (không chờ thêm 1 lô nữa).
// parse(text) chuẩn hóa kết quả; ném lỗi nếu không hợp lệ.
async function generate(role, content, parse, label, opts = {}) {
  let lastErr;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      aiStats.calls++;
      const { text: out, model, cost, batch } = await callClaude(role, content, label, { ...opts, forceRealtime: attempt > 1 });
      aiStats.byModel[model] = (aiStats.byModel[model] || 0) + 1;
      const parsed = parse(out.trim());
      console.log(`[AI ${label}] ${model}${batch ? ' (lô −50%)' : ''} $${cost.toFixed(4)}`);
      return { out: parsed, modelName: model };
    } catch (err) {
      if (err.code === 'AI_OFF') throw err;
      lastErr = err;
      aiStats.failed++;
      console.warn(`[AI ${label}] lượt ${attempt} lỗi: ${String(err.message).slice(0, 200)}`);
    }
  }
  throw lastErr;
}

module.exports = {
  CLAUDE_ROLES, claudeReady, claudeConfigured, aiOffError, fileBlock, text, cached, generate, parseError,
  runInBatchScope, batchEnabled, resumeBatches, aiStats, keyInfo, saveApiKey, removeApiKey, storedKey,
  MODEL_OPTIONS, MODEL_GROUPS, chosenModels, saveModels,
};
