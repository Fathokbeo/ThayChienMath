import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { navItemsFor, navEnd, roleColors } from '../lib/navigation';
import AccountMenu from './AccountMenu';
import { openPalette } from './CommandPalette';
import { useBrandName } from '../lib/brand';

// Thanh điều hướng ngang trên cùng: logo · các mục chính · tìm nhanh (Ctrl+K) · ảnh đại diện (menu tài khoản).
// Trên điện thoại các mục chính chuyển xuống thanh dưới đáy (TabBar).
export default function TopNav() {
  const { user } = useAuth();
  const brand = useBrandName();
  const [menuOpen, setMenuOpen] = useState(false);
  const [bg, fg] = roleColors(user?.role);
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

  return (
    <header className="topnav">
      <div className="topnav-inner">
        <Link to={`/${user?.role || ''}`} className="topnav-brand">
          <img src="/logo.png" alt="" style={{ width: 28, height: 28, borderRadius: 7 }} />
          <span>{brand}</span>
        </Link>

        <nav className="topnav-links" aria-label="Điều hướng chính">
          {navItemsFor(user?.role).map(({ to, label }) => (
            <NavLink key={to} to={to} end={navEnd(to)} className={({ isActive }) => `topnav-link ${isActive ? 'active' : ''}`}>
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="topnav-actions">
          <button className="search-pill" onClick={openPalette} title="Tìm nhanh">
            <Search size={16} />
            <span className="search-text">Tìm nhanh</span>
            <span className="kbd">{isMac ? '⌘' : 'Ctrl'} K</span>
          </button>
          <div style={{ position: 'relative' }}>
            <button data-menu-toggle className="icon-btn" style={{ width: 'auto', height: 'auto', padding: 2 }}
              onClick={() => setMenuOpen((v) => !v)} title="Tài khoản" aria-haspopup="menu" aria-expanded={menuOpen}>
              <span className="avatar" style={{ background: bg, color: fg }}>{user?.full_name?.[0] || 'U'}</span>
            </button>
            <AccountMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
          </div>
        </div>
      </div>
    </header>
  );
}
