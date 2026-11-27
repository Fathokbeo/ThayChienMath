import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Edit, Trash2, Eye, EyeOff, FileText, ExternalLink } from 'lucide-react';
import api, { fileUrl } from '../../lib/api';
import Modal from '../../components/Modal';
import { toast } from '../../components/Toast';
import { PageHeader, EmptyState } from '../../components/ui';
import { fmtDay, gradeLabel } from '../../lib/publicSite';
import { loadPdfjs } from '../../lib/pdfjs';
import ExamMenuBar, { type ExamMeta } from '../../components/ExamMenuBar';
import ExamStructureEditor from '../../components/ExamStructureEditor';
import { ACCESS_OPTIONS, parseFlags, vnd, type AccessFlag } from '../../lib/payments';

type Exam = {
  id: number; title: string; grade: string | null; description: string | null; thumbnail: string | null; pdf_file: string | null;
  docx_file: string | null; pdf_access: string | null; docx_access: string | null; pdf_price: number | null; docx_price: number | null; published_at: string | null; active: number; created_at: string;
  category: string | null;
};
// Tóm tắt quyền tải để hiện ở danh sách đề
const accessSummary = (flags: AccessFlag[], price: number | null) => !flags.length ? 'chỉ xem'
  : flags.map((f) => (f === 'buy' ? `mua lẻ ${vnd(price)}` : ACCESS_OPTIONS.find((o) => o.value === f)?.label.toLowerCase())).join(', ');

// Ô tích quyền tải 1 bản đề: "Chỉ xem" (không tích gì) hoặc tích nhiều quyền cùng lúc; tích "Mua lẻ" thì nhập giá
function AccessPicker({ title, flags, price, onChange, onPrice }: {
  title: string; flags: AccessFlag[]; price: string; onChange: (f: AccessFlag[]) => void; onPrice: (p: string) => void;
}) {
  const toggle = (f: AccessFlag) => onChange(flags.includes(f) ? flags.filter((x) => x !== f) : [...flags, f]);
  return (
    <div className="access-box">
      <div className="access-title">{title}</div>
      <label className={`access-opt ${!flags.length ? 'on' : ''}`}>
        <input type="checkbox" checked={!flags.length} onChange={() => onChange([])} />
        <span><b>Chỉ xem</b><small>Không cho tải về</small></span>
      </label>
      {ACCESS_OPTIONS.map((o) => (
        <label key={o.value} className={`access-opt ${flags.includes(o.value) ? 'on' : ''}`}>
          <input type="checkbox" checked={flags.includes(o.value)} onChange={() => toggle(o.value)} />
          <span><b>{o.label}</b><small>{o.hint}</small></span>
        </label>
      ))}
      {flags.includes('buy') && (
        <label className="access-price">Giá bán lẻ
          <input className="input" inputMode="numeric" value={price} onChange={(e) => onPrice(e.target.value.replace(/[^d]/g, ''))} placeholder="vd 20000" />
          <span>{price ? vnd(Number(price)) : 'đồng'}</span>
        </label>
      )}
    </div>
  );
}

const today = () => new Date().toISOString().slice(0, 10);
const EMPTY = { title: '', grade: '', category: '', description: '', published_at: today(),
  pdf_access: ['account'] as AccessFlag[], docx_access: ['vip', 'buy'] as AccessFlag[], pdf_price: '', docx_price: '' };
const NO_CATEGORY = '__none'; // lọc "Chưa phân loại" ở thanh menu admin

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
  const [meta, setMeta] = useState<ExamMeta | null>(null);
  const [modal, setModal] = useState<Exam | 'new' | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [pdf, setPdf] = useState<File | null>(null);
  const [docx, setDocx] = useState<File | null>(null);
  const [thumb, setThumb] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<{ grade: string; category: string }>({ grade: '', category: '' });

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
  const loadMeta = () => api.get('/admin/site/exam-meta').then((r) => setMeta(r.data)).catch(() => {});
  useEffect(() => { load(); loadMeta(); }, []);
  const grades = meta?.grades || [];
  const categories = meta?.categories || [];

  const open = (e: Exam | 'new') => {
    // Đăng đề mới khi đang lọc 1 lớp / 1 loại → điền sẵn đúng lớp, loại đó
    setForm(e === 'new' ? { ...EMPTY, grade: filter.grade || grades[0] || '', category: filter.category && filter.category !== NO_CATEGORY ? filter.category : '' }
      : { title: e.title, grade: e.grade || '', category: e.category || '', description: e.description || '', published_at: e.published_at || today(),
        pdf_access: parseFlags(e.pdf_access), docx_access: parseFlags(e.docx_access),
        pdf_price: e.pdf_price ? String(e.pdf_price) : '', docx_price: e.docx_price ? String(e.docx_price) : '' });
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
      if ([...form.pdf_access, ...form.docx_access].includes('buy') && ((form.pdf_access.includes('buy') && !Number(form.pdf_price)) || (form.docx_access.includes('buy') && !Number(form.docx_price)))) {
        toast.error('Nhập giá cho file bán lẻ'); setSaving(false); return;
      }
      Object.entries(form).forEach(([k, v]) => body.append(k, Array.isArray(v) ? v.join(',') : v));
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
      load(); loadMeta();
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

  const shown = (exams || []).filter((e) => (!filter.grade || e.grade === filter.grade)
    && (!filter.category || (filter.category === NO_CATEGORY ? !e.category : e.category === filter.category)));
  const editing = modal && modal !== 'new' ? modal : null;

  return (
    <div className="fade-in">
      <PageHeader title="Đề và chuyên môn" subtitle="Đề hiện ở trang chủ và trang /de-thi, khách xem được không cần đăng nhập."
        actions={<>
          <Link to="/de-thi" target="_blank" className="btn btn-ghost"><ExternalLink size={15} /> Xem trang đề</Link>
          <button className="btn btn-primary" onClick={() => open('new')}><Plus size={16} /> Đăng đề</button>
        </>} />

      {meta && <ExamStructureEditor meta={meta} onSaved={setMeta} />}

      {/* Cùng thanh menu như trang chủ: chọn lớp → loại đề để xem / đăng đề đúng chỗ (hiện cả loại chưa có đề) */}
      {meta && <ExamMenuBar meta={meta} activeGrade={filter.grade} activeCategory={filter.category} showEmpty
        onPick={(grade, category) => setFilter({ grade, category: category || '' })} />}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 14, fontSize: '0.9rem' }}>
        <button className={`ph-chip ${!filter.grade ? 'active' : ''}`} onClick={() => setFilter({ grade: '', category: '' })}>Tất cả ({exams?.length || 0})</button>
        {filter.grade && (
          <span style={{ color: '#515154' }}>
            Đang xem: <b>{gradeLabel(filter.grade)}</b>{filter.category && <> › <b>{filter.category === NO_CATEGORY ? 'Chưa phân loại' : filter.category}</b></>} — {shown.length} đề
          </span>
        )}
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
                  {e.category ? <span className="badge badge-orange">{e.category}</span> : <span className="badge badge-gray">Chưa phân loại</span>}
                  <span>{fmtDay(e.published_at || e.created_at)}</span>
                  {!e.pdf_file && <span className="badge badge-red">Chưa có PDF</span>}
                  {e.docx_file && <span className="badge badge-purple">Có bản Word</span>}
                  {e.pdf_file && <span>PDF: {accessSummary(parseFlags(e.pdf_access), e.pdf_price)}</span>}
                  {e.docx_file && <span>· Word: {accessSummary(parseFlags(e.docx_access), e.docx_price)}</span>}
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
            <label className="form-field"><span>Lớp</span>
              <select className="input" value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })}>
                <option value="">— Không phân lớp —</option>
                {grades.map((g) => <option key={g} value={g}>{gradeLabel(g)}</option>)}
                {form.grade && !grades.includes(form.grade) && <option value={form.grade}>{gradeLabel(form.grade)}</option>}
              </select></label>
            <label className="form-field"><span>Loại đề</span>
              <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                <option value="">— Chưa phân loại —</option>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                {form.category && !categories.includes(form.category) && <option value={form.category}>{form.category}</option>}
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
            <label className="form-field"><span>File đề Word (.doc, .docx) {editing?.docx_file ? '— chọn file mới để thay' : ''}</span>
              <input className="input" type="file" accept=".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(e) => setDocx(e.target.files?.[0] || null)} />
              {editing?.docx_file && !docx && <a href={fileUrl(`/api/public/exams/${editing.id}/file/docx`)} className="link" style={{ fontSize: '0.85rem' }}>Tải bản Word đang dùng</a>}</label>
          </div>
          {/* Quyền tải từng bản: tích nhiều quyền cùng lúc (vd vừa miễn phí cho học sinh, vừa bán lẻ cho khách) */}
          <div className="access-grid">
            <AccessPicker title="Ai được tải bản PDF" flags={form.pdf_access} price={form.pdf_price}
              onChange={(f) => setForm({ ...form, pdf_access: f })} onPrice={(p) => setForm({ ...form, pdf_price: p })} />
            <AccessPicker title="Ai được tải bản Word" flags={form.docx_access} price={form.docx_price}
              onChange={(f) => setForm({ ...form, docx_access: f })} onPrice={(p) => setForm({ ...form, docx_price: p })} />
          </div>
          <div style={{ fontSize: '0.78rem', color: '#86868B', marginTop: -4 }}>
            Bản PDF luôn xem được trên web; quyền ở trên chỉ áp dụng cho nút tải về. Bản Word chỉ tải được khi đúng quyền. Giáo viên và quản trị luôn tải được.
          </div>
          <label className="form-field"><span>Ảnh bìa (không bắt buộc — để trống sẽ tự lấy trang đầu của PDF)</span>
            <input className="input" type="file" accept="image/*" onChange={(e) => setThumb(e.target.files?.[0] || null)} /></label>
        </div>
      </Modal>
    </div>
  );
}
