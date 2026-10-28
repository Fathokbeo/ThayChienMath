import { useState, useEffect, useRef, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';
import { PAGE_MAX } from '../lib/layout';
import { Phone, MapPin, Clock, Mail, ExternalLink, LogIn, LogOut, ChevronDown, Home, BookOpen, GraduationCap, Trophy, Award, LayoutDashboard, LayoutGrid, type LucideIcon } from 'lucide-react';
import { ENTER_LABEL, roleColors, accountSubtitle } from '../lib/navigation';

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
  const [scrolled, setScrolled] = useState(false);
  const [settings, setSettings] = useState<any>({});
  const [homeOpen, setHomeOpen] = useState(false);
  const homeRef = useRef<HTMLDivElement>(null);
  const [accountOpen, setAccountOpen] = useState(false); // menu tài khoản (đã đăng nhập)
  const accountRef = useRef<HTMLDivElement>(null);

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
    if (!accountOpen) return;
    const onDown = (e: MouseEvent) => { if (accountRef.current && !accountRef.current.contains(e.target as Node)) setAccountOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setAccountOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [accountOpen]);

  useEffect(() => {
    api.get('/public/settings').then((r) => setSettings(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handler);
    return () => window.removeEventListener('scroll', handler);
  }, []);

  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);

  const handleLogout = () => { logout(); setAccountOpen(false); };
  const dashLink = user ? `/${user.role}` : '/login';
  const [avBg, avFg] = roleColors(user?.role);
  const avatar = (size: number) => (
    <span className="avatar" style={{ width: size, height: size, background: avBg, color: avFg, fontSize: size > 34 ? '1rem' : '0.82rem' }}>{user?.full_name?.[0] || 'U'}</span>
  );
  // Đầu menu tài khoản: ảnh đại diện + họ tên + vai trò · tên đăng nhập
  const accountHeader = user && (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px 10px' }}>
      {avatar(38)}
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.full_name}</div>
        <div style={{ fontSize: '0.8rem', color: '#86868B' }}>{accountSubtitle(user)}</div>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#F5F5F7', display: 'flex', flexDirection: 'column' }}>
      {/* Navbar */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: '#FFFFFF',
        borderBottom: `1px solid ${scrolled ? 'rgba(0,0,0,0.12)' : 'rgba(0,0,0,0.06)'}`,
        transition: 'border-color 0.2s', padding: 'var(--sa-top) 22px 0',
      }}>
        <div style={{ maxWidth: PAGE_MAX, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 52 }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 9, textDecoration: 'none', color: '#1D1D1F', fontWeight: 700, letterSpacing: '-0.02em' }}>
            <img src="/logo.png" alt="Thầy Chiến Math" style={{ width: 28, height: 28, borderRadius: 7 }} />
            Thầy Chiến Math
          </Link>

          {/* Thanh công cụ: máy tính hiện chữ; điện thoại chỉ hiện biểu tượng (.pub-label ẩn, .pub-icon hiện) */}
          <div className="pub-nav">
            {/* Rê chuột chỉ áp dụng cho chuột thật — trên điện thoại một lần chạm sẽ vừa "rê vào" vừa bấm, menu mở rồi đóng ngay */}
            <div ref={homeRef} style={{ position: 'relative' }}
              onPointerEnter={(e) => { if (e.pointerType === 'mouse') setHomeOpen(true); }}
              onPointerLeave={(e) => { if (e.pointerType === 'mouse') setHomeOpen(false); }}>
              <button type="button" className="pub-btn" onClick={() => { setHomeOpen((v) => !v); setAccountOpen(false); }}
                aria-haspopup="menu" aria-expanded={homeOpen} aria-label="Trang chủ" title="Trang chủ"
                style={{
                  display: 'flex', alignItems: 'center', gap: 4, background: homeOpen ? '#F2F2F4' : 'transparent', border: 'none', cursor: 'pointer',
                  color: '#1D1D1F', fontFamily: 'inherit', fontWeight: 600, fontSize: '0.88rem', padding: '7px 12px', borderRadius: 99,
                }}>
                <LayoutGrid size={21} className="pub-icon" />
                <span className="pub-label">Trang chủ</span>
                <ChevronDown size={15} className="pub-label" style={{ transition: 'transform 0.2s', transform: homeOpen ? 'rotate(180deg)' : 'none' }} />
              </button>
              {homeOpen && (
                // paddingTop tạo "cầu nối" để rê chuột từ nút xuống danh sách không bị đóng
                <div className="pub-drop">
                  <div className="menu-panel" role="menu">
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
              // Nút tài khoản → menu: thông tin tài khoản, vào hệ thống (theo vai trò), đăng xuất
              <div ref={accountRef} style={{ position: 'relative', marginLeft: 8 }}>
                <button type="button" className="pub-account" onClick={() => { setAccountOpen((v) => !v); setHomeOpen(false); }}
                  aria-haspopup="menu" aria-expanded={accountOpen} aria-label="Tài khoản" title="Tài khoản"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, background: accountOpen ? '#F2F2F4' : 'transparent', border: '1px solid #E5E5EA',
                    borderRadius: 99, padding: '3px 10px 3px 3px', cursor: 'pointer', fontFamily: 'inherit', color: '#1D1D1F',
                  }}>
                  {avatar(32)}
                  <span className="pub-label" style={{ fontWeight: 600, fontSize: '0.88rem', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.full_name}</span>
                  <ChevronDown size={15} color="#6E6E73" className="pub-label" style={{ transition: 'transform 0.2s', transform: accountOpen ? 'rotate(180deg)' : 'none' }} />
                </button>
                {accountOpen && (
                  <div className="pub-drop">
                    <div className="menu-panel" role="menu">
                      {accountHeader}
                      <div className="menu-sep" />
                      <Link to={dashLink} className="menu-item" role="menuitem" onClick={() => setAccountOpen(false)} style={{ color: '#1F5C68', fontWeight: 600 }}>
                        <LayoutDashboard size={17} color="#1F5C68" /> {ENTER_LABEL[user.role]}
                      </Link>
                      <button className="menu-item" role="menuitem" style={{ color: '#B04A2A' }} onClick={handleLogout}>
                        <LogOut size={17} color="#B04A2A" /> Đăng xuất
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Link to="/login" className="btn btn-primary btn-sm pub-btn" style={{ marginLeft: 8 }} aria-label="Đăng nhập" title="Đăng nhập">
                <LogIn size={14} className="pub-label" /><span className="pub-label">Đăng nhập</span>
                <LogIn size={19} className="pub-icon" />
              </Link>
            )}
          </div>
        </div>
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
