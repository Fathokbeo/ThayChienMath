import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronLeft, Clock, BookOpenText, Link2 } from 'lucide-react';
import PublicLayout from '../../components/PublicLayout';
import { NewsGrid, type NewsItem } from '../../components/NewsCard';
import api, { fileUrl } from '../../lib/api';
import { fmtDay } from '../../lib/publicSite';
import { toast } from '../../components/Toast';
import useIsMobile from '../../lib/useIsMobile';

type Post = NewsItem & { content?: string | null; related: NewsItem[] };

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Nội dung bài → HTML để hiện. Bài soạn bằng trình soạn thảo là HTML đã được máy chủ làm sạch khi lưu;
// bài cũ dạng chữ thường thì tách đoạn theo dòng trống. Ảnh trong bài lưu dạng /uploads/news/... → gắn đúng máy chủ (app).
function articleHtml(content: string) {
  const isHtml = /<\/?(p|h[2-4]|ul|ol|blockquote|img|br|iframe)\b/i.test(content);
  const html = isHtml ? content : content.split(/\r?\n\s*\r?\n/).map((p) => `<p>${esc(p).replace(/\r?\n/g, '<br>')}</p>`).join('');
  return html.replace(/src="(\/uploads\/news\/[^"]+)"/g, (_, p) => `src="${fileUrl(p)}"`);
}

// Ước lượng phút đọc (~220 chữ/phút)
const readMinutes = (html: string) => Math.max(1, Math.round(html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length / 220));

// Chi tiết 1 bài tin tức, trình bày như bài báo: tiêu đề lớn, sapo in đậm, ảnh bìa, nội dung dài, tin liên quan
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

  const body = useMemo(() => (post?.content ? articleHtml(post.content) : ''), [post?.content]);

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(window.location.href); toast.success('Đã chép link bài viết'); }
    catch { toast.error('Không chép được link'); }
  };

  return (
    <PublicLayout>
      <article style={{ maxWidth: 780, margin: '0 auto', padding: isMobile ? '1.25rem 16px 2.5rem' : '2.5rem 22px 3rem' }}>
        <Link to="/tin-tuc" className="link" style={{ display: 'inline-flex', alignItems: 'center', gap: 2, marginBottom: 14 }}>
          <ChevronLeft size={16} /> Tin tức
        </Link>

        {missing ? (
          <div style={{ color: '#86868B', padding: '3rem 1rem', textAlign: 'center', background: '#fff', borderRadius: 18 }}>Không tìm thấy bài viết này (có thể đã bị gỡ).</div>
        ) : !post ? (
          <div style={{ color: '#86868B', padding: '3rem 0', textAlign: 'center' }}>Đang tải...</div>
        ) : (
          <>
            <div><span className="news-kicker">Tin tức</span></div>
            <h1 className="article-title">{post.title}</h1>
            <div className="article-meta">
              <span><Clock size={14} /> {fmtDay(post.published_at || post.created_at)}</span>
              {body && <span><BookOpenText size={14} /> {readMinutes(body)} phút đọc</span>}
              <button type="button" onClick={copyLink}><Link2 size={14} /> Chép link</button>
            </div>
            {post.summary && <p className="article-lead">{post.summary}</p>}
            {post.image && <img src={fileUrl(`/uploads/news/${post.image}`)} alt={post.title} className="article-cover" />}
            {body && <div className="article-body" dangerouslySetInnerHTML={{ __html: body }} />}

            {post.related.length > 0 && (
              <section style={{ borderTop: '1px solid var(--tc-line-strong)', marginTop: '3rem', paddingTop: '1.75rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 1.1rem' }}>Tin khác</h2>
                <NewsGrid posts={post.related} isMobile={isMobile} />
              </section>
            )}
          </>
        )}
      </article>
    </PublicLayout>
  );
}
