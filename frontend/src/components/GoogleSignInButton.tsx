import { useEffect, useRef, useState } from 'react';
import { IS_NATIVE } from '../lib/native';

// Client ID của nút "Đăng nhập bằng Google" — mã công khai (không phải bí mật), phải khớp GOOGLE_CLIENT_ID ở backend.
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '639181055073-k4c58us4gmcscvuek8jjdr1uib09ngdv.apps.googleusercontent.com';

declare global { interface Window { google?: any } }

let gisLoading: Promise<void> | null = null;
function loadGis(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (!gisLoading) {
    gisLoading = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true; s.defer = true;
      s.onload = () => resolve();
      s.onerror = () => { gisLoading = null; reject(new Error('Không tải được Google')); };
      document.head.appendChild(s);
    });
  }
  return gisLoading;
}

// Nút đăng nhập Google chính thức (Google Identity Services). Bấm → Google trả "thẻ" (credential) → onCredential.
// App Android: Google chặn đăng nhập trong WebView nên không hiện nút (cần plugin riêng — làm sau).
export default function GoogleSignInButton({ onCredential, text = 'signin_with' }: { onCredential: (credential: string) => void; text?: 'signin_with' | 'signup_with' | 'continue_with' }) {
  const box = useRef<HTMLDivElement>(null);
  const cb = useRef(onCredential); cb.current = onCredential;
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (IS_NATIVE) return;
    let cancelled = false;
    loadGis().then(() => {
      if (cancelled || !box.current) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (resp: { credential?: string }) => { if (resp.credential) cb.current(resp.credential); },
        ux_mode: 'popup',
      });
      box.current.innerHTML = '';
      window.google.accounts.id.renderButton(box.current, {
        theme: 'outline', size: 'large', shape: 'pill', text, logo_alignment: 'center',
        width: Math.min(400, box.current.clientWidth || 360), locale: 'vi',
      });
    }).catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [text]);

  if (IS_NATIVE) {
    return <p style={{ fontSize: '0.82rem', color: '#86868B', margin: 0 }}>Đăng nhập bằng Google hiện dùng được trên trang web edugrade.vn.</p>;
  }
  if (failed) return <p style={{ fontSize: '0.82rem', color: '#B04A2A', margin: 0 }}>Không tải được nút đăng nhập Google — kiểm tra mạng rồi tải lại trang.</p>;
  return <div ref={box} style={{ width: '100%', display: 'flex', justifyContent: 'center', minHeight: 44 }} />;
}
