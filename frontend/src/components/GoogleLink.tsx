import { useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import api from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import type { User } from '../contexts/AuthContext';
import GoogleSignInButton from './GoogleSignInButton';
import Modal from './Modal';
import { toast } from './Toast';

// Liên kết tài khoản Google với tài khoản đang đăng nhập (mọi vai trò). Sau khi liên kết, đăng nhập được
// bằng nút Google ở trang đăng nhập (đúng mục của mình) — mật khẩu cũ vẫn dùng bình thường.

type Status = { linked: boolean; google_email: string | null; user: User };

export function GoogleLinkPanel() {
  const { updateUser } = useAuth();
  const [status, setStatus] = useState<Status | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [password, setPassword] = useState('');
  const [pwError, setPwError] = useState('');

  const apply = (s: Status) => { setStatus(s); updateUser(s.user); };

  useEffect(() => {
    api.get('/auth/google-link').then((r) => apply(r.data)).catch(() => setLoadError(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onCredential = async (credential: string) => {
    setBusy(true);
    try {
      const { data } = await api.post('/auth/google-link', { credential });
      apply(data);
      toast.success(`Đã liên kết với ${data.google_email}`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Liên kết Google không thành công');
    } finally { setBusy(false); }
  };

  const unlink = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError('');
    if (!password) { setPwError('Nhập mật khẩu để xác nhận'); return; }
    setBusy(true);
    try {
      const { data } = await api.post('/auth/google-unlink', { password });
      apply(data);
      setUnlinking(false); setPassword('');
      toast.success('Đã hủy liên kết Google');
    } catch (err: any) {
      setPwError(err.response?.data?.message || 'Hủy liên kết không thành công');
    } finally { setBusy(false); }
  };

  if (loadError) return <p style={{ margin: 0, color: '#B04A2A', fontSize: '0.9rem' }}>Không tải được trạng thái liên kết — thử tải lại trang.</p>;
  if (!status) return <p style={{ margin: 0, color: '#86868B', fontSize: '0.9rem' }}>Đang tải…</p>;

  if (!status.linked) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p style={{ margin: 0, color: '#515154', fontSize: '0.92rem', lineHeight: 1.5 }}>
          Liên kết một tài khoản Google để lần sau chỉ cần bấm <b>“Đăng nhập bằng Google”</b>, không phải nhớ mật khẩu.
          Mật khẩu hiện tại vẫn dùng được như cũ.
        </p>
        <div style={{ opacity: busy ? 0.5 : 1, pointerEvents: busy ? 'none' : undefined }}>
          <GoogleSignInButton onCredential={onCredential} text="continue_with" />
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#EEF6F0', color: '#2F6B45', borderRadius: 12, padding: '10px 12px', fontSize: '0.92rem' }}>
        <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
        <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>Đã liên kết với <b>{status.google_email || 'tài khoản Google'}</b></span>
      </div>
      {!unlinking ? (
        <button type="button" className="btn btn-ghost" style={{ alignSelf: 'flex-start', color: '#B04A2A' }} onClick={() => setUnlinking(true)}>
          Hủy liên kết
        </button>
      ) : (
        <form onSubmit={unlink} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ fontSize: '0.88rem', color: '#515154' }}>Nhập mật khẩu tài khoản để xác nhận hủy liên kết</label>
          <input className="input" type="password" autoComplete="current-password" value={password} autoFocus
            onChange={(e) => { setPassword(e.target.value); if (pwError) setPwError(''); }} />
          {pwError && <p style={{ margin: 0, color: '#B04A2A', fontSize: '0.84rem' }}>{pwError}</p>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" className="btn btn-primary" disabled={busy} style={{ background: '#B04A2A' }}>Hủy liên kết</button>
            <button type="button" className="btn btn-ghost" onClick={() => { setUnlinking(false); setPassword(''); setPwError(''); }}>Thôi</button>
          </div>
        </form>
      )}
    </div>
  );
}

const OPEN_EVENT = 'tc-open-google-link';
export const openGoogleLink = () => window.dispatchEvent(new Event(OPEN_EVENT));

// Hộp thoại liên kết Google — mở từ menu tài khoản (gắn một lần ở App).
export default function GoogleLinkModal() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, []);
  if (!user) return null;
  return (
    <Modal open={open} onClose={() => setOpen(false)} title="Liên kết tài khoản Google">
      {open && <GoogleLinkPanel />}
    </Modal>
  );
}
