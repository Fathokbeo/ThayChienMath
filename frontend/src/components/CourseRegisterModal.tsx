import { useEffect, useState } from 'react';
import { CheckCircle2, CalendarClock } from 'lucide-react';
import Modal from './Modal';
import api from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { fmtSlot, fmtSlotTime, type PlacementSlot } from '../lib/publicSite';
import { DEFAULT_REG_FIELDS, toRegForm, type RegField } from '../lib/registrationForm';
import RegFieldInput, { RegFieldLabel, type RegValue } from './RegFieldInput';

type Course = { id: number; title: string; price?: string | null };

// Đăng ký học 1 khóa từ trang công khai (khách không cần tài khoản): thông tin học sinh + chọn ca thi thử
// đầu vào do admin mở. Đơn gửi về trang "Đăng ký học" của admin.
export default function CourseRegisterModal({ course, onClose }: { course: Course | null; onClose: () => void }) {
  const { user } = useAuth();
  const [slots, setSlots] = useState<PlacementSlot[] | null>(null);
  const [fields, setFields] = useState<RegField[]>(DEFAULT_REG_FIELDS);
  const [intro, setIntro] = useState('');
  const [form, setForm] = useState<Record<string, RegValue>>({});
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<{ slot_start_at: string | null } | null>(null);

  useEffect(() => {
    if (!course) return;
    setForm({ slot_id: '', student_name: user?.role === 'student' ? user.full_name : '' });
    setError(''); setDone(null); setSlots(null);
    api.get('/public/placement-slots').then((r) => setSlots(r.data)).catch(() => setSlots([]));
    api.get('/public/registration-form').then((r) => { const f = toRegForm(r.data); setFields(f.fields); setIntro(f.intro); }).catch(() => {});
  }, [course?.id]);

  const set = (k: string) => (v: RegValue) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    // Hộp kiểm bắt buộc: trình duyệt không tự kiểm (required trên checkbox nghĩa là phải tick ô đó)
    const missing = fields.find((f) => f.type === 'checkbox' && f.required && !(Array.isArray(form[f.key]) && (form[f.key] as string[]).length));
    if (missing) { setError(`Vui lòng chọn ${missing.label.toLowerCase()}`); return; }
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
          <p style={{ margin: '0 0 6px', fontWeight: 600 }}>Cảm ơn phụ huynh đã đăng ký cho {form.student_name || 'con'}!</p>
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
          {intro && <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.9rem', color: '#515154', lineHeight: 1.55 }}>{intro}</div>}
          {fields.filter((f) => f.key !== 'note').map((f) => (
            <div key={f.key} className="form-field">
              <RegFieldLabel f={f} />
              <RegFieldInput f={f} value={form[f.key]} onChange={set(f.key)} />
            </div>
          ))}
          <label className="form-field">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><CalendarClock size={14} /> Lịch thi thử đầu vào {hasSlots ? '*' : ''}</span>
            {slots === null ? (
              <div style={{ color: '#86868B', fontSize: '0.88rem' }}>Đang tải lịch thi...</div>
            ) : hasSlots ? (
              <select className="input" value={(form.slot_id as string) || ''} onChange={(e) => set('slot_id')(e.target.value)} required>
                <option value="">— Chọn ca thi —</option>
                {slots.map((s) => <option key={s.id} value={s.id} disabled={s.remaining === 0}>{fmtSlot(s)}</option>)}
              </select>
            ) : (
              <div style={{ color: '#6E6E73', fontSize: '0.88rem', background: '#F5F5F7', borderRadius: 10, padding: '0.6rem 0.8rem' }}>
                Hiện chưa có lịch thi thử. Trung tâm sẽ gọi điện hẹn lịch sau khi nhận đăng ký.
              </div>
            )}
          </label>
          {/* Ô ghi chú (nếu admin bật) luôn để cuối, sau phần chọn ca thi */}
          {fields.filter((f) => f.key === 'note').map((f) => (
            <div key={f.key} className="form-field">
              <RegFieldLabel f={f} />
              <RegFieldInput f={f} value={form[f.key]} onChange={set(f.key)} />
            </div>
          ))}
          {error && <div style={{ color: '#B04A2A', fontSize: '0.88rem' }}>{error}</div>}
          <button type="submit" className="btn btn-primary" disabled={sending} style={{ marginTop: 4 }}>
            {sending ? 'Đang gửi...' : 'Gửi đăng ký'}
          </button>
        </form>
      )}
    </Modal>
  );
}
