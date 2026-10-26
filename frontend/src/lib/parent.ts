import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from './api';

// Dùng chung cho các trang phụ huynh: danh sách con + con đang xem (giữ qua các trang bằng ?con=<id>,
// lần sau mở lại nhớ con đã chọn), nhãn trạng thái bài tập và câu chữ cho thông báo.

export type Child = { id: number; username: string; full_name: string; unread: number };

const CHILD_KEY = 'parent_child';

export function useChildren() {
  const [params, setParams] = useSearchParams();
  const [children, setChildren] = useState<Child[] | null>(null);

  const reload = () => api.get('/parent/children').then((r) => setChildren(r.data)).catch(() => setChildren([]));
  useEffect(() => { reload(); }, []);

  const fromUrl = Number(params.get('con'));
  const saved = (() => { try { return Number(localStorage.getItem(CHILD_KEY)); } catch { return 0; } })();
  const list = children || [];
  const current = list.find((c) => c.id === fromUrl) || list.find((c) => c.id === saved) || list[0] || null;

  const select = (id: number) => {
    try { localStorage.setItem(CHILD_KEY, String(id)); } catch { /* trình duyệt chặn lưu trữ */ }
    const next = new URLSearchParams(params); next.set('con', String(id)); setParams(next, { replace: true });
  };
  return { children, current, select, reload };
}

// Link giữ nguyên con đang xem
export const withChild = (path: string, childId?: number | null) => (childId ? `${path}${path.includes('?') ? '&' : '?'}con=${childId}` : path);

// "12A1" → "Lớp 12A1"; tên đã có chữ "Lớp" thì giữ nguyên (tránh "Lớp Lớp 6")
export const classLabel = (t?: string, lower = false) => {
  const s = (t || '').trim();
  const out = /^lớp/i.test(s) ? s : `Lớp ${s}`;
  return lower ? out.charAt(0).toLowerCase() + out.slice(1) : out;
};

export const fmtScore = (n: number | null | undefined) => (n === null || n === undefined ? '—' : String(n).replace('.', ','));

export const fmtDate = (iso?: string | null, withTime = true) => {
  if (!iso) return '';
  const d = new Date(iso);
  return withTime
    ? d.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })
    : d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
};

export const monthLabel = (ym: string) => { const [y, m] = ym.split('-'); return `Tháng ${Number(m)}/${y}`; };

// Trạng thái 1 bài tập của con: chữ + màu (luôn kèm chữ, không chỉ dùng màu)
export const STATUS: Record<string, { label: string; color: string; bg: string }> = {
  graded: { label: 'Đã có điểm', color: '#3A7D5C', bg: '#E8F3EC' },
  grading: { label: 'Đang chấm', color: '#2F6F82', bg: '#E7F1F4' },
  waiting: { label: 'Đã nộp, chờ chấm', color: '#2F6F82', bg: '#E7F1F4' },
  missed: { label: 'Không nộp — 0 điểm', color: '#B04A2A', bg: '#FBEAE4' },
  todo: { label: 'Chưa nộp', color: '#B8673E', bg: '#FCF0E8' },
};

export type Activity = {
  type: 'assigned' | 'submitted' | 'graded' | 'missed';
  at: string; title: string; class_id: number; class_title: string; homework_id: number;
  score?: number; max_score?: number; score10?: number; submit_count?: number; due_date?: string | null; is_new?: boolean; by_teacher?: boolean;
};

// Câu thông báo cho phụ huynh, xưng "con"
export function activityText(e: Activity): string {
  if (e.type === 'submitted' && e.by_teacher) return 'Thầy cô đã thu bài trên lớp và nộp hộ con';
  if (e.type === 'submitted') return e.submit_count && e.submit_count > 1 ? `Con đã nộp lại bài (lần ${e.submit_count})` : 'Con đã nộp bài';
  if (e.type === 'graded') return `Bài đã có điểm: ${fmtScore(e.score)}/${e.max_score}`;
  if (e.type === 'missed') return 'Con không nộp bài đúng hạn — bị tính 0 điểm';
  return `Thầy cô giao bài mới${e.due_date ? ` · hạn ${fmtDate(e.due_date)}` : ''}`;
}
