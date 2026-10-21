import { useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Home, LogOut, Search } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { navItemsFor, ROLE_LABEL, roleColors } from '../lib/navigation';
import { openPalette } from './CommandPalette';

// Menu tài khoản (mở từ ảnh đại diện trên thanh trên, hoặc nút "Thêm" ở thanh dưới trên điện thoại):
// thông tin người dùng, toàn bộ mục điều hướng, tìm nhanh, trang chủ, đăng xuất.
export default function AccountMenu({ open, onClose, showNav }: { open: boolean; onClose: () => void; showNav?: boolean }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (ref.current && !ref.current.contains(t) && !t.closest('[data-menu-toggle]')) onClose();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open, onClose]);

  if (!open || !user) return null;
  const [bg, fg] = roleColors(user.role);

  return (
    <div ref={ref} className="menu-panel" role="menu">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px 10px' }}>
        <span className="avatar" style={{ width: 38, height: 38, background: bg, color: fg }}>{user.full_name?.[0] || 'U'}</span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.full_name}</div>
          <div style={{ fontSize: '0.8rem', color: '#86868B' }}>{ROLE_LABEL[user.role]} · {user.username}</div>
        </div>
      </div>
      <div className="menu-sep" />
      {showNav && (
        <>
          {navItemsFor(user.role).map(({ to, icon: Icon, label }) => (
            <Link key={to} to={to} className="menu-item" onClick={onClose}><Icon size={17} /> {label}</Link>
          ))}
          <div className="menu-sep" />
        </>
      )}
      <button className="menu-item" onClick={() => { onClose(); openPalette(); }}><Search size={17} /> Tìm nhanh</button>
      <Link to="/" className="menu-item" onClick={onClose}><Home size={17} /> Trang chủ</Link>
      <button className="menu-item" style={{ color: '#B04A2A' }} onClick={() => { onClose(); logout(); navigate('/login'); }}>
        <LogOut size={17} color="#B04A2A" /> Đăng xuất
      </button>
    </div>
  );
}
