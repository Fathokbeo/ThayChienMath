import { useState, useEffect, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';
import { PAGE_MAX } from '../lib/layout';
import { Phone, MapPin, Clock, Mail, ExternalLink, Menu, X, LogIn, LogOut, User } from 'lucide-react';

const NAV = [
  { to: '/', label: 'Trang chủ' },
];

export default function PublicLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const [navOpen, setNavOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [settings, setSettings] = useState<any>({});

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
    <div style={{ minHeight: '100vh', background: '#F6F4EF', display: 'flex', flexDirection: 'column' }}>
      {/* Navbar */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: '#FFFFFF',
        borderBottom: `1px solid ${scrolled ? 'rgba(29,42,48,0.12)' : 'rgba(29,42,48,0.06)'}`,
        transition: 'border-color 0.2s', padding: '0 2rem',
      }}>
        <div style={{ maxWidth: PAGE_MAX, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 70 }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <img src="/logo.svg" alt="Thầy Chiến Math" style={{ width: 40, height: 40, borderRadius: 10 }} />
            <div>
              <div className="display" style={{ color: '#1D2A30', fontWeight: 700, fontSize: '1.12rem', lineHeight: 1.1 }}>Thầy Chiến</div>
              <div style={{ color: '#1F5C68', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', marginTop: 2 }}>Math</div>
            </div>
          </Link>

          {/* Desktop nav */}
          <div className="desktop-nav">
            {NAV.map((n) => {
              const active = n.to === pathname;
              return (
                <Link key={n.to} to={n.to} style={{
                  color: active ? '#1F5C68' : solid ? '#40494E' : 'rgba(255,255,255,0.85)',
                  textDecoration: 'none', fontWeight: active ? 700 : 500, fontSize: '0.9rem',
                  padding: '6px 12px', borderRadius: 8, transition: 'all 0.15s',
                }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = solid ? '#F1EFEA' : 'rgba(255,255,255,0.1)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >{n.label}</Link>
              );
            })}
            <a href="#contact" style={{ color: solid ? '#40494E' : 'rgba(255,255,255,0.85)', textDecoration: 'none', fontWeight: 500, fontSize: '0.9rem', padding: '6px 12px', borderRadius: 8 }}
              onMouseEnter={(e) => (e.currentTarget.style.background = solid ? '#F1EFEA' : 'rgba(255,255,255,0.1)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >Liên hệ</a>

            {user ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 8 }}>
                <Link to={dashLink} className="btn btn-primary btn-sm" style={{ gap: 6 }}>
                  <User size={14} />{user.role === 'admin' ? 'Quản trị' : user.role === 'teacher' ? 'Giáo viên' : 'Vào học'}
                </Link>
                <button className="btn btn-ghost btn-sm" style={{ color: solid ? '#525A5F' : 'white', borderColor: solid ? '#DAD5CC' : 'rgba(255,255,255,0.3)' }} onClick={handleLogout}>
                  <LogOut size={14} /> Đăng xuất
                </button>
              </div>
            ) : (
              <Link to="/login" className="btn btn-primary btn-sm" style={{ marginLeft: 8 }}><LogIn size={14} /> Đăng nhập</Link>
            )}
          </div>

          {/* Mobile hamburger */}
          <button onClick={() => setNavOpen(!navOpen)} style={{ color: solid ? '#2E383D' : 'white' }} className="mobile-menu-btn">
            {navOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile menu */}
        {navOpen && (
          <div style={{ background: 'white', borderTop: '1px solid #ECE8E1', padding: '1rem 2rem' }}>
            {NAV.map((n) => (
              <Link key={n.to} to={n.to} onClick={() => setNavOpen(false)} style={{ display: 'block', padding: '0.6rem 0', color: n.to === pathname ? '#1F5C68' : '#2E383D', textDecoration: 'none', fontWeight: 600 }}>{n.label}</Link>
            ))}
            <a href="#contact" onClick={() => setNavOpen(false)} style={{ display: 'block', padding: '0.6rem 0', color: '#2E383D', textDecoration: 'none', fontWeight: 500 }}>Liên hệ</a>
            {user ? (
              <>
                <Link to={dashLink} onClick={() => setNavOpen(false)} style={{ display: 'block', padding: '0.6rem 0', color: '#1F5C68', fontWeight: 600 }}>Vào hệ thống</Link>
                <button onClick={handleLogout} style={{ background: 'none', border: 'none', padding: '0.6rem 0', color: '#5E676C', fontWeight: 500, cursor: 'pointer', width: '100%', textAlign: 'left' }}>Đăng xuất</button>
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
      <section id="contact" style={{ background: '#EFEDE8', padding: '2.5rem 2rem' }}>
        <div style={{ maxWidth: PAGE_MAX, margin: '0 auto' }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '1.25rem', color: '#1D2A30' }}>
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
                  <div style={{ fontSize: '0.78rem', color: '#949A9E', marginBottom: 4 }}>{label}</div>
                  <div style={{ fontWeight: 600, color: '#1D2A30', fontSize: '0.9rem' }}>{value}</div>
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
