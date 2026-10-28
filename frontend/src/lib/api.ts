import axios from 'axios';

// Địa chỉ máy chủ. Bản web (frontend + backend chung 1 tên miền) để TRỐNG → gọi '/api', '/uploads' như cũ.
// Bản app Android đặt VITE_API_URL trong .env.android (vd https://thaychienmath.onrender.com).
// KHÔNG đặt biến này khi build bản web: khác tên miền thì cookie xem file (sameSite lax) không gửi được.
export const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
export const IS_REMOTE_API = API_URL !== '';

const api = axios.create({ baseURL: `${API_URL}/api` });

// Vé xem file: app chạy ở https://localhost nên trình duyệt không gửi cookie phiên sang máy chủ, mà thẻ
// <img>/<video>/<iframe> lại không gắn được header Authorization → gắn vé ngắn hạn vào link (?t=...).
// Bản web không dùng vé (vẫn dùng cookie như cũ).
let fileTicket: string | null = null;
export const setFileTicket = (t: string | null) => { fileTicket = t; };

// Đường dẫn đầy đủ tới file tải lên, vd fileUrl(`/uploads/homework/${name}`).
export function fileUrl(path: string) {
  if (!IS_REMOTE_API) return path;
  return fileTicket ? `${API_URL}${path}?t=${encodeURIComponent(fileTicket)}` : `${API_URL}${path}`;
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    const isLoginRequest = err.config?.url?.includes('/auth/login');
    if (err.response?.status === 401 && !isLoginRequest) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setFileTicket(null);
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
