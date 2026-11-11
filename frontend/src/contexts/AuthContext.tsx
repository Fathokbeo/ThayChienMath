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
  role: 'admin' | 'teacher' | 'student' | 'parent' | 'guest';
  parent_phone?: string;
  email?: string | null;
  avatar_url?: string | null; // ảnh đại diện Google (tài khoản khách đăng nhập bằng Google)
}

// Mục chọn ở trang đăng nhập (admin đăng nhập ở mục Giáo viên; khách tự đăng ký / đăng nhập Google)
export type Portal = 'teacher' | 'student' | 'parent' | 'guest';

interface AuthCtx {
  user: User | null;
  token: string | null;
  login: (username: string, password: string, portal?: Portal) => Promise<User>;
  loginWithGoogle: (credential: string) => Promise<User>;
  register: (data: { full_name: string; email: string; password: string }) => Promise<User>;
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

  // Lưu phiên đăng nhập máy chủ vừa cấp (đăng nhập thường, Google hay vừa đăng ký đều như nhau)
  const startSession = async (data: { token: string; user: User }) => {
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    if (IS_REMOTE_API) await refreshFileTicket().catch(() => {});
    setToken(data.token);
    setUser(data.user);
    return data.user as User;
  };

  const login = async (username: string, password: string, portal?: Portal) =>
    startSession((await api.post('/auth/login', { username, password, portal })).data);
  const loginWithGoogle = async (credential: string) => startSession((await api.post('/auth/google', { credential })).data);
  const register = async (body: { full_name: string; email: string; password: string }) => startSession((await api.post('/auth/register', body)).data);

  const logout = () => {
    api.post('/auth/logout').catch(() => {}); // xóa cookie phiên ở máy chủ
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setFileTicket(null);
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, loginWithGoogle, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
