import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, ArrowRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { toast } from '../components/Toast';
import GoogleSignInButton from '../components/GoogleSignInButton';
import { useBrandName } from '../lib/brand';
import { safeNext } from '../lib/navigation';

// Khách tự tạo tài khoản: bằng Google (1 chạm) hoặc họ tên + email + mật khẩu. Bố cục giống trang đăng nhập.
export default function Register() {
  const brand = useBrandName();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const navigate = useNavigate();
  const { register, loginWithGoogle } = useAuth();
  const [form, setForm] = useState({ full_name: '', email: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    if (errors[k]) setErrors((x) => ({ ...x, [k]: '' }));
  };
  const done = (role: string) => { toast.success('Đã tạo tài khoản'); navigate(next || `/${role}`); };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      done((await register({ ...form, email: form.email.trim() })).role);
    } catch (err: any) {
      const { field, message } = err.response?.data || {};
      if (field) setErrors({ [field]: message });
      else toast.error(message || 'Không tạo được tài khoản');
    } finally { setLoading(false); }
  };

  const onGoogle = async (credential: string) => {
    setLoading(true);
    try { done((await loginWithGoogle(credential)).role); }
    catch (err: any) { toast.error(err.response?.data?.message || 'Đăng nhập Google không thành công'); }
    finally { setLoading(false); }
  };

  const field = (err?: string): React.CSSProperties => ({ minHeight: 52, fontSize: '1rem', padding: '0.8rem 1rem', borderRadius: 14, borderColor: err ? '#B04A2A' : undefined });
  const Err = ({ k }: { k: string }) => (errors[k] ? <p style={{ color: '#B04A2A', fontSize: '0.84rem', margin: '6px 4px 0' }}>{errors[k]}</p> : null);

  return (
    <div style={{ minHeight: '100vh', background: '#fff', display: 'flex', flexDirection: 'column' }}>
      <header style={{ borderBottom: '1px solid rgba(0,0,0,0.08)', paddingTop: 'var(--sa-top)' }}>
        <div style={{ height: 52, padding: '0 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 9, textDecoration: 'none', color: '#1D1D1F', fontWeight: 700, letterSpacing: '-0.02em' }}>
            <img src="/logo.png" alt="" style={{ width: 26, height: 26, borderRadius: 7 }} /> {brand}
          </Link>
          <Link to="/" style={{ color: '#6E6E73', fontSize: '0.88rem', textDecoration: 'none' }}>Trang chủ</Link>
        </div>
      </header>

      <main className="fade-in" style={{ flex: 1, display: 'flex', justifyContent: 'center', padding: '7vh 20px 3rem' }}>
        <div style={{ width: '100%', maxWidth: 400, textAlign: 'center' }}>
          <img src="/logo.png" alt={brand} style={{ width: 64, height: 64, borderRadius: 16, margin: '0 auto' }} />
          <h1 style={{ margin: '20px 0 8px', fontSize: '1.9rem', fontWeight: 700, letterSpacing: '-0.03em' }}>Tạo tài khoản</h1>
          <p style={{ margin: '0 0 24px', color: '#6E6E73' }}>Miễn phí — để tải đề, theo dõi tin tức và đăng ký học nhanh hơn.</p>

          <GoogleSignInButton onCredential={onGoogle} text="signup_with" />
          <div className="auth-divider">hoặc đăng ký bằng email</div>

          <form onSubmit={submit} style={{ textAlign: 'left' }}>
            <div className="form-group">
              <input className="input" style={field(errors.full_name)} placeholder="Họ và tên" aria-label="Họ và tên" autoComplete="name"
                value={form.full_name} onChange={set('full_name')} maxLength={80} required />
              <Err k="full_name" />
            </div>
            <div className="form-group">
              <input className="input" type="email" style={field(errors.email)} placeholder="Email" aria-label="Email" autoComplete="email" autoCapitalize="none"
                value={form.email} onChange={set('email')} maxLength={120} required />
              <Err k="email" />
            </div>
            <div className="form-group">
              <div style={{ position: 'relative' }}>
                <input className="input" type={showPw ? 'text' : 'password'} style={{ ...field(errors.password), paddingRight: 52 }} placeholder="Mật khẩu (ít nhất 6 ký tự)"
                  aria-label="Mật khẩu" autoComplete="new-password" value={form.password} onChange={set('password')} minLength={6} required />
                <button type="button" onClick={() => setShowPw(!showPw)} title={showPw ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} className="icon-btn"
                  style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)' }}>
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <Err k="password" />
            </div>
            <button type="submit" className="btn btn-primary btn-lg" disabled={loading} style={{ width: '100%', marginTop: 6, minHeight: 52 }}>
              {loading ? 'Đang tạo tài khoản…' : <>Tạo tài khoản <ArrowRight size={18} /></>}
            </button>
          </form>

          <p style={{ margin: '18px 0 0', fontSize: '0.92rem', color: '#515154' }}>
            Đã có tài khoản? <Link to={`/login?muc=khach${next ? `&next=${encodeURIComponent(next)}` : ''}`} className="link" style={{ fontWeight: 600 }}>Đăng nhập</Link>
          </p>
          <p style={{ margin: '14px 0 0', fontSize: '0.78rem', color: '#AEAEB2', lineHeight: 1.5 }}>
            Khi tạo tài khoản, bạn đồng ý với <Link to="/chinh-sach-bao-mat" className="link">chính sách bảo mật</Link> của trung tâm.
          </p>
        </div>
      </main>
    </div>
  );
}
