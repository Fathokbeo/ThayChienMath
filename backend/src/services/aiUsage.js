// Ghi chi phí mỗi lượt gọi Claude (theo token thực tế API trả về) + trần ngân sách theo tháng.
// Chạm trần → aiGrading tự chuyển sang Gemini (miễn phí) tới hết tháng. Trần mặc định 190 USD (đặt
// AI_MONTHLY_BUDGET_USD trong .env, hoặc admin sửa ở trang Tổng quan → lưu site_settings.ai_monthly_budget).
const { getDb } = require('../db/database');

// Giá USD / 1 triệu token: [vào, ra]. Đọc cache = 10% giá vào; ghi cache (5 phút) = 125% giá vào.
// Model lạ (vd model dự phòng phía máy chủ Anthropic) → tính theo giá Opus cho an toàn (không đếm thiếu).
const PRICES = {
  'claude-opus-5-5': [4, 20],
  'claude-sonnet-5-5': [2, 10],
  'claude-haiku-5-5': [0.10, 0.50],
  'claude-sonnet-5': [2, 10],
  'claude-opus-5': [5, 25],
  'claude-opus-4-8': [5, 25],
};
const FALLBACK_PRICE = [5, 25];

function costOf(model, usage = {}) {
  const [pin, pout] = PRICES[model] || FALLBACK_PRICE;
  const inTok = usage.input_tokens || 0;
  const cacheRead = usage.cache_read_input_tokens || 0;
  const cacheWrite = usage.cache_creation_input_tokens || 0;
  const outTok = usage.output_tokens || 0;
  return (inTok * pin + cacheRead * pin * 0.1 + cacheWrite * pin * 1.25 + outTok * pout) / 1e6;
}

// Tháng theo giờ Việt Nam (UTC+7), dạng YYYY-MM
const vnMonth = (d = new Date()) => new Date(d.getTime() + 7 * 3600e3).toISOString().slice(0, 7);

function recordUsage({ model, label, usage }) {
  const cost = costOf(model, usage);
  try {
    getDb().prepare(`INSERT INTO ai_usage (month,provider,model,label,input_tokens,output_tokens,cache_read_tokens,cache_write_tokens,cost_usd)
      VALUES (?,?,?,?,?,?,?,?,?)`).run(vnMonth(), 'anthropic', model, label || null,
      usage.input_tokens || 0, usage.output_tokens || 0, usage.cache_read_input_tokens || 0, usage.cache_creation_input_tokens || 0, cost);
  } catch (err) {
    console.error('[ai-usage] không ghi được chi phí:', err.message);
  }
  return cost;
}

function monthlyBudget() {
  const row = getDb().prepare("SELECT value FROM site_settings WHERE key='ai_monthly_budget'").get();
  const v = parseFloat(row?.value ?? process.env.AI_MONTHLY_BUDGET_USD ?? '190');
  return Number.isFinite(v) && v >= 0 ? v : 190;
}

function monthCost(month = vnMonth()) {
  return getDb().prepare('SELECT COALESCE(SUM(cost_usd),0) c FROM ai_usage WHERE month=?').get(month).c;
}

const underBudget = () => monthCost() < monthlyBudget();

// Báo cáo cho trang admin: chi phí tháng này theo model + số lượt
function usageReport(month = vnMonth()) {
  const db = getDb();
  const byModel = db.prepare(`SELECT model, COUNT(*) calls, SUM(cost_usd) cost, SUM(input_tokens+cache_read_tokens+cache_write_tokens) input_tokens, SUM(output_tokens) output_tokens
    FROM ai_usage WHERE month=? GROUP BY model ORDER BY cost DESC`).all(month);
  const gradedSubs = db.prepare(`SELECT COUNT(*) n FROM submissions WHERE graded_by_ai=1 AND graded_at IS NOT NULL AND strftime('%Y-%m', graded_at, '+7 hours')=?`).get(month).n;
  const cost = monthCost(month);
  return { month, cost, budget: monthlyBudget(), byModel, graded_submissions: gradedSubs };
}

module.exports = { recordUsage, monthlyBudget, monthCost, underBudget, usageReport, costOf, vnMonth };
