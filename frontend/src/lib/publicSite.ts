// Định dạng dùng chung cho phần tuyển sinh & đề thi của trang công khai.

export type PlacementSlot = { id: number; start_at: string; location?: string | null; note?: string | null; capacity?: number | null; remaining?: number | null };

const WEEKDAY = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

// "Thứ 7, 02/11/2026 · 08:00"
export function fmtSlotTime(iso: string) {
  const d = new Date(iso);
  const date = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  return `${WEEKDAY[d.getDay()]}, ${date} · ${time}`;
}

// "Thứ 7, 02/11/2026 · 08:00 · Cơ sở 1 — còn 3 chỗ"
export function fmtSlot(s: PlacementSlot) {
  const parts = [fmtSlotTime(s.start_at)];
  if (s.location) parts.push(s.location);
  const seats = s.remaining == null ? '' : s.remaining === 0 ? ' — hết chỗ' : ` — còn ${s.remaining} chỗ`;
  return parts.join(' · ') + seats;
}

// Ngày đăng đề: "29/10/2026" (published_at dạng YYYY-MM-DD, hoặc created_at)
export function fmtDay(v?: string | null) {
  if (!v) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : v;
}

// "8" → "Lớp 8"; nhãn khác (vd "Thi vào 10") giữ nguyên
export const gradeLabel = (g?: string | null) => (!g ? '' : /^\d+$/.test(g) ? `Lớp ${g}` : g);
