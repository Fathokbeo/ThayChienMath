import { useState, useEffect, useRef, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';
import { PAGE_MAX } from '../lib/layout';
import { Phone, MapPin, Clock, Mail, ExternalLink, Menu, X, LogIn, LogOut, User, ChevronDown, Home, BookOpen, GraduationCap, Trophy, Award, type LucideIcon } from 'lucide-react';

// Các mục của trang chủ — gom vào 1 nút "Trang chủ" thả xuống
const HOME_MENU: { to: string; label: string; sub: string; icon: LucideIcon }[] = [
  { to: '/', label: 'Trang chủ', sub: 'Về đầu trang giới thiệu', icon: Home },
  { to: '/#khoa-hoc', label: 'Khóa học', sub: 'Các khóa học đang mở', icon: BookOpen },
  { to: '/#giao-vien', label: 'Đội ngũ', sub: 'Giáo viên & trợ giảng', icon: GraduationCap },
  { to: '/#hoc-sinh', label: 'Học sinh tiêu biểu', sub: 'Gương mặt xuất sắc', icon: Trophy },
  { to: '/#kinh-nghiem', label: 'Kinh nghiệm & Thành tích', sub: 'Hành trình phát triển', icon: Award },
  { to: '#contact', label: 'Liên hệ', sub: 'Địa chỉ, điện thoại, giờ học', icon: Phone },
];

// Mục trong danh sách thả xuống: "#contact" cuộn trong trang hiện tại, còn lại điều hướng về trang chủ
function MenuLink({ item, onPick, style }: { item: (typeof HOME_MENU)[number]; onPick: () => void; style?: React.CSSProperties }) {
  const Icon = item.icon;
  const inner = (
    <>
      <span style={{ width: 32, height: 32, borderRadius: 9, background: '#E6F0F2', color: '#1F5C68', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={16} />
      </span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', color: '#1D1D1F' }}>{item.label}</span>
        <span style={{ display: 'block', fontSize: '0.78rem', color: '#86868B' }}>{item.sub}</span>
      </span>
    </>
  );
  const css: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 11, padding: '8px 10px', borderRadius: 10, textDecoration: 'none', ...style };
  return item.to.startsWith('#')
    ? <a href={item.to} className="menu-item" style={css} onClick={onPick}>{inner}</a>
    : <Link to={item.to} className="menu-item" style={css} onClick={onPick}>{inner}</Link>;
}

export default function PublicLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const [navOpen, setNavOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [settings, setSettings] = useState<any>({});
  const [homeOpen, setHomeOpen] = useState(false);
  const homeRef = useRef<HTMLDivElement>(null);

  // Đóng danh sách thả xuống khi bấm ra ngoài hoặc nhấn Esc
  useEffect(() => {
    if (!homeOpen) return;
    const onDown = (e: MouseEvent) => { if (homeRef.current && !homeRef.current.contains(e.target as Node)) setHomeOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setHomeOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [homeOpen]);

  useEffect(() => {
    api.get('/public/settings').then((r) => setSettings(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handler);
    return () => window.removeEventListener('scroll', handler);
  }, []);

  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);

  const handleLogout = () => { logout(); setNavOpen(false); };
  const dashLink = user ? `/${user.role}` : '/login';
  // Thanh điều hướng luôn nền trơn; khi cuộn thêm đường viền mảnh
  const solid = true;

  return (
    <div style={{ minHeight: '100vh', background: '#F5F5F7', display: 'flex', flexDirection: 'column' }}>
      {/* Navbar */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: '#FFFFFF',
        borderBottom: `1px solid ${scrolled ? 'rgba(0,0,0,0.12)' : 'rgba(0,0,0,0.06)'}`,
        transition: 'border-color 0.2s', padding: '0 22px',
      }}>
        <div style={{ maxWidth: PAGE_MAX, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 52 }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 9, textDecoration: 'none', color: '#1D1D1F', fontWeight: 700, letterSpacing: '-0.02em' }}>
            <img src="/logo.svg" alt="Thầy Chiến Math" style={{ width: 28, height: 28, borderRadius: 7 }} />
            Thầy Chiến Math
          </Link>

          {/* Desktop nav */}
          <div className="desktop-nav">
            <div ref={homeRef} style={{ position: 'relative' }}
              onMouseEnter={() => setHomeOpen(true)} onMouseLeave={() => setHomeOpen(false)}>
              <button type="button" onClick={() => setHomeOpen((v) => !v)} aria-haspopup="menu" aria-expanded={homeOpen}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4, background: homeOpen ? '#F2F2F4' : 'transparent', border: 'none', cursor: 'pointer',
                  color: '#1D1D1F', fontFamily: 'inherit', fontWeight: 600, fontSize: '0.88rem', padding: '7px 12px', borderRadius: 99,
                }}>
                Trang chủ <ChevronDown size={15} style={{ transition: 'transform 0.2s', transform: homeOpen ? 'rotate(180deg)' : 'none' }} />
              </button>
              {homeOpen && (
                // paddingTop tạo "cầu nối" để rê chuột từ nút xuống danh sách không bị đóng
                <div style={{ position: 'absolute', right: 0, top: '100%', paddingTop: 8, zIndex: 130 }}>
                  <div className="menu-panel" role="menu" style={{ position: 'static', width: 290 }}>
                    {HOME_MENU.map((it, i) => (
                      <div key={it.to}>
                        {i === 1 && <div className="menu-sep" />}
                        <MenuLink item={it} onPick={() => setHomeOpen(false)} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {user ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 8 }}>
                <Link to={dashLink} className="btn btn-primary btn-sm" style={{ gap: 6 }}>
                  <User size={14} />{user.role === 'admin' ? 'Quản trị' : user.role === 'teacher' ? 'Giáo viên' : 'Vào học'}
                </Link>
                <button className="btn btn-ghost btn-sm" style={{ color: solid ? '#515154' : 'white', borderColor: solid ? '#D2D2D7' : 'rgba(255,255,255,0.3)' }} onClick={handleLogout}>
                  <LogOut size={14} /> Đăng xuất
                </button>
              </div>
            ) : (
              <Link to="/login" className="btn btn-primary btn-sm" style={{ marginLeft: 8 }}><LogIn size={14} /> Đăng nhập</Link>
            )}
          </div>

          {/* Mobile hamburger */}
          <button onClick={() => setNavOpen(!navOpen)} style={{ color: solid ? '#2C2C2E' : 'white' }} className="mobile-menu-btn">
            {navOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile menu */}
        {navOpen && (
          <div style={{ background: 'white', borderTop: '1px solid #E8E8ED', padding: '1rem 2rem' }}>
            <div style={{ fontSize: '0.74rem', fontWeight: 600, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '0.2rem 0 0.4rem' }}>Trang chủ</div>
            {HOME_MENU.map((it, i) => (
              <MenuLink key={it.to} item={it} onPick={() => setNavOpen(false)} style={{ marginLeft: i === 0 ? 0 : 14 }} />
            ))}
            <div style={{ height: 1, background: '#E8E8ED', margin: '0.6rem 0' }} />
            {user ? (
              <>
                <Link to={dashLink} onClick={() => setNavOpen(false)} style={{ display: 'block', padding: '0.6rem 0', color: '#1F5C68', fontWeight: 600 }}>Vào hệ thống</Link>
                <button onClick={handleLogout} style={{ background: 'none', border: 'none', padding: '0.6rem 0', color: '#6E6E73', fontWeight: 500, cursor: 'pointer', width: '100%', textAlign: 'left' }}>Đăng xuất</button>
              </>
            ) : (
              <Link to="/login" onClick={() => setNavOpen(false)} style={{ display: 'block', padding: '0.6rem 0', color: '#1F5C68', fontWeight: 600 }}>Đăng nhập</Link>
            )}
          </div>
        )}
      </nav>

      {/* Page content */}
      <div style={{ flex: 1 }}>{children}</div>

      {/* Contact */}
      <section id="contact" style={{ background: '#EEEEF1', padding: '2.5rem 2rem' }}>
        <div style={{ maxWidth: PAGE_MAX, margin: '0 auto' }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '1.25rem', color: '#1D1D1F' }}>
            <Phone size={20} style={{ verticalAlign: 'middle', marginRight: 8, color: '#1F5C68' }} />
            Liên hệ
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            {[
              { icon: MapPin, label: 'Địa chỉ', value: settings.contact_address },
              { icon: Phone, label: 'Điện thoại', value: settings.contact_phone },
              { icon: Mail, label: 'Email', value: settings.contact_email },
              { icon: Clock, label: 'Giờ học', value: settings.contact_hours },
            ].filter(c => c.value).map(({ icon: Icon, label, value }) => (
              <div key={label} style={{ background: 'white', borderRadius: 12, padding: '1.25rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', display: 'flex', gap: 12 }}>
                <div style={{ width: 40, height: 40, background: '#EEF5F6', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={20} color="#1F5C68" />
                </div>
                <div>
                  <div style={{ fontSize: '0.78rem', color: '#86868B', marginBottom: 4 }}>{label}</div>
                  <div style={{ fontWeight: 600, color: '#1D1D1F', fontSize: '0.9rem' }}>{value}</div>
                </div>
              </div>
            ))}
          </div>
          {settings.contact_facebook && (
            <a href={settings.contact_facebook} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm" style={{ marginTop: 16, gap: 6 }}>
              <ExternalLink size={15} /> Fanpage Facebook
            </a>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer style={{ background: '#1F5C68', color: 'rgba(255,255,255,0.7)', textAlign: 'center', padding: '1.5rem', fontSize: '0.82rem' }}>
        © {new Date().getFullYear()} Thầy Chiến Math. All rights reserved.
      </footer>
    </div>
  );
}
