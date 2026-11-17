import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, ImagePlus, ExternalLink, Eye, EyeOff, Film, Upload, X } from 'lucide-react';
import api, { fileUrl } from '../../lib/api';
import { toast } from '../../components/Toast';
import RichTextEditor, { type RichTextHandle } from '../../components/RichTextEditor';
import { parseNewsVideo } from '../../lib/newsVideo';

type Post = { id: number; title: string; summary: string | null; content: string | null; image: string | null; video: string | null; published_at: string | null; active: number };
const MAX_VIDEO_MB = 300;

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
  const [form, setForm] = useState({ title: '', summary: '', video: '', published_at: today(), active: true });
  const [videoLink, setVideoLink] = useState('');
  const [videoProgress, setVideoProgress] = useState<number | null>(null);
  const [cover, setCover] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState('');
  const [ready, setReady] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setReady(false); setDirty(false); setCover(null);
    if (isNew) {
      setPost(null); setForm({ title: '', summary: '', video: '', published_at: today(), active: true }); setCoverPreview('');
      setReady(true);
      return;
    }
    api.get('/admin/content/news').then((r) => {
      const p: Post | undefined = r.data.find((x: Post) => String(x.id) === id);
      if (!p) { toast.error('Không tìm thấy bài'); navigate('/admin/content'); return; }
      setPost(p);
      setForm({ title: p.title, summary: p.summary || '', video: p.video || '', published_at: p.published_at || today(), active: !!p.active });
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

  // Tải 1 file video lên máy chủ (hiện % tiến độ) → { file: tên file, url: /uploads/news/... }
  const sendVideo = async (file: File) => {
    if (file.size > MAX_VIDEO_MB * 1024 * 1024) {
      toast.error(`Video tối đa ${MAX_VIDEO_MB}MB — video dài nên đăng lên YouTube rồi dán link`);
      throw new Error('too big');
    }
    const fd = new FormData(); fd.append('video', file);
    setVideoProgress(0);
    try {
      const { data } = await api.post('/admin/content/news/video', fd, {
        timeout: 0,
        onUploadProgress: (e) => { if (e.total) setVideoProgress(Math.round((e.loaded * 100) / e.total)); },
      });
      return data as { file: string; url: string };
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Tải video lỗi');
      throw e;
    } finally { setVideoProgress(null); }
  };
  const uploadInlineVideo = async (file: File) => (await sendVideo(file)).url;
  const pickHeadVideo = () => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'video/mp4,video/webm,video/quicktime';
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return;
      try { const { file } = await sendVideo(f); set({ video: file }); toast.success('Đã tải video lên — bấm Lưu để đăng'); } catch { /* đã báo lỗi */ }
    };
    input.click();
  };
  const applyVideoLink = () => {
    const v = parseNewsVideo(videoLink);
    if (!v || v.kind === 'file') { toast.error('Link chưa đúng — cần link video YouTube hoặc Vimeo'); return; }
    set({ video: videoLink.trim() }); setVideoLink('');
  };
  const headVideo = parseNewsVideo(form.video);

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
      fd.append('video', form.video);
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

          {/* Video đầu bài: hiện thay ảnh bìa ở đầu bài (ảnh bìa vẫn dùng làm hình đại diện ngoài trang chủ) */}
          <div className="news-editor-video">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Film size={16} /> <b>Video đầu bài</b>
              <span style={{ color: '#86868B', fontSize: '0.82rem' }}>không bắt buộc — có video thì đầu bài hiện video thay cho ảnh bìa</span>
            </div>
            {headVideo ? (
              <div style={{ marginTop: 10 }}>
                {headVideo.kind === 'file'
                  ? <video src={headVideo.src} controls preload="metadata" style={{ width: '100%', maxHeight: 360, borderRadius: 10, background: '#000', display: 'block' }} />
                  : <iframe src={headVideo.embed} title="Video đầu bài" allowFullScreen style={{ width: '100%', aspectRatio: '16 / 9', border: 0, borderRadius: 10, display: 'block' }} />}
                <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 6, color: '#B04A2A' }} onClick={() => set({ video: '' })}><X size={14} /> Bỏ video</button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                <input className="input" value={videoLink} onChange={(e) => setVideoLink(e.target.value)} placeholder="Dán link YouTube / Vimeo"
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyVideoLink(); } }} style={{ flex: '1 1 240px', minWidth: 0 }} />
                <button type="button" className="btn btn-secondary btn-sm" onClick={applyVideoLink} disabled={!videoLink.trim()}>Dùng link</button>
                <button type="button" className="btn btn-outline btn-sm" onClick={pickHeadVideo} disabled={videoProgress !== null}><Upload size={14} /> Tải video từ máy</button>
              </div>
            )}
            {videoProgress !== null && (
              <div style={{ marginTop: 10, fontSize: '0.85rem', color: '#515154' }}>
                Đang tải video lên… {videoProgress}%
                <div style={{ height: 6, borderRadius: 99, background: '#EDEDF0', marginTop: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${videoProgress}%`, height: '100%', background: 'var(--color-primary)', transition: 'width .2s' }} />
                </div>
              </div>
            )}
          </div>

          <textarea className="news-editor-title" rows={1} value={form.title} maxLength={200} placeholder="Tiêu đề bài viết"
            onChange={(e) => set({ title: e.target.value })}
            onInput={(e) => { const t = e.currentTarget; t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; }} />
          <textarea className="news-editor-lead" rows={2} value={form.summary} maxLength={500}
            placeholder="Tóm tắt (sapo) — 1–3 câu giới thiệu, hiện in đậm ở đầu bài và trên thẻ tin ngoài trang chủ"
            onChange={(e) => set({ summary: e.target.value })} />

          <RichTextEditor key={id} ref={editorRef} initialHtml={toHtml(post?.content ?? '')} uploadImage={uploadImage} uploadVideo={uploadInlineVideo} onChange={() => setDirty(true)}
            placeholder="Viết nội dung bài... (dùng thanh công cụ để thêm tiêu đề phụ, chèn ảnh, video YouTube hoặc tải video lên, trích dẫn)" />
        </article>
      )}
    </div>
  );
}
