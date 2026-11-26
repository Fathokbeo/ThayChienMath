// Hiển thị PDF thuần bằng pdf.js (canvas) — KHÔNG dùng trình xem PDF gốc của trình duyệt (mỗi trình duyệt
// một kiểu thanh công cụ riêng, không tắt được và không đồng bộ được với nút phóng to/nhỏ của web).
// Mức phóng to (zoom, prop ngoài truyền vào) là HỆ SỐ nhân lên trên mức "vừa khít chiều rộng khung" —
// tự tính lại khi khung đổi kích thước (vd học sinh kéo thanh chia đề/bài làm), nên zoom luôn có ý nghĩa
// tương đối, không lệch khi đổi cỡ khung.
// Thu nhỏ tới TWO_UP_ZOOM (đề nhiều trang): xếp 2 trang cạnh nhau, mỗi trang vừa nửa khung.
//
// Thu phóng MƯỢT (không giật, không nhảy về đầu trang):
//  - Đổi zoom → kích thước trang đổi NGAY bằng CSS (ảnh cũ giãn tạm), giữ nguyên điểm đang nhìn (giữa khung /
//    giữa 2 ngón tay); vẽ nét lại sau 150ms khi ngừng thu phóng, vẽ ra canvas phụ rồi chép sang → không nháy trắng.
//  - Trang đang thấy trên màn hình được vẽ nét trước.
//  - Chụm/mở 2 ngón tay (điện thoại) hoặc Ctrl + lăn chuột / chụm trên touchpad (máy tính) để thu phóng ngay trong khung
//    (cần onZoomChange).
//  - Thanh cuộn hiện/ẩn không làm khung tính lại cỡ (bỏ qua thay đổi chiều rộng nhỏ, giữ chỗ cho thanh cuộn).
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { loadPdfjs } from '../lib/pdfjs';

export const TWO_UP_ZOOM = 0.5;
const PAGE_GAP = 14;
const PAD = 16;

interface Props {
  url: string;
  zoom: number;
  onZoomChange?: (zoom: number) => void; // có → bật chụm 2 ngón / Ctrl + lăn chuột để thu phóng
  minZoom?: number;
  maxZoom?: number;
}

type Size = { w: number; h: number };

export default function PdfCanvasViewer({ url, zoom, onZoomChange, minZoom = TWO_UP_ZOOM, maxZoom = 3 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const docRef = useRef<any>(null);
  const renderTasksRef = useRef<Map<number, any>>(new Map());
  const renderedScaleRef = useRef<Map<number, number>>(new Map()); // trang → tỉ lệ đã vẽ nét
  const [sizes, setSizes] = useState<Size[]>([]); // kích thước gốc (scale 1) từng trang
  const [avail, setAvail] = useState(0); // chiều rộng dùng được của khung
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const numPages = sizes.length;
  const twoUp = zoom <= TWO_UP_ZOOM && numPages > 1;
  const baseW = sizes[0]?.w || 600;
  const fitScale = avail ? avail / baseW : 1;
  const spreadScale = avail ? (avail - PAGE_GAP) / 2 / baseW : 0.5;
  const scale = twoUp ? spreadScale : fitScale * zoom;

  // ── Nạp file PDF + kích thước các trang ──
  useEffect(() => {
    let cancelled = false;
    setStatus('loading'); setSizes([]); docRef.current = null; renderedScaleRef.current.clear();
    (async () => {
      try {
        const pdfjs = await loadPdfjs();
        const doc = await pdfjs.getDocument({ url }).promise;
        const list: Size[] = [];
        for (let i = 1; i <= doc.numPages; i++) {
          const vp = (await doc.getPage(i)).getViewport({ scale: 1 });
          list.push({ w: vp.width, h: vp.height });
        }
        if (cancelled) return;
        docRef.current = doc;
        setSizes(list);
        setStatus('ready');
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();
    return () => { cancelled = true; };
  }, [url]);

  // ── Chiều rộng khung (bỏ qua thay đổi < 24px do thanh cuộn hiện/ẩn) ──
  // Đổi cỡ khung (kéo cửa sổ, xoay điện thoại): nhớ ĐIỂM NỘI DUNG đang ở giữa khung (theo khung CŨ) để sau khi
  // vẽ lại cỡ mới vẫn đặt đúng điểm đó vào giữa khung mới — xoay ngang/dọc không bị nhảy sang chỗ khác.
  const scaleRef = useRef(scale); scaleRef.current = scale;
  const availRef = useRef(avail);
  const sizeRef = useRef<{ w: number; h: number } | null>(null);
  const resizeAnchorRef = useRef<{ x: number; y: number } | null>(null); // toạ độ nội dung ở tỉ lệ 1
  const placeResizeAnchor = (el: HTMLDivElement, s: number) => {
    const a = resizeAnchorRef.current;
    if (!a) return;
    el.scrollLeft = a.x * s + PAD - el.clientWidth / 2;
    el.scrollTop = a.y * s + PAD - el.clientHeight / 2;
    resizeAnchorRef.current = null;
  };
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const prev = sizeRef.current;
      const size = { w: el.clientWidth, h: el.clientHeight };
      sizeRef.current = size;
      if (prev && (prev.w !== size.w || prev.h !== size.h) && scaleRef.current) {
        const s = scaleRef.current;
        resizeAnchorRef.current = resizeAnchorRef.current
          || { x: (el.scrollLeft + prev.w / 2 - PAD) / s, y: (el.scrollTop + prev.h / 2 - PAD) / s };
      }
      const w = Math.max(100, size.w - PAD * 2);
      const cur = availRef.current;
      const next = Math.abs(cur - w) < 24 && cur ? cur : w;
      if (next === cur) placeResizeAnchor(el, scaleRef.current); // chỉ đổi chiều cao: tỉ lệ giữ nguyên, đặt lại ngay
      else { availRef.current = next; setAvail(next); }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [status]);

  // ── Giữ nguyên điểm đang nhìn khi đổi tỉ lệ ──
  const anchorRef = useRef<{ x: number; y: number } | null>(null); // toạ độ trong khung (mặc định: giữa khung)
  const prevRef = useRef<{ scale: number; twoUp: boolean } | null>(null);
  useLayoutEffect(() => {
    const el = containerRef.current;
    const prev = prevRef.current;
    prevRef.current = { scale, twoUp };
    if (!el || !prev || prev.scale === scale) return;
    if (resizeAnchorRef.current && prev.twoUp === twoUp) { placeResizeAnchor(el, scale); anchorRef.current = null; return; }
    if (prev.twoUp !== twoUp) { // đổi bố cục 1 ↔ 2 trang: giữ tỉ lệ cuộn dọc
      const ratio = el.scrollHeight ? el.scrollTop / el.scrollHeight : 0;
      requestAnimationFrame(() => { el.scrollTop = ratio * el.scrollHeight; });
      return;
    }
    const a = anchorRef.current || { x: el.clientWidth / 2, y: el.clientHeight / 2 };
    const r = scale / prev.scale;
    const cx = el.scrollLeft + a.x - PAD;
    const cy = el.scrollTop + a.y - PAD;
    el.scrollLeft = cx * r + PAD - a.x;
    el.scrollTop = cy * r + PAD - a.y;
    anchorRef.current = null;
  }, [scale, twoUp]);

  // ── Vẽ nét (sau khi ngừng thu phóng 150ms), trang đang thấy trước, vẽ ra canvas phụ rồi chép sang ──
  useEffect(() => {
    if (status !== 'ready' || !docRef.current || !containerRef.current) return;
    let cancelled = false;
    let running = false; let again = false;
    const tasks = renderTasksRef.current;
    const el = containerRef.current;
    // Chỉ vẽ nét các trang đang thấy (± 1 màn hình) — phóng to lớn mà vẽ cả đề rất tốn bộ nhớ; cuộn tới đâu vẽ tới đó
    const pass = async () => {
      if (running) { again = true; return; }
      running = true;
      const canvases = Array.from(el.querySelectorAll<HTMLCanvasElement>('canvas[data-page]'));
      const view = el.getBoundingClientRect();
      const margin = view.height;
      const near = (c: HTMLCanvasElement) => { const r = c.getBoundingClientRect(); return r.bottom > view.top - margin && r.top < view.bottom + margin; };
      const center = view.top + view.height / 2;
      const order = canvases.filter(near).sort((a, b) => {
        const ra = a.getBoundingClientRect(); const rb = b.getBoundingClientRect();
        return Math.abs((ra.top + ra.bottom) / 2 - center) - Math.abs((rb.top + rb.bottom) / 2 - center);
      });
      const dpr = window.devicePixelRatio || 1;
      for (const canvas of order) {
        if (cancelled) { running = false; return; }
        const i = Number(canvas.dataset.page);
        if (renderedScaleRef.current.get(i) === scale * dpr) continue;
        const page = await docRef.current.getPage(i);
        if (cancelled) { running = false; return; }
        const viewport = page.getViewport({ scale: scale * dpr });
        const off = document.createElement('canvas');
        off.width = Math.ceil(viewport.width); off.height = Math.ceil(viewport.height);
        const octx = off.getContext('2d');
        if (!octx) continue;
        tasks.get(i)?.cancel();
        const task = page.render({ canvasContext: octx, viewport });
        tasks.set(i, task);
        try { await task.promise; } catch (err: any) {
          if (err?.name === 'RenderingCancelledException') { running = false; return; }
          console.warn('[pdf] vẽ trang lỗi', i, err?.message || err);
          continue;
        }
        if (cancelled) { running = false; return; }
        canvas.width = off.width; canvas.height = off.height;
        canvas.getContext('2d')?.drawImage(off, 0, 0);
        renderedScaleRef.current.set(i, scale * dpr);
      }
      running = false;
      if (again && !cancelled) { again = false; pass(); }
    };
    const timer = setTimeout(pass, renderedScaleRef.current.size ? 150 : 0);
    let scrollTimer: ReturnType<typeof setTimeout> | undefined;
    const onScroll = () => { clearTimeout(scrollTimer); scrollTimer = setTimeout(pass, 120); };
    el.addEventListener('scroll', onScroll, { passive: true });
    // Kéo cửa sổ sang màn hình khác độ phân giải / phóng to trình duyệt (Ctrl +) / xoay điện thoại → mật độ điểm ảnh
    // đổi mà tỉ lệ trang không đổi → vẽ nét lại cho khỏi mờ
    window.addEventListener('resize', onScroll);
    return () => {
      cancelled = true;
      clearTimeout(timer); clearTimeout(scrollTimer);
      el.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      tasks.forEach((t) => t.cancel());
      tasks.clear();
    };
  }, [status, numPages, scale]);

  // ── Chụm 2 ngón / Ctrl + lăn chuột để thu phóng ──
  const zoomRef = useRef(zoom); zoomRef.current = zoom;
  const cbRef = useRef(onZoomChange); cbRef.current = onZoomChange;
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !onZoomChange) return;
    const clamp = (z: number) => Math.min(maxZoom, Math.max(minZoom, Math.round(z * 100) / 100));
    const local = (x: number, y: number) => { const r = el.getBoundingClientRect(); return { x: x - r.left, y: y - r.top }; };
    let pinch: { d0: number; z0: number } | null = null;
    let raf = 0;
    const setZoomAt = (z: number, at: { x: number; y: number }) => {
      const next = clamp(z);
      if (next === zoomRef.current) return;
      anchorRef.current = at;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => cbRef.current?.(next));
    };
    const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const onStart = (e: TouchEvent) => { if (e.touches.length === 2) pinch = { d0: dist(e.touches), z0: zoomRef.current }; };
    const onMove = (e: TouchEvent) => {
      if (!pinch || e.touches.length !== 2) return;
      e.preventDefault();
      const mid = local((e.touches[0].clientX + e.touches[1].clientX) / 2, (e.touches[0].clientY + e.touches[1].clientY) / 2);
      setZoomAt(pinch.z0 * (dist(e.touches) / pinch.d0), mid);
    };
    const onEnd = (e: TouchEvent) => { if (e.touches.length < 2) pinch = null; };
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return; // lăn thường = cuộn trang
      e.preventDefault();
      // lăn chuột 1 nấc (~100) ≈ ±20%; chụm touchpad gửi nhiều nấc nhỏ → mượt
      setZoomAt(zoomRef.current * Math.exp(-Math.max(-150, Math.min(150, e.deltaY)) * 0.0018), local(e.clientX, e.clientY));
    };
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('wheel', onWheel);
    };
  }, [status, !!onZoomChange, minZoom, maxZoom]);

  if (status === 'error') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#86868B', fontSize: '0.85rem', flexDirection: 'column', gap: 8 }}>
        <span>Không tải được đề bài.</span>
        <a href={url} target="_blank" rel="noreferrer" style={{ color: '#2F6F82' }}>Mở file trong tab mới</a>
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{
      width: '100%', height: '100%', overflow: 'auto', display: 'flex', gap: PAGE_GAP, padding: PAD,
      scrollbarGutter: 'stable', touchAction: onZoomChange ? 'pan-x pan-y' : undefined, overscrollBehavior: 'contain',
      ...(twoUp
        ? { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'flex-start', alignContent: 'flex-start' }
        : { flexDirection: 'column', alignItems: 'safe center' as any }),
    }}>
      {status === 'loading' && <div style={{ color: '#86868B', fontSize: '0.85rem', margin: 'auto' }}>Đang tải đề bài...</div>}
      {sizes.map((s, k) => (
        <canvas key={k} data-page={k + 1}
          style={{ width: s.w * scale, height: s.h * scale, boxShadow: '0 2px 10px rgba(0,0,0,0.18)', background: 'white', flexShrink: 0 }} />
      ))}
    </div>
  );
}
