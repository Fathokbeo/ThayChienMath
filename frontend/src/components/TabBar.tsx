import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { navItemsFor, isNavActive } from '../lib/navigation';
import AccountMenu from './AccountMenu';

// Thanh điều hướng dưới đáy (chỉ hiện trên điện thoại, xem .tabbar trong index.css) — bấm bằng một ngón tay:
// tối đa 4 mục chính của vai trò + "Thêm" mở menu đầy đủ (mục còn lại, tìm nhanh, trang chủ, đăng xuất).
export default function TabBar() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const items = navItemsFor(user?.role).slice(0, 4);

  return (
    <>
      <nav className="tabbar" aria-label="Điều hướng chính">
        {items.map((item) => { const { to, icon: Icon, short } = item; return (
          <Link key={to} to={to} onClick={() => setMoreOpen(false)}
            className={`tabbar-item ${isNavActive(item, pathname) && !moreOpen ? 'active' : ''}`}>
            <Icon size={22} strokeWidth={1.9} />
            <span>{short}</span>
          </Link>
        ); })}
        <button type="button" data-menu-toggle className={`tabbar-item ${moreOpen ? 'active' : ''}`} onClick={() => setMoreOpen((v) => !v)}>
          <Menu size={22} strokeWidth={1.9} />
          <span>Thêm</span>
        </button>
      </nav>
      <AccountMenu open={moreOpen} onClose={() => setMoreOpen(false)} showNav />
    </>
  );
}
