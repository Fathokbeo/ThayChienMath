import type { CapacitorConfig } from '@capacitor/cli';

// App Android đóng gói sẵn giao diện (thư mục dist-android), chỉ gọi API + tải file từ máy chủ.
// Địa chỉ máy chủ đặt trong .env.android (VITE_API_URL). Build: npm run build:android
// Tách khỏi dist (bản web mà backend phục vụ) để build app không ghi đè bản web.
const config: CapacitorConfig = {
  appId: 'vn.thaychienmath.app',
  appName: 'Thầy Chiến Math',
  webDir: 'dist-android',
  android: {
    // Mặc định Capacitor chạy ở https://localhost — backend đã cho phép origin này trong CORS.
    allowMixedContent: false,
  },
};

export default config;
