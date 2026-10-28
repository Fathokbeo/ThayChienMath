import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import type { Portal } from '../contexts/AuthContext';
import { Eye, EyeOff, ArrowRight, Presentation, GraduationCap, HeartHandshake } from 'lucide-react';
import { toast } from '../components/Toast';
import api from '../lib/api';

// 3 mục đăng nhập. Phụ huynh gõ TÊN ĐĂNG NHẬP CỦA CON + mật khẩu phụ huynh (không phải nhớ thêm tên nào).
const PORTALS: { key: Portal; label: string; icon: typeof Presentation; user: string; pass: string; hint: string }[] = [
  { key: 'teacher', label: 'Giáo viên', icon: Presentation, user: 'Tên đăng nhập', pass: 'Mật khẩu', hint: 'Dành cho giáo viên và quản trị viên.' },
  { key: 'student', label: 'Học sinh', icon: GraduationCap, user: 'Tên đăng nhập', pass: 'Mật khẩu', hint: 'Tài khoản do thầy cô cấp — hãy liên hệ để được tạo.' },
  { key: 'parent', label: 'Phụ huynh', icon: HeartHandshake, user: 'Tên đăng nhập của con', pass: 'Mật khẩu phụ huynh', hint: 'Dùng tên đăng nhập của con. Mật khẩu mặc định là số điện thoại phụ huynh đã đăng ký với thầy cô (chưa đăng ký số thì dùng mật khẩu của con).' },
];
const PORTAL_KEY = 'login_portal';

// Bản demo: server trả danh sách tài khoản thử (database thật trả null → không hiện gì)
type DemoAccounts = {
  password: string;
  teacher: { username: string; password: string; label: string }[];
  classes: { title: string; students: string[] }[];
};

// Đăng nhập: một cột ở giữa, nền trắng, ô nhập lớn, nút tròn — gọn và rõ ràng.
export default function Login() {
  const [params] = useSearchParams();
  const [portal, setPortal] = useState<Portal>(() => {
    const fromUrl = params.get('muc');
    const saved = (() => { try { return localStorage.getItem(PORTAL_KEY); } catch { return null; } })();
    const v = fromUrl === 'phu-huynh' ? 'parent' : fromUrl === 'hoc-sinh' ? 'student' : fromUrl === 'giao-vien' ? 'teacher' : saved;
    return v === 'teacher' || v === 'parent' ? v : 'student';
  });
  const cur = PORTALS.find((p) => p.key === portal)!;
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [usernameError, setUsernameError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [demo, setDemo] = useState<DemoAccounts | null>(null);
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/public/demo-accounts').then((r) => setDemo(r.data)).catch(() => { /* không có thì thôi */ });
  }, []);

  const doLogin = async (u: string, p: string) => {
    setUsernameError('');
    setPasswordError('');
    if (!u || !p) { toast.error('Vui lòng nhập đầy đủ thông tin'); return; }
    setLoading(true);
    try {
      const user = await login(u.trim(), p, portal);
      try { localStorage.setItem(PORTAL_KEY, portal); } catch { /* trình duyệt chặn lưu trữ */ }
      navigate(`/${user.role}`);
    } catch (err: any) {
      const field = err.response?.data?.field;
      const message = err.response?.data?.message || 'Đăng nhập thất bại';
      if (field === 'username') setUsernameError(message);
      else if (field === 'password' || field === 'portal') setPasswordError(message);
      else toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: FormEvent) => { e.preventDefault(); doLogin(username, password); };

  // Bấm 1 tài khoản demo: điền sẵn vào ô và đăng nhập luôn
  const tryAccount = (u: string, p: string) => { setUsername(u); setPassword(p); doLogin(u, p); };
  const field = (err: string): React.CSSProperties => ({
    minHeight: 54, fontSize: '1.02rem', padding: '0.85rem 1rem', borderRadius: 14,
    borderColor: err ? '#B04A2A' : undefined,
  });

  return (
    <div style={{ minHeight: '100vh', background: '#fff', display: 'flex', flexDirection: 'column' }}>
      <header style={{ borderBottom: '1px solid rgba(0,0,0,0.08)', paddingTop: 'var(--sa-top)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', height: 52, padding: '0 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 9, textDecoration: 'none', color: '#1D1D1F', fontWeight: 700, letterSpacing: '-0.02em' }}>
            <img src="/logo.png" alt="" style={{ width: 26, height: 26, borderRadius: 7 }} /> Thầy Chiến Math
          </Link>
          <Link to="/" style={{ color: '#6E6E73', fontSize: '0.88rem', textDecoration: 'none' }}>Trang chủ</Link>
        </div>
      </header>

      <main className="fade-in" style={{ flex: 1, display: 'flex', justifyContent: 'center', padding: '9vh 20px 3rem' }}>
        <div style={{ width: '100%', maxWidth: 400, textAlign: 'center' }}>
          <img src="/logo.png" alt="Thầy Chiến Math" style={{ width: 72, height: 72, borderRadius: 18, margin: '0 auto' }} />
          <h1 style={{ margin: '22px 0 8px', fontSize: '2rem', fontWeight: 700, letterSpacing: '-0.03em', color: '#1D1D1F' }}>Đăng nhập</h1>
          <p style={{ margin: '0 0 26px', color: '#6E6E73', fontSize: '1.02rem' }}>Học Toán cùng Thầy Chiến — mọi bài giảng, bài tập và điểm số ở một nơi.</p>

          <div role="tablist" aria-label="Bạn là" className="portal-switch">
            {PORTALS.map(({ key, label, icon: Icon }) => (
              <button key={key} type="button" role="tab" aria-selected={portal === key}
                className={`portal-tab ${portal === key ? 'active' : ''}`}
                onClick={() => { setPortal(key); setUsernameError(''); setPasswordError(''); }}>
                <Icon size={18} /> {label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} style={{ textAlign: 'left' }}>
            <div className="form-group">
              <input className="input" style={field(usernameError)} placeholder={cur.user} aria-label={cur.user}
                value={username} autoComplete="username" autoCapitalize="none" autoCorrect="off" autoFocus
                onChange={(e) => { setUsername(e.target.value); if (usernameError) setUsernameError(''); }} />
              {usernameError && <p style={{ color: '#B04A2A', fontSize: '0.84rem', margin: '6px 4px 0' }}>{usernameError}</p>}
            </div>
            <div className="form-group">
              <div style={{ position: 'relative' }}>
                <input className="input" type={showPw ? 'text' : 'password'} style={{ ...field(passwordError), paddingRight: 52 }}
                  placeholder={cur.pass} aria-label={cur.pass} value={password} autoComplete="current-password"
                  onChange={(e) => { setPassword(e.target.value); if (passwordError) setPasswordError(''); }} />
                <button type="button" onClick={() => setShowPw(!showPw)} title={showPw ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} className="icon-btn"
                  style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)' }}>
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {passwordError && <p style={{ color: '#B04A2A', fontSize: '0.84rem', margin: '6px 4px 0' }}>{passwordError}</p>}
            </div>

            <button type="submit" className="btn btn-primary btn-lg" disabled={loading} style={{ width: '100%', marginTop: 8, minHeight: 52 }}>
              {loading ? 'Đang đăng nhập…' : <>Đăng nhập <ArrowRight size={18} /></>}
            </button>
          </form>

          {demo ? (
            <section className="demo-box" aria-label="Tài khoản dùng thử">
              <div className="demo-box-head">
                <span className="demo-box-title">Tài khoản dùng thử</span>
                {portal !== 'teacher' && <span className="demo-box-pass">Mật khẩu <code>{demo.password}</code></span>}
              </div>
              <p className="demo-box-note">
                {portal === 'teacher' ? 'Bấm một tài khoản để đăng nhập ngay.'
                  : portal === 'student' ? 'Bấm một học sinh để đăng nhập ngay (hs1 = Học sinh 1…).'
                  : 'Phụ huynh đăng nhập bằng tên đăng nhập của con. Bấm một học sinh để xem với vai trò phụ huynh.'}
              </p>
              {portal === 'teacher' ? (
                <div className="demo-box-list">
                  {demo.teacher.map((a) => (
                    <button key={a.username} type="button" className="demo-acc" disabled={loading} onClick={() => tryAccount(a.username, a.password)}>
                      {a.username}<span>{a.label} · mật khẩu {a.password}</span>
                    </button>
                  ))}
                </div>
              ) : demo.classes.map((c) => (
                <div key={c.title}>
                  <div className="demo-box-group">{c.title}</div>
                  <div className="demo-box-list">
                    {c.students.map((u) => (
                      <button key={u} type="button" className="demo-acc" disabled={loading} onClick={() => tryAccount(u, demo.password)}>{u}</button>
                    ))}
                  </div>
                </div>
              ))}
            </section>
          ) : (
            <p style={{ color: '#86868B', fontSize: '0.86rem', marginTop: 22, lineHeight: 1.55 }}>{cur.hint}</p>
          )}
        </div>
      </main>

      <footer style={{ textAlign: 'center', color: '#AEAEB2', fontSize: '0.78rem', padding: '1.25rem' }}>
        © {new Date().getFullYear()} Thầy Chiến Math
      </footer>
    </div>
  );
}
