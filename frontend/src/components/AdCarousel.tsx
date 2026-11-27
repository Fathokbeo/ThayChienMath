import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { fileUrl } from '../lib/api';
import useIsMobile from '../lib/useIsMobile';

interface Ad {
  id: number;
  image_path: string;
  title?: string;
  link?: string;
}

interface Props {
  ads: Ad[];
  fallback?: ReactNode; // chưa có ảnh quảng cáo nào → hiện khung này (cùng kích thước)
}

// Khung ảnh quảng cáo đầu trang chủ: ảnh rộng bo góc, tự chuyển 5 giây/ảnh (dừng khi rê chuột),
// nút trái/phải, chấm chọn ảnh, vuốt ngang trên điện thoại. Khung luôn tỉ lệ 3:1 (điện thoại cũng vậy — không cắt chữ trong ảnh) — ảnh nên 1920×640.
export default function AdCarousel({ ads, fallback }: Props) {
  const isMobile = useIsMobile();
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchX = useRef<number | null>(null);

  const next = useCallback(() => setCurrent((c) => (c + 1) % ads.length), [ads.length]);
  const prev = () => setCurrent((c) => (c - 1 + ads.length) % ads.length);

  useEffect(() => {
    if (ads.length <= 1 || paused) return;
    const timer = setInterval(next, 5000);
    return () => clearInterval(timer);
  }, [ads.length, next, paused]);

  useEffect(() => { if (current >= ads.length) setCurrent(0); }, [ads.length, current]);

  const frame = { position: 'relative' as const, overflow: 'hidden', borderRadius: isMobile ? 14 : 20, aspectRatio: '3 / 1', background: '#E8EEF0' };

  if (!ads.length) return fallback ? <div style={frame}>{fallback}</div> : null;

  const arrow = (side: 'left' | 'right') => (
    <button type="button" aria-label={side === 'left' ? 'Ảnh trước' : 'Ảnh sau'}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (side === 'left') prev(); else next(); }}
      style={{
        position: 'absolute', [side]: isMobile ? 8 : 16, top: '50%', transform: 'translateY(-50%)', zIndex: 2,
        background: 'rgba(255,255,255,0.92)', border: 'none', borderRadius: '50%',
        width: isMobile ? 32 : 42, height: isMobile ? 32 : 42, display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', boxShadow: '0 2px 10px rgba(0,0,0,0.18)', color: '#1D1D1F',
      }}>
      {side === 'left' ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
    </button>
  );

  // Mỗi ảnh một lớp chồng lên nhau, ảnh đang chọn hiện rõ dần (không giật khi đổi ảnh)
  const slide = (ad: Ad, i: number) => {
    const body = (
      <>
        <img src={fileUrl(`/uploads/ads/${ad.image_path}`)} alt={ad.title || 'Quảng cáo'} loading={i === 0 ? 'eager' : 'lazy'}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        {/* Không đè tiêu đề lên ảnh: ảnh quảng cáo thường đã có chữ, đè thêm sẽ rối — tiêu đề dùng làm chữ thay thế (alt) */}
      </>
    );
    const style = { position: 'absolute' as const, inset: 0, opacity: i === current ? 1 : 0, transition: 'opacity 0.6s ease', pointerEvents: (i === current ? 'auto' : 'none') as 'auto' | 'none', display: 'block' };
    if (!ad.link) return <div key={ad.id} style={style}>{body}</div>;
    // Link trong web (/khoa-hoc, #de-thi...) mở ngay tại chỗ; link ngoài mở tab mới
    return ad.link.startsWith('/') || ad.link.startsWith('#')
      ? <Link key={ad.id} to={ad.link} style={style}>{body}</Link>
      : <a key={ad.id} href={ad.link} target="_blank" rel="noopener noreferrer" style={style}>{body}</a>;
  };

  return (
    <div style={frame}
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
      onTouchStart={(e) => { touchX.current = e.touches[0].clientX; setPaused(true); }}
      onTouchEnd={(e) => {
        const start = touchX.current; touchX.current = null; setPaused(false);
        if (start === null || ads.length <= 1) return;
        const dx = e.changedTouches[0].clientX - start;
        if (Math.abs(dx) > 40) { if (dx < 0) next(); else prev(); }
      }}>
      {ads.map(slide)}
      {ads.length > 1 && (
        <>
          {/* Điện thoại: vuốt ngang để đổi ảnh, không cần nút mũi tên che ảnh */}
          {!isMobile && arrow('left')}
          {!isMobile && arrow('right')}
          <div style={{ position: 'absolute', bottom: isMobile ? 6 : 14, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 6, zIndex: 2 }}>
            {ads.map((a, i) => (
              <button key={a.id} type="button" aria-label={`Ảnh ${i + 1}`}
                onClick={(e) => { e.preventDefault(); setCurrent(i); }}
                style={{
                  width: i === current ? (isMobile ? 16 : 22) : (isMobile ? 6 : 8), height: isMobile ? 6 : 8, borderRadius: 99,
                  background: i === current ? 'white' : 'rgba(255,255,255,0.55)',
                  border: 'none', cursor: 'pointer', padding: 0, transition: 'all 0.3s',
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
