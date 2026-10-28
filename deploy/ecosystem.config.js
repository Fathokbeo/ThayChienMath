// pm2: giữ web luôn chạy, tự bật lại khi lỗi hoặc khi khởi động lại VPS.
// CHỈ 1 tiến trình (fork, không cluster): SQLite + bộ đếm chặn dò mật khẩu + hàng đợi chấm AI đều nằm trong 1 tiến trình.
const path = require('path');

module.exports = {
  apps: [
    {
      name: 'thaychienmath',
      cwd: path.join(__dirname, '../backend'), // để dotenv đọc đúng backend/.env
      script: 'src/server.js',
      exec_mode: 'fork',
      instances: 1,
      max_memory_restart: '700M',
      time: true, // log kèm thời gian
      env: { NODE_ENV: 'production' },
    },
  ],
};
