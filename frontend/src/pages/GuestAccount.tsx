import { Link } from 'react-router-dom';
import { FileStack, Newspaper, BookOpen, LogOut, Mail } from 'lucide-react';
import PublicLayout from '../components/PublicLayout';
import { useAuth } from '../contexts/AuthContext';
import { PAGE_MAX } from '../lib/layout';
import useIsMobile from '../lib/useIsMobile';

const SHORTCUTS = [
  { to: '/de-thi', icon: FileStack, title: 'Kho đề', sub: 'Xem và tải đề theo từng lớp', color: '#1F5C68' },
  { to: '/tin-tuc', icon: Newspaper, title: 'Tin tức', sub: 'Thông báo, lịch khai giảng, thành tích', color: '#2F6F82' },
  { to: '/#khoa-hoc', icon: BookOpen, title: 'Khóa học & đăng ký', sub: 'Học phí, đăng ký thi thử đầu vào', color: '#3A7D5C' },
];

// Trang "Tài khoản của tôi" của khách (tự đăng ký / đăng nhập Google): thông tin tài khoản + lối tắt.
export default function GuestAccount() {
  const { user, logout } = useAuth();
  const isMobile = useIsMobile();
  if (!user) return null;

  return (
    <PublicLayout>
      <section style={{ maxWidth: PAGE_MAX, margin: '0 auto', padding: isMobile ? '1.5rem 16px 2.5rem' : '2.5rem 22px 3rem' }}>
        <div style={{ background: '#fff', borderRadius: 20, padding: isMobile ? '1.25rem' : '1.6rem 1.8rem', display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
          {user.avatar_url
            ? <img src={user.avatar_url} alt="" referrerPolicy="no-referrer" style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover' }} />
            : <span style={{ width: 64, height: 64, borderRadius: '50%', background: '#F0F0F3', color: '#515154', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.6rem', fontWeight: 700 }}>{user.full_name?.[0] || 'K'}</span>}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.8rem', color: '#86868B', fontWeight: 600 }}>Tài khoản khách</div>
            <h1 style={{ margin: '2px 0 4px', fontSize: isMobile ? '1.4rem' : '1.7rem', fontWeight: 700, letterSpacing: '-0.02em' }}>Xin chào, {user.full_name}</h1>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#6E6E73', fontSize: '0.9rem' }}><Mail size={15} /> {user.email || user.username}</div>
          </div>
          <button type="button" className="btn btn-ghost" style={{ color: '#B04A2A' }} onClick={logout}><LogOut size={16} /> Đăng xuất</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))', gap: 14, marginTop: 16 }}>
          {SHORTCUTS.map(({ to, icon: Icon, title, sub, color }) => (
            <Link key={to} to={to} style={{ background: '#fff', borderRadius: 18, padding: '1.2rem 1.25rem', textDecoration: 'none', color: '#1D1D1F', display: 'flex', gap: 14, alignItems: 'center' }}>
              <span style={{ width: 44, height: 44, borderRadius: 12, background: '#E6F0F2', color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon size={22} /></span>
              <span>
                <span style={{ display: 'block', fontWeight: 700 }}>{title}</span>
                <span style={{ display: 'block', fontSize: '0.84rem', color: '#86868B' }}>{sub}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>
    </PublicLayout>
  );
}
