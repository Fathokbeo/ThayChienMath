// Gợi ý khóa học theo đề khách đang xem — tốn rất ít token:
//  1. Mỗi khóa học chỉ gọi AI MỘT LẦN (khi tạo / đổi tên / đổi mô tả): đọc tên + mô tả → lưu nhãn
//     { grades: lớp học sinh đang học phù hợp, goals: mục tiêu }. AI lỗi → nhãn theo quy tắc (không cần AI).
//  2. Khi khách xem đề: KHÔNG gọi AI — chấm điểm phù hợp giữa (lớp, loại) của đề với nhãn đã lưu (scoreCourse).
const { getDb } = require('../db/database');

const GOALS = ['co-ban', 'nang-cao', 'hsg', 'thi-vao-6', 'thi-vao-10', 'thi-thpt', 'hsa', 'on-he', 'mat-goc'];

const norm = (s) => String(s || '').toLowerCase().normalize('NFC');
const tagSource = (c) => `${String(c.title || '').trim()}|${String(c.description || '').trim()}`;

// Quy tắc dự phòng khi AI không chạy được: số sau chữ "lớp"; "vào lớp N" → học sinh lớp N-1
function ruleTags(c) {
  const t = norm(`${c.title} ${c.description || ''}`);
  const grades = new Set(); const goals = new Set();
  for (const m of t.matchAll(/vào\s+lớp\s*(\d{1,2})/g)) { const n = +m[1]; if (n >= 2) grades.add(String(n - 1)); goals.add(n === 6 ? 'thi-vao-6' : n === 10 ? 'thi-vao-10' : 'nang-cao'); }
  for (const m of t.matchAll(/(?:lớp|toán)\s*(\d{1,2})(?!\d)/g)) if (!/vào\s+$/.test(t.slice(0, m.index))) grades.add(String(+m[1]));
  if (/thi vào (lớp )?10|vào 10/.test(t)) { grades.add('9'); goals.add('thi-vao-10'); }
  if (/thpt|tốt nghiệp|đại học/.test(t)) { grades.add('12'); goals.add('thi-thpt'); }
  if (/hsa|đánh giá năng lực/.test(t)) { grades.add('12'); goals.add('hsa'); }
  if (/nâng cao|chất lượng cao|chuyên/.test(t)) goals.add('nang-cao');
  if (/cơ bản/.test(t)) goals.add('co-ban');
  if (/hsg|học sinh giỏi/.test(t)) goals.add('hsg');
  if (/hè/.test(t)) goals.add('on-he');
  if (/mất gốc|lấy lại gốc/.test(t)) goals.add('mat-goc');
  return { grades: [...grades].filter((g) => +g >= 1 && +g <= 12), goals: [...goals], source: 'rule' };
}

async function aiTags(c) {
  const { generateSmallJson } = require('./aiGrading');
  const prompt = `Khóa học Toán của một trung tâm dạy thêm.
Tên khóa: "${String(c.title || '').slice(0, 200)}"
Mô tả: "${String(c.description || '').slice(0, 600)}"
Xác định:
- "grades": học sinh ĐANG HỌC lớp nào nên học khóa này (mảng chuỗi số "1".."12"). Vd "Luyện thi vào lớp 6" → ["5"]; "Ôn thi vào 10" → ["9"]; "Toán 8 nâng cao" → ["8"].
- "goals": mục tiêu, chọn trong ${JSON.stringify(GOALS)} (có thể nhiều).
Chỉ trả JSON: {"grades": [...], "goals": [...]}`;
  return generateSmallJson('tagging', prompt, (j) => {
    const grades = [...new Set((Array.isArray(j.grades) ? j.grades : []).map((g) => String(parseInt(g, 10))).filter((g) => +g >= 1 && +g <= 12))];
    const goals = [...new Set((Array.isArray(j.goals) ? j.goals : []).filter((g) => GOALS.includes(g)))];
    if (!grades.length && !goals.length) throw Object.assign(new Error('nhãn rỗng'), { isParseError: true });
    return { grades, goals, source: 'ai' };
  }, 'course-tags');
}

// Gắn nhãn cho các khóa chưa có / đã đổi tên-mô tả. Chạy nền, tuần tự (mỗi khóa 1 lượt AI nhỏ).
let running = false;
async function tagPendingCourses() {
  if (running) return;
  running = true;
  try {
    const db = getDb();
    const rows = db.prepare('SELECT id,title,description,ai_tags_for FROM courses WHERE active=1').all()
      .filter((c) => c.ai_tags_for !== tagSource(c));
    for (const c of rows) {
      let tags;
      try { tags = await aiTags(c); } catch (err) { tags = ruleTags(c); console.warn(`[course-tags] khóa ${c.id}: AI lỗi (${err.message}) → nhãn theo quy tắc`); }
      db.prepare('UPDATE courses SET ai_tags=?, ai_tags_for=? WHERE id=?').run(JSON.stringify(tags), tagSource(c), c.id);
      console.log(`[course-tags] "${c.title}" → lớp ${tags.grades.join(',') || '?'} · ${tags.goals.join(',') || '-'} (${tags.source})`);
    }
  } finally { running = false; }
}

// Gọi sau khi tạo / sửa khóa học (đợi 2 giây để gom nhiều lần lưu liên tiếp)
let timer;
function scheduleCourseTagging() {
  clearTimeout(timer);
  timer = setTimeout(() => { tagPendingCourses().catch((e) => console.error('[course-tags]', e.message)); }, 2000);
}

const parseTags = (raw) => { try { const t = JSON.parse(raw || 'null'); return t && Array.isArray(t.grades) ? t : null; } catch { return null; } };

// Lớp + loại của đề → (lớp học sinh, mục tiêu) để so với nhãn khóa học
function examTarget(grade, category) {
  const g = String(grade || '');
  const t = norm(`${g} ${category || ''}`);
  const out = { grade: /^\d+$/.test(g) ? g : null, goals: [] };
  if (/vào 10|vào lớp 10/.test(t)) { out.grade = '9'; out.goals.push('thi-vao-10'); }
  if (/vào 6|vào lớp 6/.test(t)) { out.grade = '5'; out.goals.push('thi-vao-6'); }
  if (/thpt|tốt nghiệp/.test(t)) { out.grade = out.grade || '12'; out.goals.push('thi-thpt'); }
  if (/hsa|đánh giá năng lực/.test(t)) { out.grade = out.grade || '12'; out.goals.push('hsa'); }
  if (/hsg|giỏi/.test(t)) out.goals.push('hsg', 'nang-cao');
  return out;
}

// Điểm phù hợp 1 khóa học với (lớp, loại) — 0 là không liên quan
function scoreCourse(tags, target) {
  if (!tags) return 0;
  // Khóa đã gắn lớp mà không phải lớp của đề (hay lớp trên liền kề) → không liên quan, dù trùng mục tiêu (vd "nâng cao")
  const sameOrNext = (g) => g === target.grade || +g === +target.grade + 1;
  if (target.grade && tags.grades.length && !tags.grades.some(sameOrNext)) return 0;
  let s = 0;
  if (target.grade && tags.grades.includes(target.grade)) s += 10;
  else if (target.grade && tags.grades.includes(String(+target.grade + 1))) s += 2; // khóa của lớp trên liền kề (học trước)
  const goalHits = target.goals.filter((g) => tags.goals.includes(g)).length;
  s += goalHits * 6;
  return s;
}

// Khóa học công khai sắp theo mức phù hợp với (lớp, loại); không có lớp → giữ thứ tự mặc định
function rankCourses(courses, grade, category) {
  if (!grade && !category) return courses.map((c) => ({ ...c, match: 0 }));
  const target = examTarget(grade, category);
  return courses
    .map((c, i) => ({ c, i, s: scoreCourse(parseTags(c.ai_tags), target) }))
    .sort((a, b) => b.s - a.s || (b.c.open_registration - a.c.open_registration) || a.i - b.i)
    .map(({ c, s }) => ({ ...c, match: s }));
}

// Trang chủ: xếp khóa theo TẤT CẢ các lớp khách đã xem, theo số lần xem (vd lớp 10 ×6, lớp 8 ×2, thi vào 10 ×2).
// Lớp xem nhiều chưa có khóa phù hợp thì các lớp xem ít hơn vẫn được ưu tiên. match = điểm cao nhất với 1 lớp đã xem
// (để gắn nhãn "Phù hợp với bạn"); thứ tự theo tổng điểm có trọng số.
function rankCoursesByInterest(courses, interest, category) {
  const items = interest.filter((x) => x.grade && x.weight > 0);
  if (!items.length) return rankCourses(courses, null, category);
  const targets = items.map((x) => ({ w: x.weight, t: examTarget(x.grade, category) }));
  return courses
    .map((c, i) => {
      const tags = parseTags(c.ai_tags);
      const scores = targets.map(({ w, t }) => ({ w, s: scoreCourse(tags, t) }));
      return { c, i, total: scores.reduce((sum, x) => sum + x.w * x.s, 0), best: Math.max(0, ...scores.map((x) => x.s)) };
    })
    .sort((a, b) => b.total - a.total || (b.c.open_registration - a.c.open_registration) || a.i - b.i)
    .map(({ c, best }) => ({ ...c, match: best }));
}

module.exports = { tagPendingCourses, scheduleCourseTagging, rankCourses, rankCoursesByInterest, parseTags, ruleTags, examTarget, scoreCourse };
