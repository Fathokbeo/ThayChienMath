import { Link } from 'react-router-dom';
import { Clock, Newspaper, ArrowRight } from 'lucide-react';
import { fileUrl } from '../lib/api';
import { fmtDay } from '../lib/publicSite';

export type NewsItem = { id: number; title: string; summary?: string | null; image?: string | null; published_at?: string | null; created_at?: string };

function Cover({ post, ratio = '16 / 9', radius = 14, iconSize = 36 }: { post: NewsItem; ratio?: string; radius?: number; iconSize?: number }) {
  return post.image ? (
    <img src={fileUrl(`/uploads/news/${post.image}`)} alt="" loading="lazy" className="news-cover" style={{ aspectRatio: ratio, borderRadius: radius }} />
  ) : (
    <div className="news-cover news-cover-empty" style={{ aspectRatio: ratio, borderRadius: radius }}><Newspaper size={iconSize} /></div>
  );
}

const DateLine = ({ post }: { post: NewsItem }) => (
  <span className="news-date"><Clock size={13} /> {fmtDay(post.published_at || post.created_at)}</span>
);

// Bài nổi bật (bài mới nhất) — giống trang nhất báo điện tử: ảnh lớn + tiêu đề to + tóm tắt.
// stacked: ảnh trên, chữ dưới (khi bên cạnh có cột tin / điện thoại); không thì ảnh trái, chữ phải.
export function NewsFeatured({ post, isMobile, stacked }: { post: NewsItem; isMobile: boolean; stacked?: boolean }) {
  return (
    <Link to={`/tin-tuc/${post.id}`} className="news-featured" style={{ gridTemplateColumns: isMobile || stacked ? '1fr' : 'minmax(0, 1.35fr) minmax(0, 1fr)' }}>
      <Cover post={post} ratio="16 / 10" radius={16} iconSize={48} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, justifyContent: 'center' }}>
        <span className="news-kicker">Tin mới</span>
        <h3 className="news-title" style={{ fontSize: isMobile ? '1.3rem' : '1.7rem' }}>{post.title}</h3>
        {post.summary && <p className="news-summary clamp-4">{post.summary}</p>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <DateLine post={post} />
          <span className="news-more">Đọc tiếp <ArrowRight size={15} /></span>
        </div>
      </div>
    </Link>
  );
}

// Tin dạng dòng: ảnh nhỏ bên trái, tiêu đề + ngày bên phải (cột tin bên cạnh bài nổi bật)
export function NewsListItem({ post }: { post: NewsItem }) {
  return (
    <Link to={`/tin-tuc/${post.id}`} className="news-row">
      <div style={{ width: 128, flexShrink: 0 }}><Cover post={post} ratio="4 / 3" radius={10} iconSize={22} /></div>
      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <h4 className="news-title clamp-3" style={{ fontSize: '0.98rem' }}>{post.title}</h4>
        <DateLine post={post} />
      </div>
    </Link>
  );
}

// Thẻ tin trong lưới: ảnh, tiêu đề, tóm tắt, ngày
export default function NewsCard({ post }: { post: NewsItem }) {
  return (
    <Link to={`/tin-tuc/${post.id}`} className="news-card">
      <Cover post={post} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0.9rem 0.2rem 0.2rem' }}>
        <h3 className="news-title clamp-2" style={{ fontSize: '1.08rem' }}>{post.title}</h3>
        {post.summary && <p className="news-summary clamp-3" style={{ fontSize: '0.9rem' }}>{post.summary}</p>}
        <DateLine post={post} />
      </div>
    </Link>
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
