// Cấu trúc mục "Đề và chuyên môn": danh sách LỚP (site_settings.exam_grades), danh sách LOẠI ĐỀ (exam_categories)
// và THANH MENU (exam_menu — các mục, mỗi mục gồm 1 hay nhiều lớp; vd "Toán 10" = [10], "Toán THCS" = [6,7,8,9]).
// Admin chỉnh ở trang Đề thi; chưa chỉnh thì tự dựng menu mặc định từ danh sách lớp.

const DEFAULT_GRADES = '6,7,8,9';
const DEFAULT_CATEGORIES = ['Tài liệu', 'Đề cương', 'Đề giữa HK1', 'Đề HK1', 'Đề giữa HK2', 'Đề HK2', 'Đề khảo sát', 'Đề HSG'];

const setting = (db, key) => db.prepare('SELECT value FROM site_settings WHERE key=?').get(key)?.value;
const splitList = (v) => [...new Set(String(v || '').split(',').map((s) => s.trim()).filter(Boolean))];

function examGrades(db) {
  return splitList(setting(db, 'exam_grades') || DEFAULT_GRADES);
}

function examCategories(db) {
  const list = splitList(setting(db, 'exam_categories'));
  return list.length ? list : DEFAULT_CATEGORIES;
}

const gradeName = (g) => (/^\d+$/.test(g) ? `Lớp ${g}` : g);

// Menu mặc định: lớp 1–5 gộp "Tiểu học", 6–9 gộp "THCS", 10/11/12 mỗi lớp 1 mục, các mục chữ (Thi vào 10, HSA...) gộp "Luyện thi".
// Nhóm chỉ có 1 lớp thì dùng luôn tên lớp đó.
function defaultMenu(grades) {
  const groups = [
    { label: 'Tiểu học', grades: grades.filter((g) => /^\d+$/.test(g) && +g <= 5) },
    { label: 'THCS', grades: grades.filter((g) => /^\d+$/.test(g) && +g >= 6 && +g <= 9) },
    ...grades.filter((g) => /^\d+$/.test(g) && +g >= 10).map((g) => ({ label: gradeName(g), grades: [g] })),
    { label: 'Luyện thi', grades: grades.filter((g) => !/^\d+$/.test(g)) },
  ];
  return groups.filter((m) => m.grades.length).map((m) => (m.grades.length === 1 ? { label: gradeName(m.grades[0]), grades: m.grades } : m));
}

// Làm sạch menu admin gửi lên / đọc từ database: chỉ giữ lớp có trong danh sách, mỗi lớp thuộc tối đa 1 mục;
// lớp chưa nằm trong mục nào thì tự thêm thành mục riêng ở cuối (không lớp nào bị "mất" khỏi menu).
function normalizeMenu(raw, grades) {
  const used = new Set();
  const out = [];
  for (const m of Array.isArray(raw) ? raw : []) {
    const gs = (Array.isArray(m?.grades) ? m.grades : []).map(String).filter((g) => grades.includes(g) && !used.has(g));
    if (!gs.length) continue;
    gs.forEach((g) => used.add(g));
    out.push({ label: String(m.label || '').trim().slice(0, 40) || gradeName(gs[0]), grades: gs });
    if (out.length >= 20) break;
  }
  grades.filter((g) => !used.has(g)).forEach((g) => out.push({ label: gradeName(g), grades: [g] }));
  return out;
}

function examMenu(db, grades = examGrades(db)) {
  const raw = setting(db, 'exam_menu');
  if (!raw) return defaultMenu(grades);
  try { return normalizeMenu(JSON.parse(raw), grades); } catch { return defaultMenu(grades); }
}

// Số đề đang hiện theo lớp → loại ('' = chưa phân loại): { "8": { "Đề HK1": 3, "": 1 } }
function examCounts(db, { includeHidden = false } = {}) {
  const rows = db.prepare(`SELECT grade, COALESCE(category,'') category, COUNT(*) n FROM exam_papers ${includeHidden ? '' : 'WHERE active=1'} GROUP BY grade, category`).all();
  const out = {};
  rows.forEach((r) => { const g = r.grade || ''; (out[g] ||= {})[r.category] = r.n; });
  return out;
}

function examMeta(db, opts) {
  const grades = examGrades(db);
  return { grades, categories: examCategories(db), menu: examMenu(db, grades), counts: examCounts(db, opts) };
}

module.exports = { examGrades, examCategories, examMenu, examMeta, normalizeMenu, DEFAULT_CATEGORIES };
