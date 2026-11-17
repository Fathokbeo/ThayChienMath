import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Máy chủ backend khi chạy thử ở máy (đổi bằng biến DEV_API_TARGET nếu cổng 5100 đang bận)
const apiTarget = process.env.DEV_API_TARGET || 'http://localhost:5100'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5174,
    proxy: {
      '/api': apiTarget,
      '/uploads': apiTarget,
    },
  },
})
