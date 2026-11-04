import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, ImagePlus, ExternalLink, Eye, EyeOff } from 'lucide-react';
import api, { fileUrl } from '../../lib/api';
import { toast } from '../../components/Toast';
import RichTextEditor, { type RichTextHandle } from '../../components/RichTextEditor';

type Post = { id: number; title: string; summary: string | null; content: string | null; image: string | null; published_at: string | null; active: number };

const today = () => new Date().toISOString().slice(0, 10);

// Bài cũ soạn dạng chữ thường (trước khi có trình soạn thảo) → đổi thành các đoạn <p> để sửa tiếp
const toHtml = (content: string | null) => {
  const c = content || '';
  if (!c.trim() || /<\/?(p|h[2-4]|ul|ol|blockquote|img|br)\b/i.test(c)) return c;
  const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return c.split(/\r?\n\s*\r?\n/).map((p) => `<p>${esc(p).replace(/\r?\n/g, '<br>')}</p>`).join('');
};

// Soạn 1 bài tin tức — bố cục giống chính bài báo ngoài trang: ảnh bìa, tiêu đề lớn, đoạn tóm tắt, nội dung dài
export default function NewsEditor() {
  const { id } = useParams<{ id: string }>();
  const isNew = id === 'new';
  const navigate = useNavigate();
  const editorRef = useRef<RichTextHandle>(null);
  const coverInput = useRef<HTMLInputElement>(null);
  const [post, setPost] = useState<Post | null>(null);
  const [form, setForm] = useState({ title: '', summary: '', published_at: today(), active: true });
  const [cover, setCover] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState('');
  const [ready, setReady] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setReady(false); setDirty(false); setCover(null);
    if (isNew) {
      setPost(null); setForm({ title: '', summary: '', published_at: today(), active: true }); setCoverPreview('');
      setReady(true);
      return;
    }
    api.get('/admin/content/news').then((r) => {
      const p: Post | undefined = r.data.find((x: Post) => String(x.id) === id);
      if (!p) { toast.error('Không tìm thấy bài'); navigate('/admin/content'); return; }
      setPost(p);
      setForm({ title: p.title, summary: p.summary || '', published_at: p.published_at || today(), active: !!p.active });
      setCoverPreview(p.image ? fileUrl(`/uploads/news/${p.image}`) : '');
      setReady(true);
    });
  }, [id]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const set = (p: Partial<typeof form>) => { setForm((f) => ({ ...f, ...p })); setDirty(true); };

  const uploadImage = async (file: Blob) => {
    const fd = new FormData(); fd.append('image', file, 'anh.jpg');
    try {
      const { data } = await api.post('/admin/content/news/inline-image', fd);
      return data.url as string;
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Tải ảnh lỗi (ảnh tối đa 5MB)');
      throw e;
    }
  };

  const save = async () => {
    if (!form.title.trim()) { toast.error('Bài viết cần có tiêu đề'); return; }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('title', form.title.trim());
      fd.append('summary', form.summary.trim());
      fd.append('published_at', form.published_at);
      fd.append('active', form.active ? '1' : '0');
      fd.append('content', await editorRef.current!.getHTML());
      if (cover) fd.append('image', cover);
      if (isNew) {
        const { data } = await api.post('/admin/content/news', fd);
        setDirty(false);
        toast.success('Đã đăng bài');
        navigate(`/admin/news/${data.id}`, { replace: true });
      } else {
        await api.put(`/admin/content/news/${id}`, fd);
        setDirty(false); setCover(null);
        toast.success('Đã lưu bài');
      }
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Lỗi lưu bài');
    } finally { setSaving(false); }
  };

  return (
    <div className="fade-in news-editor">
      <div className="news-editor-bar">
        <Link to="/admin/content" className="btn btn-ghost btn-sm"><ChevronLeft size={16} /> Tin tức</Link>
        <span style={{ flex: 1 }} />
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', color: '#6E6E73' }}>
          Ngày đăng <input className="input" type="date" value={form.published_at} onChange={(e) => set({ published_at: e.target.value })} style={{ width: 'auto', minHeight: 36 }} />
        </label>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => set({ active: !form.active })} title={form.active ? 'Bài đang hiện ngoài trang — bấm để ẩn' : 'Bài đang ẩn — bấm để hiện'}>
          {form.active ? <><Eye size={15} /> Đang hiện</> : <><EyeOff size={15} /> Đang ẩn</>}
        </button>
        {post && post.active ? <a href={`/tin-tuc/${post.id}`} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm"><ExternalLink size={15} /> Xem bài</a> : null}
        <button type="button" className="btn btn-primary" onClick={save} disabled={saving || !ready}>{saving ? 'Đang lưu...' : isNew ? 'Đăng bài' : dirty ? 'Lưu thay đổi' : 'Đã lưu'}</button>
      </div>

      {!ready ? <div style={{ color: '#86868B', padding: '2rem', textAlign: 'center' }}>Đang tải...</div> : (
        <article className="news-editor-paper">
          {/* Ảnh bìa: bấm để chọn / đổi */}
          <div className={`news-editor-cover ${coverPreview ? 'has-img' : ''}`} onClick={() => coverInput.current?.click()}>
            {coverPreview ? <img src={coverPreview} alt="" /> : <span><ImagePlus size={28} /> Thêm ảnh bìa (hiện ở đầu bài và ở thẻ tin ngoài trang chủ)</span>}
            {coverPreview && <span className="news-editor-cover-change"><ImagePlus size={15} /> Đổi ảnh bìa</span>}
          </div>
          <input ref={coverInput} type="file" accept="image/*" hidden onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) { setCover(f); setCoverPreview(URL.createObjectURL(f)); setDirty(true); }
          }} />

          <textarea className="news-editor-title" rows={1} value={form.title} maxLength={200} placeholder="Tiêu đề bài viết"
            onChange={(e) => set({ title: e.target.value })}
            onInput={(e) => { const t = e.currentTarget; t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; }} />
          <textarea className="news-editor-lead" rows={2} value={form.summary} maxLength={500}
            placeholder="Tóm tắt (sapo) — 1–3 câu giới thiệu, hiện in đậm ở đầu bài và trên thẻ tin ngoài trang chủ"
            onChange={(e) => set({ summary: e.target.value })} />

          <RichTextEditor key={id} ref={editorRef} initialHtml={toHtml(post?.content ?? '')} uploadImage={uploadImage} onChange={() => setDirty(true)}
            placeholder="Viết nội dung bài... (dùng thanh công cụ để thêm tiêu đề phụ, chèn ảnh, video, trích dẫn)" />
        </article>
      )}
    </div>
  );
}
