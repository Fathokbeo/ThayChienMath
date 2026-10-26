import { useEffect, useState } from 'react';
import { Copy, KeyRound, MessageSquareQuote, HeartHandshake } from 'lucide-react';
import api from '../lib/api';
import Modal from './Modal';
import { toast } from './Toast';

// Giáo viên xem tài khoản phụ huynh của 1 học sinh (tự tạo cùng học sinh), đặt lại mật khẩu phụ huynh,
// và viết nhận xét tổng quát gửi phụ huynh (hiện ở trang của phụ huynh).
export default function ParentInfoModal({ classId, student, onClose, onSaved }: {
  classId: string | number;
  student: any | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [comment, setComment] = useState('');
  const [newPw, setNewPw] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { setComment(student?.comment || ''); setNewPw(''); }, [student]);
  if (!student) return null;

  const loginText = `Đăng nhập web Thầy Chiến Math, chọn mục "Phụ huynh"\nTên đăng nhập: ${student.username}\nMật khẩu: ${student.parent_password || '(đã đổi)'}`;
  const copy = () => navigator.clipboard?.writeText(loginText).then(() => toast.success('Đã sao chép thông tin đăng nhập'), () => toast.error('Không sao chép được'));

  const saveComment = async () => {
    setSaving(true);
    try {
      await api.put(`/teacher/classes/${classId}/students/${student.id}/comment`, { comment });
      toast.success(comment.trim() ? 'Đã lưu nhận xét' : 'Đã xóa nhận xét');
      onSaved(); onClose();
    } catch (e: any) { toast.error(e.response?.data?.message || 'Lỗi'); } finally { setSaving(false); }
  };

  const resetPw = async () => {
    try {
      await api.put(`/teacher/students/${student.id}/parent-password`, { password: newPw });
      toast.success('Đã đặt lại mật khẩu phụ huynh');
      setNewPw(''); onSaved();
    } catch (e: any) { toast.error(e.response?.data?.message || 'Lỗi'); }
  };

  return (
    <Modal open onClose={onClose} title={`Phụ huynh của ${student.full_name}`}
      footer={<><button className="btn btn-ghost" onClick={onClose}>Đóng</button><button className="btn btn-primary" onClick={saveComment} disabled={saving}>Lưu nhận xét</button></>}>
      <div style={{ background: '#F5F5F7', borderRadius: 12, padding: '0.9rem 1rem', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, marginBottom: 8 }}><HeartHandshake size={16} color="#B8673E" /> Tài khoản phụ huynh</div>
        <div style={{ fontSize: '0.9rem', lineHeight: 1.7 }}>
          Mục đăng nhập: <strong>Phụ huynh</strong><br />
          Tên đăng nhập: <strong style={{ fontFamily: 'monospace' }}>{student.username}</strong> <span style={{ color: '#86868B' }}>(tên đăng nhập của con)</span><br />
          Mật khẩu: <strong style={{ fontFamily: 'monospace' }}>{student.parent_password || '—'}</strong>
          {student.parent_phone && student.parent_password === String(student.parent_phone).replace(/\D/g, '') && <span style={{ color: '#86868B' }}> (SĐT phụ huynh)</span>}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          <button className="btn btn-secondary btn-sm" onClick={copy}><Copy size={13} /> Sao chép để gửi phụ huynh</button>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <input className="input" style={{ flex: 1 }} placeholder="Mật khẩu phụ huynh mới (ít nhất 6 ký tự)" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
          <button className="btn btn-outline btn-sm" disabled={newPw.trim().length < 6} onClick={resetPw}><KeyRound size={13} /> Đặt lại</button>
        </div>
      </div>

      <div className="form-group" style={{ marginBottom: 0 }}>
        <label className="label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><MessageSquareQuote size={15} color="#1F5C68" /> Nhận xét tổng quát gửi phụ huynh</label>
        <textarea className="input" rows={5} maxLength={2000} value={comment} onChange={(e) => setComment(e.target.value)}
          placeholder="Vd: Con chăm chỉ, nộp bài đầy đủ. Phần hình học còn yếu, gia đình nhắc con làm thêm bài tập chương 2." />
        <div style={{ fontSize: '0.78rem', color: '#86868B', marginTop: 4 }}>Phụ huynh thấy ngay ở trang Tổng quan. Để trống rồi lưu = xóa nhận xét.</div>
      </div>
    </Modal>
  );
}
