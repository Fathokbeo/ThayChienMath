// Nhớ khách hay xem đề lớp nào / loại nào (lưu ngay trên máy khách, không gửi đi đâu) để xếp khóa học hợp nhất
// lên đầu ở trang chủ — không cần tài khoản, không gọi AI.
const KEY = 'exam_interest';
type Interest = { grades: Record<string, number>; categories: Record<string, number> };

function read(): Interest {
  try { const v = JSON.parse(localStorage.getItem(KEY) || 'null'); if (v && v.grades) return v; } catch { /* bị chặn lưu trữ */ }
  return { grades: {}, categories: {} };
}

export function recordExamView(grade?: string | null, category?: string | null) {
  if (!grade) return;
  const v = read();
  v.grades[grade] = (v.grades[grade] || 0) + 1;
  if (category) v.categories[category] = (v.categories[category] || 0) + 1;
  try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* bị chặn lưu trữ */ }
}

const top = (m: Record<string, number>) => Object.entries(m).sort((a, b) => b[1] - a[1])[0]?.[0];

// Tất cả các lớp đã xem kèm số lần, nhiều nhất trước: "10:6,8:2,Thi vào 10:2" (gửi lên ?interest= để xếp khóa học)
export function interestParam(): { interest?: string; category?: string } {
  const v = read();
  const grades = Object.entries(v.grades).sort((a, b) => b[1] - a[1]).slice(0, 8);
  if (!grades.length) return {};
  return { interest: grades.map(([g, n]) => `${g.replace(/[,:]/g, ' ')}:${n}`).join(','), category: top(v.categories) };
}
