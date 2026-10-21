import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { navItemsFor, navEnd } from '../lib/navigation';
import AccountMenu from './AccountMenu';

// Thanh điều hướng dưới đáy (chỉ hiện trên điện thoại, xem .tabbar trong index.css) — bấm bằng một ngón tay:
// tối đa 4 mục chính của vai trò + "Thêm" mở menu đầy đủ (mục còn lại, tìm nhanh, trang chủ, đăng xuất).
export default function TabBar() {
  const { user } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);
  const items = navItemsFor(user?.role).slice(0, 4);

  return (
    <>
      <nav className="tabbar" aria-label="Điều hướng chính">
        {items.map(({ to, icon: Icon, short }) => (
          <NavLink key={to} to={to} end={navEnd(to)} onClick={() => setMoreOpen(false)}
            className={({ isActive }) => `tabbar-item ${isActive && !moreOpen ? 'active' : ''}`}>
            <Icon size={22} strokeWidth={1.9} />
            <span>{short}</span>
          </NavLink>
        ))}
        <button type="button" data-menu-toggle className={`tabbar-item ${moreOpen ? 'active' : ''}`} onClick={() => setMoreOpen((v) => !v)}>
          <Menu size={22} strokeWidth={1.9} />
          <span>Thêm</span>
        </button>
      </nav>
      <AccountMenu open={moreOpen} onClose={() => setMoreOpen(false)} showNav />
    </>
  );
}
