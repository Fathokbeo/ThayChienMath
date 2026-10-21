import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Eye, EyeOff, ArrowRight } from 'lucide-react';
import { toast } from '../components/Toast';

// Đăng nhập: một cột ở giữa, nền trắng, ô nhập lớn, nút tròn — gọn và rõ ràng.
export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [usernameError, setUsernameError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setUsernameError('');
    setPasswordError('');
    if (!username || !password) { toast.error('Vui lòng nhập đầy đủ thông tin'); return; }
    setLoading(true);
    try {
      await login(username, password);
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      if (user.role === 'admin') navigate('/admin');
      else if (user.role === 'teacher') navigate('/teacher');
      else navigate('/student');
    } catch (err: any) {
      const field = err.response?.data?.field;
      const message = err.response?.data?.message || 'Đăng nhập thất bại';
      if (field === 'username') setUsernameError(message);
      else if (field === 'password') setPasswordError(message);
      else toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const field = (err: string): React.CSSProperties => ({
    minHeight: 54, fontSize: '1.02rem', padding: '0.85rem 1rem', borderRadius: 14,
    borderColor: err ? '#B04A2A' : undefined,
  });

  return (
    <div style={{ minHeight: '100vh', background: '#fff', display: 'flex', flexDirection: 'column' }}>
      <header style={{ borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', height: 52, padding: '0 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 9, textDecoration: 'none', color: '#1D1D1F', fontWeight: 700, letterSpacing: '-0.02em' }}>
            <img src="/logo.svg" alt="" style={{ width: 26, height: 26, borderRadius: 7 }} /> Thầy Chiến Math
          </Link>
          <Link to="/" style={{ color: '#6E6E73', fontSize: '0.88rem', textDecoration: 'none' }}>Trang chủ</Link>
        </div>
      </header>

      <main className="fade-in" style={{ flex: 1, display: 'flex', justifyContent: 'center', padding: '9vh 20px 3rem' }}>
        <div style={{ width: '100%', maxWidth: 400, textAlign: 'center' }}>
          <img src="/logo.svg" alt="Thầy Chiến Math" style={{ width: 72, height: 72, borderRadius: 18, margin: '0 auto' }} />
          <h1 style={{ margin: '22px 0 8px', fontSize: '2rem', fontWeight: 700, letterSpacing: '-0.03em', color: '#1D1D1F' }}>Đăng nhập</h1>
          <p style={{ margin: '0 0 30px', color: '#6E6E73', fontSize: '1.02rem' }}>Học Toán cùng Thầy Chiến — mọi bài giảng, bài tập và điểm số ở một nơi.</p>

          <form onSubmit={handleSubmit} style={{ textAlign: 'left' }}>
            <div className="form-group">
              <input className="input" style={field(usernameError)} placeholder="Tên đăng nhập" aria-label="Tên đăng nhập"
                value={username} autoComplete="username" autoCapitalize="none" autoCorrect="off" autoFocus
                onChange={(e) => { setUsername(e.target.value); if (usernameError) setUsernameError(''); }} />
              {usernameError && <p style={{ color: '#B04A2A', fontSize: '0.84rem', margin: '6px 4px 0' }}>{usernameError}</p>}
            </div>
            <div className="form-group">
              <div style={{ position: 'relative' }}>
                <input className="input" type={showPw ? 'text' : 'password'} style={{ ...field(passwordError), paddingRight: 52 }}
                  placeholder="Mật khẩu" aria-label="Mật khẩu" value={password} autoComplete="current-password"
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

          <p style={{ color: '#86868B', fontSize: '0.86rem', marginTop: 22, lineHeight: 1.5 }}>
            Chưa có tài khoản? Tài khoản do thầy cô cấp — hãy liên hệ để được tạo.
          </p>
        </div>
      </main>

      <footer style={{ textAlign: 'center', color: '#AEAEB2', fontSize: '0.78rem', padding: '1.25rem' }}>
        © {new Date().getFullYear()} Thầy Chiến Math
      </footer>
    </div>
  );
}
