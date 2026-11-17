// Gợi ý khóa học cho khách (chưa đăng nhập / tài khoản khách) — KHÔNG gọi AI, không cần dữ liệu cá nhân:
// ghi lại khách quan tâm đề lớp nào / loại đề nào qua các "tín hiệu" có trọng số, mờ dần theo thời gian, rồi gửi
// bảng tổng hợp lên máy chủ để xếp các khóa học hợp nhất lên đầu mục Khóa học (xem backend services/courseTags.js).
//
//  Tín hiệu (trọng số): xem 1 đề (1) · đọc đề ≥ 45 giây (+1) · tải đề về (+2) · lọc kho đề theo lớp (0,3) ·
//  xem trang 1 khóa học (khóa đó được ưu tiên nhẹ). Mỗi tín hiệu giảm một nửa sau 21 ngày → khách đổi lớp / đổi
//  mục tiêu (vd lên lớp 10, chuyển sang luyện thi) thì gợi ý tự đổi theo.
//  - Chưa đăng nhập: chỉ lưu trên trình duyệt này (localStorage), không gửi đi đâu ngoài bảng tổng hợp khi tải trang.
//  - Tài khoản khách: đồng bộ thêm lên máy chủ → đăng nhập máy khác / điện thoại vẫn được gợi ý đúng.
import api from './api';

const KEY = 'exam_interest_v2';
const OLD_KEY = 'exam_interest';
const HALF_LIFE_MS = 21 * 24 * 3600e3;
const MAX_EVENTS = 80;

type Ev = { g: string; c?: string; w: number; t: number };
type Store = { ev: Ev[]; courses: Record<string, { w: number; t: number }> };

const clean = (s?: string | null) => String(s || '').replace(/[,:|]/g, ' ').trim().slice(0, 40);
const decay = (t: number, now = Date.now()) => Math.pow(0.5, Math.max(0, now - t) / HALF_LIFE_MS);

function read(): Store {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (v && Array.isArray(v.ev)) return { ev: v.ev, courses: v.courses || {} };
    // Bản cũ chỉ đếm số lần xem theo lớp → đổi sang tín hiệu (coi như xem cách đây 1 tuần)
    const old = JSON.parse(localStorage.getItem(OLD_KEY) || 'null');
    if (old && old.grades) {
      const t = Date.now() - 7 * 24 * 3600e3;
      return { ev: Object.entries(old.grades as Record<string, number>).map(([g, n]) => ({ g: clean(g), w: Math.min(+n || 0, 20), t })), courses: {} };
    }
  } catch { /* bị chặn lưu trữ */ }
  return { ev: [], courses: {} };
}

let syncToServer = false;
let pushTimer: ReturnType<typeof setTimeout> | undefined;

function write(v: Store) {
  // Giữ các tín hiệu còn "nặng" nhất (gần đây / quan trọng), bỏ bớt cái đã mờ
  const now = Date.now();
  v.ev = v.ev.filter((e) => e.g && e.w * decay(e.t, now) > 0.02)
    .sort((a, b) => b.t - a.t).slice(0, MAX_EVENTS);
  for (const [id, x] of Object.entries(v.courses)) if (x.w * decay(x.t, now) < 0.05) delete v.courses[id];
  try { localStorage.setItem(KEY, JSON.stringify(v)); localStorage.removeItem(OLD_KEY); } catch { /* bị chặn lưu trữ */ }
  if (syncToServer) {
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => { api.put('/public/my-interest', v).catch(() => {}); }, 2500);
  }
}

function add(grade: string | null | undefined, category: string | null | undefined, w: number, dedupeMs = 0) {
  const g = clean(grade);
  if (!g) return;
  const c = clean(category) || undefined;
  const v = read();
  const now = Date.now();
  // Cùng lớp + loại vừa ghi cách đây chưa lâu (vd bấm qua lại bộ lọc) → không cộng dồn
  if (dedupeMs && v.ev.some((e) => e.g === g && e.c === c && e.w === w && now - e.t < dedupeMs)) return;
  v.ev.push({ g, c, w, t: now });
  write(v);
}

export const recordExamView = (grade?: string | null, category?: string | null) => add(grade, category, 1, 60e3);
export const recordExamDwell = (grade?: string | null, category?: string | null) => add(grade, category, 1, 10 * 60e3);
export const recordExamDownload = (grade?: string | null, category?: string | null) => add(grade, category, 2, 60e3);
export const recordGradeBrowse = (grade?: string | null, category?: string | null) => add(grade, category, 0.3, 10 * 60e3);

export function recordCourseView(courseId: number | string) {
  const id = String(parseInt(String(courseId), 10) || '');
  if (!id) return;
  const v = read();
  const now = Date.now();
  const cur = v.courses[id];
  v.courses[id] = { w: Math.min(5, (cur ? cur.w * decay(cur.t, now) : 0) + 1), t: now };
  write(v);
}

// Bảng tổng hợp gửi lên máy chủ: "lớp|loại:trọng số" của 10 cặp nặng nhất + các khóa đã xem
//   vd { interest: "10|Đề HK1:3.4,10|:1.2,9|Đề HSG:0.6", courses: "12:1.8,5:0.9" }
export function interestParam(): { interest?: string; courses?: string } {
  const v = read();
  const now = Date.now();
  const sum = new Map<string, number>();
  for (const e of v.ev) {
    const k = `${e.g}|${e.c || ''}`;
    sum.set(k, (sum.get(k) || 0) + e.w * decay(e.t, now));
  }
  const pairs = [...sum.entries()].filter(([, w]) => w >= 0.05).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const courses = Object.entries(v.courses).map(([id, x]) => [id, x.w * decay(x.t, now)] as const)
    .filter(([, w]) => w >= 0.05).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const out: { interest?: string; courses?: string } = {};
  if (pairs.length) out.interest = pairs.map(([k, w]) => `${k}:${w.toFixed(2)}`).join(',');
  if (courses.length) out.courses = courses.map(([id, w]) => `${id}:${w.toFixed(2)}`).join(',');
  return out;
}

// Tài khoản khách: gộp tín hiệu đã lưu trên máy chủ (từ máy khác) với máy này rồi bật đồng bộ. Gọi 1 lần / phiên.
let syncing: Promise<void> | null = null;
export function syncGuestInterest(isGuest: boolean): Promise<void> {
  if (!isGuest) { syncToServer = false; return Promise.resolve(); }
  if (syncing) return syncing;
  syncing = api.get('/public/my-interest').then((r) => {
    const server = r.data as Partial<Store> | null;
    const local = read();
    const seen = new Set(local.ev.map((e) => `${e.g}|${e.c || ''}|${e.t}`));
    for (const e of Array.isArray(server?.ev) ? server!.ev : []) {
      if (e && e.g && !seen.has(`${e.g}|${e.c || ''}|${e.t}`)) local.ev.push({ g: clean(e.g), c: clean(e.c) || undefined, w: +e.w || 0, t: +e.t || 0 });
    }
    for (const [id, x] of Object.entries(server?.courses || {})) {
      const cur = local.courses[id];
      if (!cur || (x && x.t > cur.t)) local.courses[id] = { w: +x.w || 0, t: +x.t || 0 };
    }
    syncToServer = true;
    write(local); // lưu bản gộp ở máy này + đẩy lại lên máy chủ
  }).catch(() => { syncToServer = true; });
  return syncing;
}
