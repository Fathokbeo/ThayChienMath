import { useEffect, useState } from 'react';
import { Newspaper } from 'lucide-react';
import PublicLayout from '../../components/PublicLayout';
import { NewsGrid, type NewsItem } from '../../components/NewsCard';
import api from '../../lib/api';
import { PAGE_MAX } from '../../lib/layout';
import useIsMobile from '../../lib/useIsMobile';

// Trang "Tin tức": tất cả bài đăng công khai, mới nhất lên đầu
export default function NewsList() {
  const isMobile = useIsMobile();
  const [posts, setPosts] = useState<NewsItem[] | null>(null);

  useEffect(() => { api.get('/public/news').then((r) => setPosts(r.data)).catch(() => setPosts([])); }, []);

  return (
    <PublicLayout>
      <section style={{ maxWidth: PAGE_MAX, margin: '0 auto', padding: isMobile ? '1.75rem 16px 2.5rem' : '3rem 22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#2F6F82', fontWeight: 600, fontSize: '0.9rem' }}>
          <Newspaper size={18} /> Tin tức
        </div>
        <h1 style={{ margin: '6px 0 6px', fontSize: 'clamp(1.6rem, 3.6vw, 2.3rem)', fontWeight: 700, letterSpacing: '-0.03em' }}>Tin tức & hoạt động</h1>
        <p style={{ margin: '0 0 1.5rem', color: '#6E6E73' }}>Thông báo, lịch khai giảng, thành tích và hoạt động của trung tâm.</p>

        {posts === null ? (
          <div style={{ color: '#86868B', padding: '2rem 0', textAlign: 'center' }}>Đang tải...</div>
        ) : posts.length === 0 ? (
          <div style={{ color: '#86868B', padding: '2.5rem 1rem', textAlign: 'center', background: '#fff', borderRadius: 18 }}>Chưa có bài viết nào.</div>
        ) : (
          <NewsGrid posts={posts} isMobile={isMobile} />
        )}
      </section>
    </PublicLayout>
  );
}
