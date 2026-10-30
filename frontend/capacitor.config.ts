import type { CapacitorConfig } from '@capacitor/cli';

// App Android đóng gói sẵn giao diện (thư mục dist-android), chỉ gọi API + tải file từ máy chủ.
// Địa chỉ máy chủ đặt trong .env.android (VITE_API_URL). Build: npm run build:android
// Tách khỏi dist (bản web mà backend phục vụ) để build app không ghi đè bản web.
const config: CapacitorConfig = {
  appId: 'vn.thaychienmath.app',
  appName: 'EduGrade Aplus',
  webDir: 'dist-android',
  android: {
    // Mặc định Capacitor chạy ở https://localhost — backend đã cho phép origin này trong CORS.
    allowMixedContent: false,
  },
  plugins: {
    // Tràn viền (index.html có viewport-fit=cover): Capacitor gắn --safe-area-inset-* cho CSS (xem --sa-top trong
    // index.css) để thanh trên cùng chừa chỗ cho đồng hồ/pin. LIGHT = chữ & biểu tượng tối, hợp giao diện nền sáng
    // (kể cả khi điện thoại bật chế độ tối).
    SystemBars: {
      insetsHandling: 'css',
      initialViewportFitValueHint: 'cover',
      style: 'LIGHT',
    },
  },
};

export default config;
