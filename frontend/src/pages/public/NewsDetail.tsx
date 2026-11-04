import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronLeft, Clock } from 'lucide-react';
import PublicLayout from '../../components/PublicLayout';
import { NewsGrid, type NewsItem } from '../../components/NewsCard';
import api, { fileUrl } from '../../lib/api';
import { fmtDay } from '../../lib/publicSite';
import useIsMobile from '../../lib/useIsMobile';

type Post = NewsItem & { content?: string | null; related: NewsItem[] };

// Chi tiết 1 bài tin tức: ảnh bìa, nội dung (giữ nguyên xuống dòng admin gõ), các bài mới khác
export default function NewsDetail() {
  const { id } = useParams<{ id: string }>();
  const isMobile = useIsMobile();
  const [post, setPost] = useState<Post | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    setPost(null); setMissing(false);
    api.get(`/public/news/${id}`).then((r) => setPost(r.data)).catch(() => setMissing(true));
    window.scrollTo(0, 0);
  }, [id]);

  return (
    <PublicLayout>
      <article style={{ maxWidth: 820, margin: '0 auto', padding: isMobile ? '1.25rem 16px 2.5rem' : '2.5rem 22px' }}>
        <Link to="/tin-tuc" className="link" style={{ display: 'inline-flex', alignItems: 'center', gap: 2, marginBottom: 12 }}>
          <ChevronLeft size={16} /> Tin tức
        </Link>

        {missing ? (
          <div style={{ color: '#86868B', padding: '3rem 1rem', textAlign: 'center', background: '#fff', borderRadius: 18 }}>Không tìm thấy bài viết này (có thể đã bị gỡ).</div>
        ) : !post ? (
          <div style={{ color: '#86868B', padding: '3rem 0', textAlign: 'center' }}>Đang tải...</div>
        ) : (
          <>
            <h1 style={{ margin: '0 0 10px', fontSize: 'clamp(1.5rem, 3.4vw, 2.2rem)', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.25 }}>{post.title}</h1>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#86868B', fontSize: '0.88rem', marginBottom: 18 }}>
              <Clock size={14} /> {fmtDay(post.published_at || post.created_at)}
            </div>
            {post.image && (
              <img src={fileUrl(`/uploads/news/${post.image}`)} alt={post.title} style={{ width: '100%', maxHeight: 480, objectFit: 'contain', background: '#fff', borderRadius: 16, display: 'block', marginBottom: 20 }} />
            )}
            {post.summary && <p style={{ margin: '0 0 16px', fontSize: '1.08rem', fontWeight: 600, color: '#3A3A3C', lineHeight: 1.6 }}>{post.summary}</p>}
            {post.content && <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.75, fontSize: '1rem', color: '#1D1D1F' }}>{post.content}</div>}

            {post.related.length > 0 && (
              <>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '2.5rem 0 0.9rem' }}>Tin khác</h2>
                <NewsGrid posts={post.related} isMobile={isMobile} />
              </>
            )}
          </>
        )}
      </article>
    </PublicLayout>
  );
}
