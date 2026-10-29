import { useEffect, useState } from 'react';
import { Phone, Trash2, Plus, Edit, CalendarClock, MapPin, Users, Eye, EyeOff } from 'lucide-react';
import api from '../../lib/api';
import Modal from '../../components/Modal';
import { toast } from '../../components/Toast';
import { PageHeader, EmptyState } from '../../components/ui';
import { fmtSlotTime } from '../../lib/publicSite';

type Reg = {
  id: number; course_title: string | null; student_name: string; parent_phone: string; school: string; class_name: string;
  last_score: number | null; slot_start_at: string | null; note: string | null; status: string; admin_note: string | null; created_at: string;
};
type Slot = { id: number; start_at: string; location: string | null; capacity: number | null; note: string | null; active: number; taken: number };

const STATUS: Record<string, { label: string; badge: string }> = {
  new: { label: 'Mới', badge: 'badge-orange' },
  contacted: { label: 'Đã liên hệ', badge: 'badge-blue' },
  enrolled: { label: 'Đã xếp lớp', badge: 'badge-green' },
  cancelled: { label: 'Hủy', badge: 'badge-gray' },
};
// created_at của SQLite là giờ UTC dạng "YYYY-MM-DD HH:MM:SS"
const fmtCreated = (v: string) => new Date(v.replace(' ', 'T') + 'Z').toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });
// ISO (UTC) → giá trị cho ô datetime-local (giờ máy người dùng)
const toLocalInput = (iso: string) => { const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };

// Đăng ký học từ trang chủ: danh sách đơn (gọi điện, đổi trạng thái, ghi chú) + quản lý ca thi thử đầu vào
export default function Registrations() {
  const [tab, setTab] = useState<'regs' | 'slots'>('regs');
  const [filter, setFilter] = useState('');
  const [regs, setRegs] = useState<Reg[] | null>(null);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [slotModal, setSlotModal] = useState<Slot | 'new' | null>(null);
  const [slotForm, setSlotForm] = useState({ start_at: '', location: '', capacity: '', note: '' });

  const loadRegs = () => api.get('/admin/site/registrations').then((r) => setRegs(r.data)).catch(() => setRegs([]));
  const loadSlots = () => api.get('/admin/site/slots').then((r) => setSlots(r.data)).catch(() => setSlots([]));
  useEffect(() => { loadRegs(); loadSlots(); }, []);

  const updateReg = async (r: Reg, patch: Partial<Reg>) => {
    setRegs((list) => list && list.map((x) => (x.id === r.id ? { ...x, ...patch } : x)));
    try { await api.put(`/admin/site/registrations/${r.id}`, patch); }
    catch (e: any) { toast.error(e.response?.data?.message || 'Lỗi'); loadRegs(); }
  };
  const deleteReg = async (r: Reg) => {
    if (!confirm(`Xóa đơn của ${r.student_name}?`)) return;
    await api.delete(`/admin/site/registrations/${r.id}`);
    toast.success('Đã xóa đơn');
    loadRegs();
  };

  const openSlot = (s: Slot | 'new') => {
    setSlotForm(s === 'new'
      ? { start_at: '', location: '', capacity: '', note: '' }
      : { start_at: toLocalInput(s.start_at), location: s.location || '', capacity: s.capacity == null ? '' : String(s.capacity), note: s.note || '' });
    setSlotModal(s);
  };
  const saveSlot = async () => {
    if (!slotForm.start_at) { toast.error('Chọn ngày giờ thi'); return; }
    const body = { ...slotForm, start_at: new Date(slotForm.start_at).toISOString() };
    try {
      if (slotModal === 'new') await api.post('/admin/site/slots', body);
      else await api.put(`/admin/site/slots/${(slotModal as Slot).id}`, body);
      toast.success('Đã lưu ca thi');
      setSlotModal(null);
      loadSlots();
    } catch (e: any) { toast.error(e.response?.data?.message || 'Lỗi'); }
  };
  const toggleSlot = async (s: Slot) => { await api.put(`/admin/site/slots/${s.id}`, { active: !s.active }); loadSlots(); };
  const deleteSlot = async (s: Slot) => {
    if (!confirm('Xóa ca thi này? Các đơn đã chọn ca vẫn giữ giờ thi.')) return;
    await api.delete(`/admin/site/slots/${s.id}`);
    loadSlots();
  };

  const newCount = regs?.filter((r) => r.status === 'new').length || 0;
  const shown = (regs || []).filter((r) => !filter || r.status === filter);
  const now = Date.now();

  return (
    <div className="fade-in">
      <PageHeader title="Đăng ký học" subtitle="Đơn đăng ký từ trang chủ và lịch thi thử đầu vào."
        actions={tab === 'slots' && <button className="btn btn-primary" onClick={() => openSlot('new')}><Plus size={16} /> Thêm ca thi</button>} />

      <div className="grade-chips" style={{ marginBottom: 16 }}>
        <button className={`ph-chip ${tab === 'regs' ? 'active' : ''}`} onClick={() => setTab('regs')}>
          Đơn đăng ký {newCount > 0 && <span className="ph-badge">{newCount}</span>}
        </button>
        <button className={`ph-chip ${tab === 'slots' ? 'active' : ''}`} onClick={() => setTab('slots')}>Ca thi thử</button>
      </div>

      {tab === 'regs' ? (
        <>
          <div className="grade-chips" style={{ marginBottom: 14 }}>
            {[['', 'Tất cả'], ...Object.entries(STATUS).map(([k, v]) => [k, v.label])].map(([k, label]) => (
              <button key={k} className={`ph-chip ${filter === k ? 'active' : ''}`} style={{ fontSize: '0.84rem', padding: '5px 12px', whiteSpace: 'nowrap' }} onClick={() => setFilter(k)}>{label}</button>
            ))}
          </div>
          {regs === null ? <div style={{ color: '#86868B' }}>Đang tải...</div> : shown.length === 0 ? (
            <EmptyState title="Chưa có đơn đăng ký" text="Khi phụ huynh bấm Đăng ký ở trang chủ, đơn sẽ hiện ở đây." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {shown.map((r) => (
                <div key={r.id} className="card" style={{ padding: '1rem 1.1rem', borderLeft: r.status === 'new' ? '3px solid #D0864F' : undefined }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <strong style={{ fontSize: '1rem' }}>{r.student_name}</strong>
                        <span className={`badge ${STATUS[r.status]?.badge || 'badge-gray'}`}>{STATUS[r.status]?.label || r.status}</span>
                      </div>
                      <div style={{ fontSize: '0.85rem', color: '#6E6E73', marginTop: 3 }}>
                        Lớp {r.class_name} · {r.school} · Điểm Toán kỳ trước: <strong style={{ color: '#1D1D1F' }}>{r.last_score ?? '—'}</strong>
                      </div>
                    </div>
                    <button className="btn btn-ghost btn-sm btn-icon" title="Xóa đơn" onClick={() => deleteReg(r)}><Trash2 size={15} /></button>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', fontSize: '0.85rem', marginTop: 8 }}>
                    <a href={`tel:${r.parent_phone}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#3A7D5C', fontWeight: 700, textDecoration: 'none' }}><Phone size={14} /> {r.parent_phone}</a>
                    <span>Khóa: <strong>{r.course_title || '—'}</strong></span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><CalendarClock size={14} color="#2F6F82" /> {r.slot_start_at ? fmtSlotTime(r.slot_start_at) : 'Chưa chọn ca thi'}</span>
                  </div>
                  {r.note && <div style={{ fontSize: '0.85rem', color: '#515154', marginTop: 6 }}>Ghi chú của phụ huynh: {r.note}</div>}
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 10 }}>
                    <select className="input" value={r.status} onChange={(e) => updateReg(r, { status: e.target.value })} style={{ width: 'auto', minHeight: 38, padding: '0 10px' }}>
                      {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                    <input className="input" defaultValue={r.admin_note || ''} placeholder="Ghi chú nội bộ (vd đã gọi, hẹn lại...)"
                      onBlur={(e) => { if (e.target.value !== (r.admin_note || '')) updateReg(r, { admin_note: e.target.value }); }}
                      style={{ flex: '1 1 200px', minHeight: 38 }} />
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#A1A1A6', marginTop: 6 }}>Gửi lúc {fmtCreated(r.created_at)}</div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : slots === null ? <div style={{ color: '#86868B' }}>Đang tải...</div> : slots.length === 0 ? (
        <EmptyState title="Chưa có ca thi thử" text="Thêm ca thi để phụ huynh chọn khi đăng ký. Chưa có ca nào thì đơn vẫn gửi được, trung tâm gọi lại hẹn lịch."
          action={<button className="btn btn-primary" onClick={() => openSlot('new')}><Plus size={16} /> Thêm ca thi</button>} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {slots.map((s) => {
            const past = new Date(s.start_at).getTime() < now;
            return (
              <div key={s.id} className="card" style={{ padding: '0.9rem 1.1rem', opacity: past || !s.active ? 0.6 : 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                    <div style={{ fontWeight: 700 }}>{fmtSlotTime(s.start_at)} {past && <span className="badge badge-gray">Đã qua</span>} {!s.active && <span className="badge badge-gray">Đang ẩn</span>}</div>
                    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: '0.85rem', color: '#6E6E73', marginTop: 3 }}>
                      {s.location && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><MapPin size={13} /> {s.location}</span>}
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Users size={13} /> {s.taken}{s.capacity != null ? `/${s.capacity}` : ''} đã đăng ký</span>
                      {s.note && <span>{s.note}</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-ghost btn-sm btn-icon" title={s.active ? 'Ẩn ca này' : 'Hiện lại'} onClick={() => toggleSlot(s)}>{s.active ? <EyeOff size={15} /> : <Eye size={15} />}</button>
                    <button className="btn btn-ghost btn-sm btn-icon" title="Sửa" onClick={() => openSlot(s)}><Edit size={15} /></button>
                    <button className="btn btn-ghost btn-sm btn-icon" title="Xóa" onClick={() => deleteSlot(s)}><Trash2 size={15} /></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={!!slotModal} onClose={() => setSlotModal(null)} title={slotModal === 'new' ? 'Thêm ca thi thử' : 'Sửa ca thi thử'}
        footer={<><button className="btn btn-ghost" onClick={() => setSlotModal(null)}>Hủy</button><button className="btn btn-primary" onClick={saveSlot}>Lưu</button></>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label className="form-field"><span>Ngày giờ thi *</span>
            <input className="input" type="datetime-local" value={slotForm.start_at} onChange={(e) => setSlotForm({ ...slotForm, start_at: e.target.value })} /></label>
          <label className="form-field"><span>Địa điểm</span>
            <input className="input" value={slotForm.location} onChange={(e) => setSlotForm({ ...slotForm, location: e.target.value })} placeholder="vd Cơ sở 1 — 12 Trần Phú" /></label>
          <label className="form-field"><span>Số chỗ tối đa (để trống = không giới hạn)</span>
            <input className="input" type="number" min={1} value={slotForm.capacity} onChange={(e) => setSlotForm({ ...slotForm, capacity: e.target.value })} /></label>
          <label className="form-field"><span>Ghi chú</span>
            <input className="input" value={slotForm.note} onChange={(e) => setSlotForm({ ...slotForm, note: e.target.value })} placeholder="vd Mang bút, máy tính cầm tay" /></label>
        </div>
      </Modal>
    </div>
  );
}
