import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import api, { fileUrl } from '../../lib/api';
import { BookOpen, Users, School, Plus, Edit, Trash2, ChevronRight, Search } from 'lucide-react';
import Modal from '../../components/Modal';
import { PageHeader, SectionHeader, EmptyState } from '../../components/ui';
import { toast } from '../../components/Toast';

// Trang "Khóa học" của giáo viên: danh sách khóa học (tìm theo tên), tạo / sửa / xóa, ảnh đại diện.
// embedded: nhúng ở cuối trang Tổng quát — tiêu đề mục nhỏ thay cho tiêu đề trang, không có ô tìm.
export default function TeacherCourses({ embedded = false }: { embedded?: boolean }) {
  const [q, setQ] = useState('');
  const [courses, setCourses] = useState<any[]>([]);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ title: '', description: '' });
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { fetchCourses(); }, []);

  const fetchCourses = () => api.get('/teacher/my-courses').then((r) => setCourses(r.data));

  const openCreate = () => {
    setEditing(null);
    setForm({ title: '', description: '' });
    setFile(null);
    setPreview('');
    setModal(true);
  };

  const openEdit = (c: any, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setEditing(c);
    setForm({ title: c.title, description: c.description || '' });
    setFile(null);
    setPreview(c.thumbnail ? fileUrl(`/uploads/courses/${c.thumbnail}`) : '');
    setModal(true);
  };

  const saveCourse = async () => {
    if (!form.title) { toast.error('Cần tiêu đề khóa học'); return; }
    setLoading(true);
    try {
      let courseId: number;
      if (editing) {
        await api.put(`/teacher/courses/${editing.id}`, { title: form.title, description: form.description });
        courseId = editing.id;
        toast.success('Đã cập nhật');
      } else {
        const { data } = await api.post('/teacher/courses', { title: form.title, description: form.description });
        courseId = data.id;
        toast.success('Đã tạo khóa học');
      }
      if (file) {
        const fd = new FormData();
        fd.append('thumbnail', file);
        await api.post(`/teacher/courses/${courseId}/thumbnail`, fd);
      }
      setModal(false);
      fetchCourses();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Lỗi tạo khóa học');
    } finally {
      setLoading(false);
    }
  };

  const deleteCourse = async (c: any, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Xóa khóa học "${c.title}"?\n\nTất cả lớp học trong khóa cùng bài giảng, bài tập, bài nộp sẽ bị xóa. Học sinh chỉ thuộc các lớp này sẽ bị xóa vĩnh viễn (tài khoản + dữ liệu). Không thể khôi phục.`)) return;
    await api.delete(`/teacher/courses/${c.id}`);
    toast.success('Đã xóa');
    fetchCourses();
  };

  const fold = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
  const shown = q.trim() ? courses.filter((c) => fold(`${c.title} ${c.description || ''}`).includes(fold(q.trim()))) : courses;
  const totalClasses = courses.reduce((s, c) => s + (c.class_count || 0), 0);
  const totalStudents = courses.reduce((s, c) => s + (c.student_count || 0), 0);

  return (
    <div>
      {embedded ? (
        <SectionHeader title="Khóa học của tôi" count={courses.length}
          action={<button className="btn btn-primary btn-sm" onClick={openCreate}><Plus size={14} /> Tạo khóa học</button>} />
      ) : (
        <PageHeader
          title="Khóa học"
          subtitle={`${courses.length} khóa học · ${totalClasses} lớp · ${totalStudents} học sinh`}
          actions={<button className="btn btn-primary" onClick={openCreate}><Plus size={16} /> Tạo khóa học</button>}
        />
      )}

      {!embedded && courses.length > 3 && (
        <div style={{ position: 'relative', maxWidth: 360, marginBottom: 18 }}>
          <Search size={17} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#86868B' }} />
          <input className="input" style={{ paddingLeft: 40, borderRadius: 99 }} placeholder="Tìm khóa học…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      )}

      {courses.length === 0 ? (
        <EmptyState icon={<BookOpen size={34} />} title="Chưa có khóa học nào" text="Tạo khóa học, sau đó thêm lớp và học sinh vào khóa."
          action={<button className="btn btn-primary btn-sm" onClick={openCreate}><Plus size={14} /> Tạo khóa học</button>} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: 14 }}>
          {shown.map((c) => (
            <div key={c.id} className="card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <Link to={`/teacher/courses/${c.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                {c.thumbnail ? (
                  <img src={fileUrl(`/uploads/courses/${c.thumbnail}`)} alt={c.title} style={{ width: '100%', height: 140, objectFit: 'cover', display: 'block' }} />
                ) : (
                  <div style={{ height: 110, background: '#E6F0F2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <BookOpen size={30} color="#1F5C68" />
                  </div>
                )}
                <div style={{ padding: '1rem 1.15rem 0.4rem' }}>
                  <h3 style={{ margin: '0 0 4px', fontSize: '1.08rem', fontWeight: 700 }}>{c.title}</h3>
                  {c.description && <p style={{ margin: 0, fontSize: '0.86rem', color: '#6E6E73', lineHeight: 1.45 }}>{c.description}</p>}
                  <div style={{ display: 'flex', gap: 14, fontSize: '0.82rem', color: '#86868B', marginTop: 10 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><School size={13} />{c.class_count || 0} lớp</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Users size={13} />{c.student_count || 0} học sinh</span>
                  </div>
                </div>
              </Link>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0.6rem 1.15rem 1rem', marginTop: 'auto' }}>
                <Link to={`/teacher/courses/${c.id}`} className="link" style={{ fontSize: '0.9rem' }}>Vào khóa học <ChevronRight size={15} /></Link>
                <span style={{ flex: 1 }} />
                <button className="btn btn-ghost btn-sm btn-icon" onClick={(e) => openEdit(c, e)} title="Sửa"><Edit size={14} /></button>
                <button className="btn btn-ghost btn-sm btn-icon" style={{ color: '#B04A2A' }} onClick={(e) => deleteCourse(c, e)} title="Xóa"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
      {courses.length > 0 && shown.length === 0 && <div className="list-empty">Không có khóa học nào khớp “{q}”</div>}

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={editing ? 'Chỉnh sửa khóa học' : 'Tạo khóa học mới'}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setModal(false)}>Hủy</button>
            <button className="btn btn-primary" onClick={saveCourse} disabled={loading}>
              {loading ? 'Đang lưu...' : editing ? 'Lưu' : 'Tạo'}
            </button>
          </>
        }
      >
        <div className="form-group">
          <label className="label">Tiêu đề khóa học *</label>
          <input className="input" placeholder="vd: Toán lớp 7" value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </div>
        <div className="form-group">
          <label className="label">Mô tả</label>
          <textarea className="input" placeholder="Mô tả khóa học..." value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
        </div>
        <div className="form-group">
          <label className="label">Ảnh đại diện</label>
          <div className="dropzone" onClick={() => fileRef.current?.click()}>
            {preview ? (
              <img src={preview} alt="preview" style={{ maxHeight: 120, borderRadius: 6, objectFit: 'contain' }} />
            ) : (
              <div style={{ fontSize: '0.88rem' }}>Click để chọn ảnh</div>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) { setFile(f); setPreview(URL.createObjectURL(f)); }
          }} />
        </div>
      </Modal>
    </div>
  );
}
