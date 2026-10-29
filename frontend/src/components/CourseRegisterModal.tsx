import { useEffect, useState } from 'react';
import { CheckCircle2, CalendarClock } from 'lucide-react';
import Modal from './Modal';
import api from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { fmtSlot, fmtSlotTime, type PlacementSlot } from '../lib/publicSite';

type Course = { id: number; title: string; price?: string | null };

const EMPTY = { student_name: '', parent_phone: '', school: '', class_name: '', last_score: '', slot_id: '', note: '' };

// Đăng ký học 1 khóa từ trang công khai (khách không cần tài khoản): thông tin học sinh + chọn ca thi thử
// đầu vào do admin mở. Đơn gửi về trang "Đăng ký học" của admin.
export default function CourseRegisterModal({ course, onClose }: { course: Course | null; onClose: () => void }) {
  const { user } = useAuth();
  const [slots, setSlots] = useState<PlacementSlot[] | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<{ slot_start_at: string | null } | null>(null);

  useEffect(() => {
    if (!course) return;
    setForm({ ...EMPTY, student_name: user?.role === 'student' ? user.full_name : '' });
    setError(''); setDone(null); setSlots(null);
    api.get('/public/placement-slots').then((r) => setSlots(r.data)).catch(() => setSlots([]));
  }, [course?.id]);

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSending(true);
    try {
      const { data } = await api.post('/public/registrations', { ...form, course_id: course!.id, slot_id: form.slot_id ? Number(form.slot_id) : null });
      setDone({ slot_start_at: data.slot_start_at });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Gửi đăng ký lỗi, vui lòng thử lại');
      // Ca vừa hết chỗ → tải lại danh sách ca
      api.get('/public/placement-slots').then((r) => setSlots(r.data)).catch(() => {});
    } finally {
      setSending(false);
    }
  };

  const hasSlots = !!slots && slots.length > 0;

  return (
    <Modal open={!!course} onClose={onClose} title={done ? 'Đã gửi đăng ký' : `Đăng ký học: ${course?.title || ''}`}>
      {done ? (
        <div style={{ textAlign: 'center', padding: '0.5rem 0 0.25rem' }}>
          <CheckCircle2 size={44} color="#3A7D5C" style={{ margin: '0 auto 10px' }} />
          <p style={{ margin: '0 0 6px', fontWeight: 600 }}>Cảm ơn phụ huynh đã đăng ký cho {form.student_name}!</p>
          {done.slot_start_at
            ? <p style={{ margin: 0, color: '#515154', lineHeight: 1.55 }}>Lịch thi thử đầu vào: <strong>{fmtSlotTime(done.slot_start_at)}</strong>.<br />Trung tâm sẽ gọi số {form.parent_phone} để xác nhận.</p>
            : <p style={{ margin: 0, color: '#515154', lineHeight: 1.55 }}>Trung tâm sẽ gọi số {form.parent_phone} để hẹn lịch thi thử đầu vào.</p>}
          <button className="btn btn-primary" style={{ marginTop: 18, width: '100%' }} onClick={onClose}>Đóng</button>
        </div>
      ) : (
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {course?.price && (
            <div style={{ background: '#E5F1EA', color: '#2F6B4E', borderRadius: 12, padding: '0.6rem 0.85rem', fontSize: '0.9rem' }}>
              Học phí: <strong>{course.price}</strong>
            </div>
          )}
          <label className="form-field">
            <span>Họ tên học sinh *</span>
            <input className="input" value={form.student_name} onChange={set('student_name')} maxLength={80} required autoComplete="name" />
          </label>
          <label className="form-field">
            <span>Số điện thoại phụ huynh *</span>
            <input className="input" value={form.parent_phone} onChange={set('parent_phone')} inputMode="tel" autoComplete="tel" placeholder="vd 0912 345 678" required />
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 96px', gap: 10 }}>
            <label className="form-field">
              <span>Trường đang học *</span>
              <input className="input" value={form.school} onChange={set('school')} maxLength={120} placeholder="vd THCS Trưng Vương" required />
            </label>
            <label className="form-field">
              <span>Lớp *</span>
              <input className="input" value={form.class_name} onChange={set('class_name')} maxLength={20} placeholder="vd 8A1" required />
            </label>
          </div>
          <label className="form-field">
            <span>Điểm tổng kết môn Toán học kỳ gần nhất *</span>
            <input className="input" value={form.last_score} onChange={set('last_score')} inputMode="decimal" placeholder="vd 8.5" required />
          </label>
          <label className="form-field">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><CalendarClock size={14} /> Lịch thi thử đầu vào {hasSlots ? '*' : ''}</span>
            {slots === null ? (
              <div style={{ color: '#86868B', fontSize: '0.88rem' }}>Đang tải lịch thi...</div>
            ) : hasSlots ? (
              <select className="input" value={form.slot_id} onChange={set('slot_id')} required>
                <option value="">— Chọn ca thi —</option>
                {slots.map((s) => <option key={s.id} value={s.id} disabled={s.remaining === 0}>{fmtSlot(s)}</option>)}
              </select>
            ) : (
              <div style={{ color: '#6E6E73', fontSize: '0.88rem', background: '#F5F5F7', borderRadius: 10, padding: '0.6rem 0.8rem' }}>
                Hiện chưa có lịch thi thử. Trung tâm sẽ gọi điện hẹn lịch sau khi nhận đăng ký.
              </div>
            )}
          </label>
          <label className="form-field">
            <span>Ghi chú (không bắt buộc)</span>
            <textarea className="input" value={form.note} onChange={set('note')} rows={2} maxLength={500} />
          </label>
          {error && <div style={{ color: '#B04A2A', fontSize: '0.88rem' }}>{error}</div>}
          <button type="submit" className="btn btn-primary" disabled={sending} style={{ marginTop: 4 }}>
            {sending ? 'Đang gửi...' : 'Gửi đăng ký'}
          </button>
        </form>
      )}
    </Modal>
  );
}
