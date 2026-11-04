import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Edit, Trash2, Eye, EyeOff, FileText, ExternalLink } from 'lucide-react';
import api, { fileUrl } from '../../lib/api';
import Modal from '../../components/Modal';
import { toast } from '../../components/Toast';
import { PageHeader, EmptyState } from '../../components/ui';
import { fmtDay, gradeLabel } from '../../lib/publicSite';
import { loadPdfjs } from '../../lib/pdfjs';

type DownloadMode = 'all' | 'login' | 'none';
type Exam = {
  id: number; title: string; grade: string | null; description: string | null; thumbnail: string | null; pdf_file: string | null;
  docx_file: string | null; pdf_download: DownloadMode | null; docx_download: DownloadMode | null; published_at: string | null; active: number; created_at: string;
};
const DOWNLOAD_OPTIONS: { value: DownloadMode; label: string }[] = [
  { value: 'all', label: 'Ai cũng tải được' },
  { value: 'login', label: 'Phải đăng nhập mới tải' },
  { value: 'none', label: 'Không cho tải (chỉ xem trên web)' },
];

const today = () => new Date().toISOString().slice(0, 10);
const EMPTY = { title: '', grade: '', description: '', published_at: today(), pdf_download: 'all' as DownloadMode, docx_download: 'all' as DownloadMode };

// Vẽ trang đầu của file PDF thành ảnh JPEG làm ảnh bìa (khi admin không chọn ảnh bìa riêng)
async function pdfFirstPageThumb(file: Blob): Promise<File | null> {
  try {
    const pdfjs = await loadPdfjs();
    const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: 480 / base.width });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width; canvas.height = viewport.height;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;
    const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.85));
    return blob ? new File([blob], 'bia.jpg', { type: 'image/jpeg' }) : null;
  } catch (err) {
    console.error('[exam] Không vẽ được ảnh bìa từ PDF:', err);
    return null; // không vẽ được thì đề vẫn lưu, chỉ là không có ảnh bìa
  }
}

// Quản lý mục "Đề và chuyên môn" ở trang công khai
export default function ExamManagement() {
  const [exams, setExams] = useState<Exam[] | null>(null);
  const [grades, setGrades] = useState<string[]>([]);
  const [gradesText, setGradesText] = useState('');
  const [modal, setModal] = useState<Exam | 'new' | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [pdf, setPdf] = useState<File | null>(null);
  const [docx, setDocx] = useState<File | null>(null);
  const [thumb, setThumb] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('');

  const load = () => api.get('/admin/site/exams').then((r) => setExams(r.data)).catch(() => setExams([]));

  // Đề có PDF mà chưa có ảnh bìa (vd đăng từ trình duyệt cũ không vẽ được trang đầu) → tự vẽ bù khi mở trang.
  // Mỗi đề chỉ thử 1 lần trong phiên này để không lặp lại mãi nếu file PDF hỏng.
  const coverTried = useRef<Set<number>>(new Set());
  useEffect(() => {
    const missing = (exams || []).filter((e) => e.pdf_file && !e.thumbnail && !coverTried.current.has(e.id));
    if (!missing.length) return;
    missing.forEach((e) => coverTried.current.add(e.id));
    (async () => {
      let made = 0;
      for (const e of missing) {
        try {
          const pdfBlob = await fetch(fileUrl(`/uploads/exams/${e.pdf_file}`)).then((r) => (r.ok ? r.blob() : Promise.reject(r.status)));
          const cover = await pdfFirstPageThumb(pdfBlob);
          if (!cover) continue;
          const body = new FormData(); body.append('thumbnail', cover);
          await api.put(`/admin/site/exams/${e.id}`, body);
          made += 1;
        } catch (err) {
          console.error(`[exam] Tạo ảnh bìa cho đề ${e.id} lỗi:`, err);
        }
      }
      if (made) { toast.success(`Đã tạo ảnh bìa từ PDF cho ${made} đề`); load(); }
    })();
  }, [exams]);
  const loadGrades = () => api.get('/public/exam-grades').then((r) => { setGrades(r.data); setGradesText(r.data.join(', ')); });
  useEffect(() => { load(); loadGrades(); }, []);

  const saveGrades = async () => {
    const list = gradesText.split(',').map((g) => g.trim()).filter(Boolean);
    if (!list.length) { toast.error('Cần ít nhất 1 lớp'); return; }
    await api.put('/admin/content/settings', { exam_grades: list.join(',') });
    toast.success('Đã lưu danh sách lớp');
    loadGrades();
  };

  const open = (e: Exam | 'new') => {
    setForm(e === 'new' ? { ...EMPTY, grade: grades[0] || '' }
      : { title: e.title, grade: e.grade || '', description: e.description || '', published_at: e.published_at || today(),
        pdf_download: e.pdf_download || 'all', docx_download: e.docx_download || 'all' });
    setPdf(null); setDocx(null); setThumb(null);
    setModal(e);
  };

  const save = async () => {
    if (!form.title.trim()) { toast.error('Cần tên đề'); return; }
    const editing = modal !== 'new' ? (modal as Exam) : null;
    if (!editing && !pdf && !docx) { toast.error('Chọn file đề (PDF và/hoặc Word)'); return; }
    setSaving(true);
    try {
      const body = new FormData();
      Object.entries(form).forEach(([k, v]) => body.append(k, v));
      if (pdf) body.append('pdf', pdf);
      if (docx) body.append('docx', docx);
      // Không chọn ảnh bìa (và đề chưa có ảnh bìa) → tự lấy trang đầu của PDF
      const cover = thumb || (pdf && !editing?.thumbnail ? await pdfFirstPageThumb(pdf) : null);
      if (cover) body.append('thumbnail', cover);
      else if (pdf && !editing?.thumbnail) toast.error('Không tạo được ảnh bìa từ PDF — đề vẫn được lưu, có thể chọn ảnh bìa riêng');
      if (editing) await api.put(`/admin/site/exams/${editing.id}`, body);
      else await api.post('/admin/site/exams', body);
      toast.success(editing ? 'Đã cập nhật đề' : 'Đã đăng đề');
      setModal(null);
      load();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Lỗi lưu đề');
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (e: Exam) => {
    const body = new FormData(); body.append('active', e.active ? '0' : '1');
    await api.put(`/admin/site/exams/${e.id}`, body);
    load();
  };
  const remove = async (e: Exam) => {
    if (!confirm(`Xóa đề "${e.title}"? File PDF và ảnh bìa cũng bị xóa.`)) return;
    await api.delete(`/admin/site/exams/${e.id}`);
    toast.success('Đã xóa đề');
    load();
  };

  const shown = (exams || []).filter((e) => !filter || e.grade === filter);
  const editing = modal && modal !== 'new' ? modal : null;

  return (
    <div className="fade-in">
      <PageHeader title="Đề và chuyên môn" subtitle="Đề hiện ở trang chủ và trang /de-thi, khách xem được không cần đăng nhập."
        actions={<>
          <Link to="/de-thi" target="_blank" className="btn btn-ghost"><ExternalLink size={15} /> Xem trang đề</Link>
          <button className="btn btn-primary" onClick={() => open('new')}><Plus size={16} /> Đăng đề</button>
        </>} />

      <div className="card" style={{ padding: '0.9rem 1.1rem', marginBottom: 16 }}>
        <label className="form-field">
          <span>Các lớp để lọc đề (cách nhau bằng dấu phẩy, vd: 6, 7, 8, 9, Thi vào 10)</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="input" value={gradesText} onChange={(e) => setGradesText(e.target.value)} />
            <button className="btn btn-secondary" onClick={saveGrades} style={{ flexShrink: 0 }}>Lưu</button>
          </div>
        </label>
      </div>

      <div className="grade-chips" style={{ marginBottom: 14 }}>
        <button className={`ph-chip ${filter === '' ? 'active' : ''}`} onClick={() => setFilter('')}>Tất cả ({exams?.length || 0})</button>
        {grades.map((g) => (
          <button key={g} className={`ph-chip ${filter === g ? 'active' : ''}`} style={{ whiteSpace: 'nowrap' }} onClick={() => setFilter(g)}>
            {gradeLabel(g)} ({(exams || []).filter((e) => e.grade === g).length})
          </button>
        ))}
      </div>

      {exams === null ? <div style={{ color: '#86868B' }}>Đang tải...</div> : shown.length === 0 ? (
        <EmptyState title="Chưa có đề nào" text="Đăng đề PDF để hiện ở mục Đề và chuyên môn." action={<button className="btn btn-primary" onClick={() => open('new')}><Plus size={16} /> Đăng đề</button>} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {shown.map((e) => (
            <div key={e.id} className="card" style={{ padding: '0.8rem 1rem', display: 'flex', gap: 12, alignItems: 'center', opacity: e.active ? 1 : 0.55 }}>
              <div className="exam-card-thumb" style={{ width: 54, height: 72 }}>
                {e.thumbnail ? <img src={fileUrl(`/uploads/exams/${e.thumbnail}`)} alt="" /> : <FileText size={22} color="#9CC7D2" />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Link to={`/de-thi/${e.id}`} target="_blank" style={{ fontWeight: 700, color: '#1D1D1F', textDecoration: 'none' }}>{e.title}</Link>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', fontSize: '0.8rem', color: '#86868B', marginTop: 4 }}>
                  {e.grade && <span className="badge badge-blue">{gradeLabel(e.grade)}</span>}
                  <span>{fmtDay(e.published_at || e.created_at)}</span>
                  {!e.pdf_file && <span className="badge badge-red">Chưa có PDF</span>}
                  {e.docx_file && <span className="badge badge-purple">Có bản Word</span>}
                  {e.pdf_file && <span>Tải PDF: {DOWNLOAD_OPTIONS.find((o) => o.value === (e.pdf_download || 'all'))?.label.toLowerCase()}</span>}
                  {e.docx_file && <span>· Tải Word: {DOWNLOAD_OPTIONS.find((o) => o.value === (e.docx_download || 'all'))?.label.toLowerCase()}</span>}
                  {!e.active && <span className="badge badge-gray">Đang ẩn</span>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                <button className="btn btn-ghost btn-sm btn-icon" title={e.active ? 'Ẩn đề' : 'Hiện lại'} onClick={() => toggle(e)}>{e.active ? <EyeOff size={15} /> : <Eye size={15} />}</button>
                <button className="btn btn-ghost btn-sm btn-icon" title="Sửa" onClick={() => open(e)}><Edit size={15} /></button>
                <button className="btn btn-ghost btn-sm btn-icon" title="Xóa" onClick={() => remove(e)}><Trash2 size={15} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={!!modal} onClose={() => setModal(null)} title={editing ? 'Sửa đề' : 'Đăng đề mới'} size="lg"
        footer={<><button className="btn btn-ghost" onClick={() => setModal(null)}>Hủy</button><button className="btn btn-primary" disabled={saving} onClick={save}>{saving ? 'Đang lưu...' : 'Lưu'}</button></>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label className="form-field"><span>Tên đề *</span>
            <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="vd Đề giữa học kỳ 1 Toán 9 năm 2026 – 2027 trường THCS Trưng Vương – Hà Nội" /></label>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 10 }}>
            <label className="form-field"><span>Lớp</span>
              <select className="input" value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })}>
                <option value="">— Không phân lớp —</option>
                {grades.map((g) => <option key={g} value={g}>{gradeLabel(g)}</option>)}
                {form.grade && !grades.includes(form.grade) && <option value={form.grade}>{gradeLabel(form.grade)}</option>}
              </select></label>
            <label className="form-field"><span>Ngày đăng</span>
              <input className="input" type="date" value={form.published_at} onChange={(e) => setForm({ ...form, published_at: e.target.value })} /></label>
          </div>
          <label className="form-field"><span>Mô tả / nội dung chuyên môn</span>
            <textarea className="input" rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Cấu trúc đề, thời gian làm bài, nhận xét chuyên môn..." /></label>
          <div style={{ fontSize: '0.8rem', color: '#6E6E73' }}>
            Đăng bản <b>PDF</b> để khách xem đề ngay trên web, và/hoặc bản <b>Word</b> để tải về. Cần ít nhất một trong hai.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 10 }}>
            <label className="form-field"><span>File đề PDF {editing?.pdf_file ? '— chọn file mới để thay' : ''}</span>
              <input className="input" type="file" accept="application/pdf" onChange={(e) => setPdf(e.target.files?.[0] || null)} />
              {editing?.pdf_file && !pdf && <a href={fileUrl(`/uploads/exams/${editing.pdf_file}`)} target="_blank" rel="noreferrer" className="link" style={{ fontSize: '0.85rem' }}>Xem file đang dùng</a>}</label>
            <label className="form-field"><span>Quyền tải bản PDF</span>
              <select className="input" value={form.pdf_download} onChange={(e) => setForm({ ...form, pdf_download: e.target.value as DownloadMode })}>
                {DOWNLOAD_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select></label>
            <label className="form-field"><span>File đề Word (.doc, .docx) {editing?.docx_file ? '— chọn file mới để thay' : ''}</span>
              <input className="input" type="file" accept=".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(e) => setDocx(e.target.files?.[0] || null)} />
              {editing?.docx_file && !docx && <a href={fileUrl(`/api/public/exams/${editing.id}/file/docx`)} className="link" style={{ fontSize: '0.85rem' }}>Tải bản Word đang dùng</a>}</label>
            <label className="form-field"><span>Quyền tải bản Word</span>
              <select className="input" value={form.docx_download} onChange={(e) => setForm({ ...form, docx_download: e.target.value as DownloadMode })}>
                {DOWNLOAD_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select></label>
          </div>
          {form.pdf_download !== 'all' && (
            <div style={{ fontSize: '0.78rem', color: '#B8673E', marginTop: -4 }}>
              Lưu ý: bản PDF vẫn hiện để xem trên web, nên nút tải bị ẩn nhưng người rành máy tính vẫn có thể lưu lại được. Bản Word thì chặn hẳn.
            </div>
          )}
          <label className="form-field"><span>Ảnh bìa (không bắt buộc — để trống sẽ tự lấy trang đầu của PDF)</span>
            <input className="input" type="file" accept="image/*" onChange={(e) => setThumb(e.target.files?.[0] || null)} /></label>
        </div>
      </Modal>
    </div>
  );
}
