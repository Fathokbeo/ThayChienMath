import { useEffect, useState } from 'react';
import api from './api';

// Tên thương hiệu dùng chung cho thanh trên cùng, trang đăng nhập, chân trang, tiêu đề tab trình duyệt...
// Đồng bộ với "Tiêu đề trang chủ" (hero_title) do admin đặt ở Nội dung trang — đổi một chỗ là đổi khắp nơi.
export const BRAND_DEFAULT = 'EduGrade Aplus';

let cached: string | null = null;
let pending: Promise<string> | null = null;
const listeners = new Set<(name: string) => void>();

function load(): Promise<string> {
  if (!pending) {
    pending = api.get('/public/settings')
      .then((r) => (r.data?.hero_title || '').trim() || BRAND_DEFAULT)
      .catch(() => BRAND_DEFAULT)
      .then((name) => { setBrandName(name); return name; });
  }
  return pending;
}

// Gọi sau khi admin lưu Nội dung trang để mọi chỗ cập nhật ngay, không cần tải lại trang
export function setBrandName(name: string) {
  cached = name.trim() || BRAND_DEFAULT;
  if (typeof document !== 'undefined') document.title = cached;
  listeners.forEach((fn) => fn(cached!));
}

export function useBrandName() {
  const [name, setName] = useState(cached || BRAND_DEFAULT);
  useEffect(() => {
    listeners.add(setName);
    if (cached) setName(cached); else load();
    return () => { listeners.delete(setName); };
  }, []);
  return name;
}
