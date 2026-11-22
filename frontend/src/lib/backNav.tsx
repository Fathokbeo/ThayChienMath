import { useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

// Nút "Quay lại" thông minh: nhớ các trang đã đi qua TRONG web để quay về ĐÚNG trang vừa xem — vd đang ở Tổng quát
// bấm vào 1 bài tập thì nút là "← Tổng quát" và về lại Tổng quát (giữ nguyên bộ lọc, vị trí cuộn vì dùng lịch sử
// trình duyệt). Mở thẳng từ link / tab mới (không có trang trước) → về trang cha như trước.
//
// Mỗi trang ghi theo VỊ TRÍ của nó trong lịch sử trình duyệt (history.state.idx do react-router đặt) → biết chính xác
// trang ngay trước, kể cả khi bấm nút back/forward của trình duyệt hay tải lại trang. Lưu sessionStorage (theo tab).
const KEY = 'nav_trail_v2';
type Entry = { path: string; label?: string };
type Trail = Record<number, Entry>;

function read(): Trail {
  try { const v = JSON.parse(sessionStorage.getItem(KEY) || '{}'); return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; } catch { return {}; }
}
function write(v: Trail) {
  try { sessionStorage.setItem(KEY, JSON.stringify(v)); } catch { /* bị chặn lưu trữ */ }
}
const currentIdx = () => ((window.history.state as { idx?: number } | null)?.idx ?? 0);

// Tên mặc định của trang theo đường dẫn (trang chi tiết tự đặt tên cụ thể bằng useBackLabel)
const LABELS: [RegExp, string][] = [
  [/^\/teacher\/?$/, 'Tổng quát'], [/^\/teacher\/homework\/?$/, 'Bài tập'], [/^\/teacher\/homework\/\d+/, 'Bài tập'],
  [/^\/teacher\/courses\/?$/, 'Khóa học'], [/^\/teacher\/courses\/\d+/, 'Khóa học'], [/^\/teacher\/classes\/\d+/, 'Lớp học'],
  [/^\/teacher\/students/, 'Học sinh'],
  [/^\/admin\/?$/, 'Tổng quan'], [/^\/admin\/courses\/?$/, 'Khóa học'], [/^\/admin\/courses\/\d+/, 'Khóa học'], [/^\/admin\/classes/, 'Lớp học'],
  [/^\/admin\/users/, 'Tài khoản'], [/^\/admin\/registrations/, 'Đăng ký học'], [/^\/admin\/exams/, 'Đề thi'], [/^\/admin\/content/, 'Nội dung trang'],
  [/^\/admin\/news/, 'Bài tin'], [/^\/admin\/ads/, 'Quảng cáo'],
  [/^\/student\/?$/, 'Tổng quan'], [/^\/student\/classes\/?$/, 'Lớp học của tôi'], [/^\/student\/classes\/\d+/, 'Lớp học'], [/^\/student\/courses\/\d+/, 'Khóa học'],
  [/^\/parent\/?$/, 'Tổng quan'], [/^\/parent\/thong-bao/, 'Thông báo'], [/^\/parent\//, 'Lớp học'],
  [/^\/guest/, 'Tài khoản'],
  [/^\/$/, 'Trang chủ'], [/^\/de-thi\/?$/, 'Đề thi'], [/^\/de-thi\/\d+/, 'Đề thi'], [/^\/tin-tuc\/?$/, 'Tin tức'], [/^\/tin-tuc\/\d+/, 'Tin tức'],
  [/^\/courses\/\d+/, 'Khóa học'],
];
export const defaultLabel = (path: string) => LABELS.find(([re]) => re.test(path.split('?')[0]))?.[1] || 'Quay lại';

// Gắn 1 lần trong Router: ghi trang hiện tại vào đúng vị trí lịch sử; đi tới trang mới thì bỏ các trang "phía trước"
// cũ (giống trình duyệt). Chỉ đổi ?bộ lọc (thay thế) → cập nhật đường dẫn, giữ tên.
export function NavTracker() {
  const loc = useLocation();
  useEffect(() => {
    const idx = currentIdx();
    const trail = read();
    const path = loc.pathname + loc.search;
    const old = trail[idx];
    const samePage = old && old.path.split('?')[0] === loc.pathname;
    // Trang mới ở vị trí này (không phải quay lại / tải lại cùng trang) → các trang "phía trước" cũ không còn
    if (!samePage) for (const k of Object.keys(trail)) if (+k > idx) delete trail[+k];
    trail[idx] = { path, label: samePage ? old.label : undefined };
    for (const k of Object.keys(trail)) if (+k < idx - 30) delete trail[+k];
    write(trail);
  }, [loc.key, loc.pathname, loc.search]);
  return null;
}

// Trang chi tiết đặt tên cụ thể cho chính nó (vd "Lớp 9A", tên bài tập) → nút quay lại ở trang sau hiện đúng tên đó
export function useBackLabel(label?: string | null) {
  const loc = useLocation();
  useEffect(() => {
    if (!label) return;
    const idx = currentIdx();
    const trail = read();
    const e = trail[idx];
    if (e && e.path.split('?')[0] === loc.pathname) { e.label = label; write(trail); }
    else { trail[idx] = { path: loc.pathname + loc.search, label }; write(trail); }
  }, [label, loc.pathname]);
}

type Props = { fallback: string; fallbackLabel?: string; variant?: 'link' | 'button'; style?: React.CSSProperties };

export function BackButton({ fallback, fallbackLabel, variant = 'link', style }: Props) {
  useLocation(); // vẽ lại khi đổi trang
  const navigate = useNavigate();
  const idx = currentIdx();
  const prev = idx > 0 ? read()[idx - 1] || null : null; // tab mới mở từ link: idx = 0 → không có trang trước
  const label = prev ? (prev.label || defaultLabel(prev.path)) : (fallbackLabel || defaultLabel(fallback));
  const cls = variant === 'button' ? 'btn btn-ghost btn-sm back-btn' : 'link back-btn';
  const content = <><ChevronLeft size={16} /><span className="back-btn-label">{label}</span></>;
  const base: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 2, ...style };
  if (prev) {
    return <button type="button" className={cls} style={{ ...base, border: 0, background: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: variant === 'button' ? undefined : 0 }}
      title={`Quay lại ${label}`} aria-label={`Quay lại ${label}`} onClick={() => navigate(-1)}>{content}</button>;
  }
  return <Link to={fallback} className={cls} style={base} title={`Quay lại ${label}`} aria-label={`Quay lại ${label}`}>{content}</Link>;
}
