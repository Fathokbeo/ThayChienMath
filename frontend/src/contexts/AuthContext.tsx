import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import api, { IS_REMOTE_API, setFileTicket } from '../lib/api';

async function refreshFileTicket() {
  const { data } = await api.post('/auth/file-ticket');
  setFileTicket(data.ticket);
}

interface User {
  id: number;
  username: string;
  full_name: string;
  role: 'admin' | 'teacher' | 'student' | 'parent';
  parent_phone?: string;
}

// Mục chọn ở trang đăng nhập (admin đăng nhập ở mục Giáo viên)
export type Portal = 'teacher' | 'student' | 'parent';

interface AuthCtx {
  user: User | null;
  token: string | null;
  login: (username: string, password: string, portal?: Portal) => Promise<User>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthCtx>({} as AuthCtx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = localStorage.getItem('token');
    const u = localStorage.getItem('user');
    if (!t || !u) { setLoading(false); return; }
    setToken(t);
    setUser(JSON.parse(u));
    // Cấp (hoặc gia hạn) cookie phiên TRƯỚC khi hiện giao diện, để ảnh/đề bài/video tải được ngay từ
    // lần mở đầu tiên — kể cả người đã đăng nhập từ trước khi có tính năng kiểm tra quyền tải file.
    // App (máy chủ khác tên miền) thì lấy vé xem file thay cho cookie.
    (IS_REMOTE_API ? refreshFileTicket() : api.post('/auth/session'))
      .catch(() => {}).finally(() => setLoading(false));
  }, []);

  // App: gia hạn vé xem file định kỳ (vé sống 24 giờ) khi đang đăng nhập.
  useEffect(() => {
    if (!IS_REMOTE_API || !token) return;
    const id = setInterval(() => { refreshFileTicket().catch(() => {}); }, 6 * 60 * 60 * 1000);
    return () => clearInterval(id);
  }, [token]);

  const login = async (username: string, password: string, portal?: Portal) => {
    const { data } = await api.post('/auth/login', { username, password, portal });
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    if (IS_REMOTE_API) await refreshFileTicket().catch(() => {});
    setToken(data.token);
    setUser(data.user);
    return data.user as User;
  };

  const logout = () => {
    api.post('/auth/logout').catch(() => {}); // xóa cookie phiên ở máy chủ
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setFileTicket(null);
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
