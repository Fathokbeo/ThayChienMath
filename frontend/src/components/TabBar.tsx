import { NavLink } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { navItemsFor, navEnd } from '../lib/navigation';

// Thanh điều hướng dưới đáy (chỉ hiện trên điện thoại, xem .tabbar trong index.css) — bấm bằng một ngón tay:
// tối đa 4 mục chính của vai trò + "Thêm" mở thanh bên đầy đủ (các mục còn lại, trang chủ, đăng xuất).
export default function TabBar({ onMore, moreOpen }: { onMore: () => void; moreOpen: boolean }) {
  const { user } = useAuth();
  const items = navItemsFor(user?.role).slice(0, 4);

  return (
    <nav className="tabbar" aria-label="Điều hướng chính">
      {items.map(({ to, icon: Icon, short }) => (
        <NavLink key={to} to={to} end={navEnd(to)} className={({ isActive }) => `tabbar-item ${isActive && !moreOpen ? 'active' : ''}`}>
          <Icon size={23} strokeWidth={2} />
          <span>{short}</span>
        </NavLink>
      ))}
      <button type="button" className={`tabbar-item ${moreOpen ? 'active' : ''}`} onClick={onMore}>
        <Menu size={23} strokeWidth={2} />
        <span>Thêm</span>
      </button>
    </nav>
  );
}
