import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { Clock, Newspaper, ArrowRight, Play, X } from 'lucide-react';
import { fileUrl } from '../lib/api';
import { fmtDay } from '../lib/publicSite';
import { parseNewsVideo, type NewsVideo } from '../lib/newsVideo';

export type NewsItem = { id: number; title: string; summary?: string | null; image?: string | null; video?: string | null; published_at?: string | null; created_at?: string };

type CoverProps = { post: NewsItem; ratio?: string; radius?: number; iconSize?: number; playMode?: 'inline' | 'modal' };

// Trình phát (tự chạy khi vừa bấm ▶): YouTube / Vimeo nhúng khung, video tải lên dùng trình phát của trình duyệt
function Player({ video, poster, title, style }: { video: NewsVideo; poster?: string; title: string; style: React.CSSProperties }) {
  return video.kind === 'file' ? (
    <video src={video.src} poster={poster} controls autoPlay playsInline style={{ ...style, background: '#000', objectFit: 'contain' }} />
  ) : (
    <iframe src={`${video.embed}${video.embed.includes('?') ? '&' : '?'}autoplay=1`} title={title} style={{ ...style, border: 0, background: '#000' }}
      allow="autoplay; accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowFullScreen />
  );
}

// Khung xem video lớn giữa màn hình (dùng cho tin dạng dòng — ảnh nhỏ quá để phát ngay tại chỗ)
function VideoModal({ video, poster, title, onClose }: { video: NewsVideo; poster?: string; title: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);
  return createPortal(
    <div className="news-video-modal" onClick={onClose} role="dialog" aria-label={title}>
      <div className="news-video-modal-box" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <b style={{ flex: 1, minWidth: 0, color: '#fff', fontSize: '1rem', lineHeight: 1.35 }}>{title}</b>
          <button type="button" className="news-video-close" onClick={onClose} aria-label="Đóng video"><X size={20} /></button>
        </div>
        <Player video={video} poster={poster} title={title} style={{ width: '100%', aspectRatio: '16 / 9', borderRadius: 12, display: 'block' }} />
      </div>
    </div>,
    document.body,
  );
}

// Ảnh đại diện của tin. Tin có video: bấm vào là PHÁT LUÔN (ngay tại chỗ, hoặc khung lớn với tin dạng dòng) —
// không chuyển sang trang bài; bấm tiêu đề mới mở bài. Tin không có video: bấm ảnh mở bài như cũ.
function Cover({ post, ratio = '16 / 9', radius = 14, iconSize = 36, playMode = 'inline' }: CoverProps) {
  const video = parseNewsVideo(post.video);
  const [playing, setPlaying] = useState(false);
  const style: React.CSSProperties = { aspectRatio: ratio, borderRadius: radius };
  const poster = post.image ? fileUrl(`/uploads/news/${post.image}`) : undefined;
  const thumb = poster ? (
    <img src={poster} alt="" loading="lazy" className="news-cover" style={style} />
  ) : video?.thumb ? (
    <img src={video.thumb} alt="" loading="lazy" className="news-cover" style={style} />
  ) : video?.kind === 'file' ? (
    <video src={`${video.src}#t=0.5`} muted playsInline preload="metadata" className="news-cover" style={style} />
  ) : (
    <div className="news-cover news-cover-empty" style={style}><Newspaper size={iconSize} /></div>
  );

  if (!video) return <Link to={`/tin-tuc/${post.id}`} tabIndex={-1} aria-hidden style={{ display: 'block' }}>{thumb}</Link>;
  if (playing && playMode === 'inline') {
    return <Player video={video} poster={poster} title={post.title} style={{ ...style, width: '100%', display: 'block', height: 'auto' }} />;
  }
  return (
    <>
      <button type="button" className="news-cover-play" aria-label={`Xem video: ${post.title}`}
        onClick={() => { document.querySelectorAll('video').forEach((v) => v.pause()); setPlaying(true); }}>
        {thumb}
        <span className="news-play" style={{ width: iconSize + 16, height: iconSize + 16 }}><Play size={Math.max(14, iconSize * 0.55)} fill="currentColor" /></span>
      </button>
      {playing && playMode === 'modal' && <VideoModal video={video} poster={poster} title={post.title} onClose={() => setPlaying(false)} />}
    </>
  );
}

const DateLine = ({ post }: { post: NewsItem }) => (
  <span className="news-date"><Clock size={13} /> {fmtDay(post.published_at || post.created_at)}</span>
);

// Bài nổi bật (bài mới nhất) — giống trang nhất báo điện tử: ảnh lớn + tiêu đề to + tóm tắt.
// stacked: ảnh trên, chữ dưới (khi bên cạnh có cột tin / điện thoại); không thì ảnh trái, chữ phải.
export function NewsFeatured({ post, isMobile, stacked }: { post: NewsItem; isMobile: boolean; stacked?: boolean }) {
  return (
    <div className="news-featured" style={{ gridTemplateColumns: isMobile || stacked ? '1fr' : 'minmax(0, 1.35fr) minmax(0, 1fr)' }}>
      <Cover post={post} ratio="16 / 10" radius={16} iconSize={48} />
      <Link to={`/tin-tuc/${post.id}`} className="news-text" style={{ display: 'flex', flexDirection: 'column', gap: 10, justifyContent: 'center' }}>
        <span className="news-kicker">Tin mới</span>
        <h3 className="news-title" style={{ fontSize: isMobile ? '1.3rem' : '1.7rem' }}>{post.title}</h3>
        {post.summary && <p className="news-summary clamp-4">{post.summary}</p>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <DateLine post={post} />
          <span className="news-more">Đọc tiếp <ArrowRight size={15} /></span>
        </div>
      </Link>
    </div>
  );
}

// Tin dạng dòng: ảnh nhỏ bên trái, tiêu đề + ngày bên phải (cột tin bên cạnh bài nổi bật). Có video → bấm ảnh mở khung xem lớn
export function NewsListItem({ post }: { post: NewsItem }) {
  return (
    <div className="news-row">
      <div style={{ width: 128, flexShrink: 0 }}><Cover post={post} ratio="4 / 3" radius={10} iconSize={22} playMode="modal" /></div>
      <Link to={`/tin-tuc/${post.id}`} className="news-text" style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <h4 className="news-title clamp-3" style={{ fontSize: '0.98rem' }}>{post.title}</h4>
        <DateLine post={post} />
      </Link>
    </div>
  );
}

// Thẻ tin trong lưới: ảnh / video, tiêu đề, tóm tắt, ngày
export default function NewsCard({ post }: { post: NewsItem }) {
  return (
    <div className="news-card">
      <Cover post={post} />
      <Link to={`/tin-tuc/${post.id}`} className="news-text" style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0.9rem 0.2rem 0.2rem' }}>
        <h3 className="news-title clamp-2" style={{ fontSize: '1.08rem' }}>{post.title}</h3>
        {post.summary && <p className="news-summary clamp-3" style={{ fontSize: '0.9rem' }}>{post.summary}</p>}
        <DateLine post={post} />
      </Link>
    </div>
  );
}

export function NewsGrid({ posts, isMobile }: { posts: NewsItem[]; isMobile: boolean }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(270px, 1fr))', gap: isMobile ? 22 : 28 }}>
      {posts.map((p) => <NewsCard key={p.id} post={p} />)}
    </div>
  );
}

// Trang tin kiểu báo: bài mới nhất nổi bật + cột 3 tin kế tiếp bên cạnh, các tin còn lại xếp lưới bên dưới
export function NewsFront({ posts, isMobile, sideCount = 3 }: { posts: NewsItem[]; isMobile: boolean; sideCount?: number }) {
  if (!posts.length) return null;
  const [lead, ...rest] = posts;
  const side = rest.slice(0, sideCount);
  const grid = rest.slice(sideCount);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 26 : 36 }}>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile || !side.length ? '1fr' : 'minmax(0, 2.3fr) minmax(0, 1fr)', gap: isMobile ? 22 : 32 }}>
        <NewsFeatured post={lead} isMobile={isMobile} stacked={side.length > 0} />
        {side.length > 0 && (
          <div className="news-side">
            {side.map((p) => <NewsListItem key={p.id} post={p} />)}
          </div>
        )}
      </div>
      {grid.length > 0 && <NewsGrid posts={grid} isMobile={isMobile} />}
    </div>
  );
}
