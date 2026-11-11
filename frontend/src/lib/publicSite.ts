import { useEffect, useState } from 'react';
import api from './api';
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

// Đường dẫn trang đề theo lớp / loại đề: /de-thi?lop=8&loai=Đề HK1
export const examHref = (grade?: string, category?: string) => {
  const p = new URLSearchParams();
  if (grade) p.set('lop', grade);
  if (category) p.set('loai', category);
  const s = p.toString();
  return s ? `/de-thi?${s}` : '/de-thi';
};

// Tên + dòng mô tả các mục trang chủ — admin đổi ở Nội dung trang → Liên hệ & Trang chủ → "Tên các mục trang chủ"
export const HOME_TITLE_DEFAULTS = {
  exams: 'Đề và chuyên môn', examsSub: 'Đề kiểm tra, đề khảo sát, đề thi chọn lọc theo từng khối lớp',
  news: 'Tin tức', newsSub: 'Thông báo, lịch khai giảng, thành tích và hoạt động của trung tâm',
  courses: 'Các khóa học', coursesSub: 'Chọn khóa học phù hợp và đăng ký thi thử đầu vào',
};
export type HomeTitles = typeof HOME_TITLE_DEFAULTS;

export function homeTitlesFrom(s: Record<string, string | undefined> | null | undefined): HomeTitles {
  const v = (k: string, d: string) => (s?.[k] || '').trim() || d;
  const D = HOME_TITLE_DEFAULTS;
  return {
    exams: v('home_exams_title', D.exams), examsSub: v('home_exams_subtitle', D.examsSub),
    news: v('home_news_title', D.news), newsSub: v('home_news_subtitle', D.newsSub),
    courses: v('home_courses_title', D.courses), coursesSub: v('home_courses_subtitle', D.coursesSub),
  };
}

let titlesCache: HomeTitles | null = null;
let titlesPending: Promise<HomeTitles> | null = null;
// Dùng ở các trang ngoài trang chủ (trang Đề, menu): tải cài đặt 1 lần, dùng chung
export function useHomeTitles(): HomeTitles {
  const [t, setT] = useState<HomeTitles>(titlesCache || HOME_TITLE_DEFAULTS);
  useEffect(() => {
    if (titlesCache) { setT(titlesCache); return; }
    titlesPending ||= api.get('/public/settings').then((r) => (titlesCache = homeTitlesFrom(r.data))).catch(() => HOME_TITLE_DEFAULTS);
    titlesPending.then(setT);
  }, []);
  return t;
}
