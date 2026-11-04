import { Link } from 'react-router-dom';
import { Clock, Newspaper } from 'lucide-react';
import { fileUrl } from '../lib/api';
import { fmtDay } from '../lib/publicSite';

export type NewsItem = { id: number; title: string; summary?: string | null; image?: string | null; published_at?: string | null; created_at?: string };

const clamp = (lines: number): React.CSSProperties => ({ display: '-webkit-box', WebkitLineClamp: lines, WebkitBoxOrient: 'vertical', overflow: 'hidden' });

// Một bài tin tức trong lưới: ảnh bìa trên, ngày đăng + tiêu đề + tóm tắt bên dưới
export default function NewsCard({ post }: { post: NewsItem }) {
  return (
    <Link to={`/tin-tuc/${post.id}`} style={{ display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: 16, overflow: 'hidden', textDecoration: 'none', color: 'inherit', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', height: '100%' }}>
      {post.image ? (
        <img src={fileUrl(`/uploads/news/${post.image}`)} alt="" loading="lazy" style={{ width: '100%', aspectRatio: '16 / 9', objectFit: 'cover', display: 'block' }} />
      ) : (
        <div style={{ aspectRatio: '16 / 9', background: 'linear-gradient(135deg, #E6F0F3, #CDE1E7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Newspaper size={40} color="#2F6F82" />
        </div>
      )}
      <div style={{ padding: '0.9rem 1rem 1.1rem', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.8rem', color: '#86868B' }}>
          <Clock size={13} /> {fmtDay(post.published_at || post.created_at)}
        </span>
        <h3 style={{ margin: 0, fontSize: '1.02rem', fontWeight: 700, color: '#1D1D1F', lineHeight: 1.35, ...clamp(2) }}>{post.title}</h3>
        {post.summary && <p style={{ margin: 0, fontSize: '0.86rem', color: '#6E6E73', lineHeight: 1.55, ...clamp(3) }}>{post.summary}</p>}
      </div>
    </Link>
  );
}

// Lưới thẻ tin: điện thoại 1 cột, máy tính tự chia cột
export function NewsGrid({ posts, isMobile }: { posts: NewsItem[]; isMobile: boolean }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(280px, 1fr))', gap: isMobile ? 14 : 20 }}>
      {posts.map((p) => <NewsCard key={p.id} post={p} />)}
    </div>
  );
}
