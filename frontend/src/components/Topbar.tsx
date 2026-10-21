import { PanelLeft, Home } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import useIsMobile from '../lib/useIsMobile';
import { roleColors } from '../lib/navigation';

interface Props {
  onMenuClick: () => void;
  title?: string;
}

// Thanh trên. Trên điện thoại hiện logo + tên (thanh bên ẩn, điều hướng bằng thanh dưới đáy).
export default function Topbar({ onMenuClick, title }: Props) {
  const { user } = useAuth();
  const isMobile = useIsMobile(768);
  const [avatarBg, avatarFg] = roleColors(user?.role);

  return (
    <header className="topbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <button onClick={onMenuClick} className="btn btn-ghost btn-icon" title="Menu">
          <PanelLeft size={19} />
        </button>
        {isMobile && (
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', minWidth: 0 }}>
            <img src="/logo.svg" alt="" style={{ width: 30, height: 30, borderRadius: 8 }} />
            <span className="display" style={{ fontWeight: 700, color: '#1D2A30', fontSize: '1.02rem', whiteSpace: 'nowrap' }}>Thầy Chiến Math</span>
          </Link>
        )}
        {title && (
          <h1 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#1D2A30' }}>{title}</h1>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {!isMobile && (
          <Link to="/" className="btn btn-ghost btn-sm" title="Trang chủ">
            <Home size={16} /> Trang chủ
          </Link>
        )}
        <div style={{
          background: 'white', border: '1px solid rgba(29,42,48,0.09)', borderRadius: 99,
          padding: '4px 12px 4px 4px', fontSize: '0.85rem', color: '#2E383D', fontWeight: 500,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%', background: avatarBg, color: avatarFg,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 700,
          }}>
            {user?.full_name?.[0] || 'U'}
          </div>
          <span className="hide-mobile">{user?.full_name}</span>
        </div>
      </div>
    </header>
  );
}
