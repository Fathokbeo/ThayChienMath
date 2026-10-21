import { NavLink, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, PanelLeftClose, Home } from 'lucide-react';
import { navItemsFor, navEnd, ROLE_LABEL, roleColors } from '../lib/navigation';

interface Props {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

// Thanh bên tối giản: nền trắng trơn, mục menu bo tròn, mục đang mở tô nền teal nhạt.
export default function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }: Props) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = navItemsFor(user?.role);
  const [avatarBg, avatarFg] = roleColors(user?.role);

  return (
    <>
      {/* Lớp phủ khi mở thanh bên trên điện thoại */}
      {mobileOpen && (
        <div className="md:hidden" onClick={onMobileClose}
          style={{ position: 'fixed', inset: 0, background: 'rgba(20,34,40,0.32)', zIndex: 95, animation: 'fadeIn 0.2s ease' }} />
      )}

      <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`} style={{ zIndex: 100 }}>
        {/* Logo */}
        <div className="sidebar-logo">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 11, textDecoration: 'none', minWidth: 0 }} onClick={onMobileClose}>
              <img src="/logo.svg" alt="Thầy Chiến Math" style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0 }} />
              <div style={{ minWidth: 0 }}>
                <div className="display" style={{ color: '#1D2A30', fontWeight: 700, fontSize: '1.08rem', lineHeight: 1.1 }}>Thầy Chiến</div>
                <div style={{ color: '#1F5C68', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', marginTop: 2 }}>Math</div>
              </div>
            </Link>
            <button onClick={onToggle} className="btn btn-icon" title="Thu gọn thanh bên"
              style={{ background: 'transparent', color: '#949A9E', minHeight: 32, minWidth: 32 }}>
              <PanelLeftClose size={18} />
            </button>
          </div>
        </div>

        {/* Người dùng */}
        <div style={{ margin: '0.5rem 0.75rem 0.25rem', padding: '0.7rem 0.75rem', background: '#FAF9F6', borderRadius: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 38, height: 38, borderRadius: '50%', background: avatarBg, color: avatarFg,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '1rem', flexShrink: 0,
          }}>
            {user?.full_name?.[0] || 'U'}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ color: '#1D2A30', fontWeight: 600, fontSize: '0.9rem', lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.full_name}</div>
            <div style={{ fontSize: '0.75rem', color: '#949A9E' }}>{ROLE_LABEL[user?.role || 'student']}</div>
          </div>
        </div>

        {/* Menu */}
        <nav className="sidebar-nav">
          <div className="nav-section">Menu</div>
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} end={navEnd(to)} onClick={onMobileClose}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <Icon size={19} strokeWidth={2} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Cuối thanh */}
        <div style={{ marginTop: 'auto', padding: '0.75rem', borderTop: '1px solid rgba(29,42,48,0.07)' }}>
          <Link to="/" className="nav-item" onClick={onMobileClose}>
            <Home size={19} />
            <span>Trang chủ</span>
          </Link>
          <button onClick={handleLogout} className="nav-item"
            style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', color: '#B04A2A', fontFamily: 'inherit' }}>
            <LogOut size={19} color="#B04A2A" />
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>
    </>
  );
}
