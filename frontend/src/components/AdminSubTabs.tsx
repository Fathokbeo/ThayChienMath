import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { adminGroupFor, isNavActive } from '../lib/navigation';

// Tab con của mục quản trị đã gộp (vd "Trang web" = Đề thi · Tin tức & thông tin · Ảnh quảng cáo).
// Kiểu nút chọn đoạn (segmented control) ngay trên tiêu đề trang; điện thoại kéo ngang được nếu không đủ chỗ.
export default function AdminSubTabs() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  if (user?.role !== 'admin') return null;
  const group = adminGroupFor(pathname);
  if (!group) return null;
  return (
    <nav className="subtabs" aria-label="Mục con">
      {group.map((t) => {
        const on = isNavActive(t, pathname);
        const Icon = t.icon;
        return (
          <Link key={t.to} to={t.to} className={`subtab ${on ? 'active' : ''}`} aria-current={on ? 'page' : undefined}>
            <Icon size={15} strokeWidth={2} />
            <span className="subtab-long">{t.label}</span><span className="subtab-short">{t.short || t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
