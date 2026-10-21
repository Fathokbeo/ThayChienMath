import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Lock, User, Eye, EyeOff, ArrowRight, Sparkles, BookOpenCheck, LineChart } from 'lucide-react';
import { toast } from '../components/Toast';
import useIsMobile from '../lib/useIsMobile';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [usernameError, setUsernameError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile(900);

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

  const fieldStyle = (err: string): React.CSSProperties => ({
    paddingLeft: 42, minHeight: 50, fontSize: '1rem', borderColor: err ? '#B04A2A' : undefined,
  });

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: isMobile ? 'column' : 'row', background: '#F6F4EF' }}>
      {/* Dải thương hiệu */}
      <div style={{
        flex: isMobile ? '0 0 auto' : '1 1 50%',
        background: '#1F5C68',
        color: 'white', position: 'relative', overflow: 'hidden',
        padding: isMobile ? '2.25rem 1.5rem 3.5rem' : '3.5rem 4rem',
        display: 'flex', flexDirection: 'column', justifyContent: isMobile ? 'flex-start' : 'space-between',
      }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none', color: 'white', position: 'relative' }}>
          <img src="/logo.svg" alt="Thầy Chiến Math" style={{ width: 46, height: 46, borderRadius: 12 }} />
          <div>
            <div className="display" style={{ fontWeight: 700, fontSize: '1.25rem', lineHeight: 1.1 }}>Thầy Chiến</div>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#9CC7D2' }}>Math</div>
          </div>
        </Link>

        <div style={{ position: 'relative', marginTop: isMobile ? '1.75rem' : 0 }}>
          <div style={{ fontSize: '0.74rem', letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 700, color: '#E9A57E', marginBottom: 12 }}>
            Học Toán · Luyện đề · Theo dõi tiến bộ
          </div>
          <h1 style={{ margin: 0, fontSize: isMobile ? '2rem' : '3rem', fontWeight: 700, lineHeight: 1.08, color: 'white' }}>
            Học Toán vững vàng,<br />tự tin mỗi kỳ thi.
          </h1>
          {!isMobile && (
            <p style={{ margin: '1.1rem 0 0', color: 'rgba(255,255,255,0.72)', fontSize: '1.02rem', maxWidth: 440, lineHeight: 1.6 }}>
              Xem bài giảng, làm bài tập và nhận kết quả chấm ngay trên một ứng dụng — đơn giản như mở điện thoại.
            </p>
          )}
        </div>

        {!isMobile && (
          <div style={{ display: 'flex', gap: 22, position: 'relative', flexWrap: 'wrap' }}>
            {[
              { icon: BookOpenCheck, text: 'Bài giảng & bài tập' },
              { icon: Sparkles, text: 'Chấm bài tự động' },
              { icon: LineChart, text: 'Bảng xếp hạng' },
            ].map(({ icon: Icon, text }) => (
              <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,0.82)', fontSize: '0.88rem', fontWeight: 500 }}>
                <span style={{ width: 30, height: 30, borderRadius: 9, background: 'rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon size={16} /></span>
                {text}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Ô đăng nhập */}
      <div style={{ flex: '1 1 50%', display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'center', padding: isMobile ? '0 1rem 2rem' : '2rem' }}>
        <div className="fade-in" style={{
          width: '100%', maxWidth: 420, background: 'white', borderRadius: 18,
          border: '1px solid rgba(29,42,48,0.09)', boxShadow: '0 1px 2px rgba(23,50,58,0.05)',
          padding: isMobile ? '1.75rem 1.35rem' : '2.5rem 2.25rem', marginTop: isMobile ? -28 : 0, position: 'relative',
        }}>
          <h2 className="display" style={{ margin: '0 0 6px', fontSize: '1.7rem', fontWeight: 700, color: '#1D2A30' }}>Đăng nhập</h2>
          <p style={{ margin: '0 0 1.5rem', color: '#7A8287', fontSize: '0.92rem' }}>Dùng tài khoản thầy/cô đã cấp cho bạn.</p>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="label">Tên đăng nhập</label>
              <div style={{ position: 'relative' }}>
                <User size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#949A9E' }} />
                <input className="input" style={fieldStyle(usernameError)} placeholder="Nhập tên đăng nhập"
                  value={username} autoComplete="username" autoCapitalize="none" autoCorrect="off"
                  onChange={(e) => { setUsername(e.target.value); if (usernameError) setUsernameError(''); }} />
              </div>
              {usernameError && <p style={{ color: '#B04A2A', fontSize: '0.8rem', margin: '6px 0 0' }}>{usernameError}</p>}
            </div>

            <div className="form-group">
              <label className="label">Mật khẩu</label>
              <div style={{ position: 'relative' }}>
                <Lock size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#949A9E' }} />
                <input className="input" type={showPw ? 'text' : 'password'} style={{ ...fieldStyle(passwordError), paddingRight: 46 }}
                  placeholder="Nhập mật khẩu" value={password} autoComplete="current-password"
                  onChange={(e) => { setPassword(e.target.value); if (passwordError) setPasswordError(''); }} />
                <button type="button" onClick={() => setShowPw(!showPw)} title={showPw ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#7A8287', width: 38, height: 38, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {passwordError && <p style={{ color: '#B04A2A', fontSize: '0.8rem', margin: '6px 0 0' }}>{passwordError}</p>}
            </div>

            <button type="submit" className="btn btn-primary btn-lg" disabled={loading} style={{ width: '100%', marginTop: 10 }}>
              {loading ? 'Đang đăng nhập...' : <>Đăng nhập <ArrowRight size={18} /></>}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: '1.25rem' }}>
            <Link to="/" style={{ color: '#1F5C68', fontSize: '0.88rem', fontWeight: 600, textDecoration: 'none' }}>← Về trang chủ</Link>
          </div>
          <p style={{ textAlign: 'center', color: '#B6BBBE', fontSize: '0.75rem', margin: '1rem 0 0' }}>
            © {new Date().getFullYear()} Thầy Chiến Math
          </p>
        </div>
      </div>
    </div>
  );
}
