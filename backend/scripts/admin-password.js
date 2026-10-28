// Tạo tài khoản quản trị, hoặc đặt lại mật khẩu cho tài khoản quản trị có sẵn (vd quên mật khẩu).
// Chạy trên server, trong thư mục backend:  npm run admin:password
// Hỏi tên đăng nhập + mật khẩu (mật khẩu gõ vào không hiện ra màn hình, không lưu vào lịch sử lệnh).
require('dotenv').config();
const readline = require('readline');
const bcrypt = require('bcryptjs');
const { getDb } = require('../src/db/database');

// Một bộ đọc dùng chung cho mọi câu hỏi (mỗi câu tạo bộ đọc mới thì bộ đọc trước nuốt mất phần nhập còn lại)
const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: process.stdin.isTTY });
let muted = false;
const origWrite = rl._writeToOutput.bind(rl);
rl._writeToOutput = (s) => { if (!muted) origWrite(s); }; // đang hỏi mật khẩu: không in lại ký tự đang gõ

// Đọc lần lượt từng dòng (có hàng đợi) — đúng cả khi gõ tay lẫn khi dữ liệu được dẫn vào qua pipe
const lines = rl[Symbol.asyncIterator]();
async function ask(question, hidden = false) {
  process.stdout.write(question);
  muted = hidden;
  const { value } = await lines.next();
  muted = false;
  if (hidden) process.stdout.write('\n');
  return String(value || '').replace(/^﻿/, '').trim();
}

(async () => {
  const db = getDb();
  const username = await ask('Tên đăng nhập quản trị: ');
  if (!/^[a-zA-Z0-9._-]{3,40}$/.test(username)) {
    console.error('Tên đăng nhập chỉ gồm chữ không dấu, số, dấu . _ - (3–40 ký tự).');
    process.exit(1);
  }
  const existing = db.prepare('SELECT id, role FROM users WHERE username=?').get(username);
  if (existing && existing.role !== 'admin') {
    console.error(`"${username}" đã là tài khoản ${existing.role}, không phải quản trị. Hãy chọn tên khác.`);
    process.exit(1);
  }
  const password = await ask('Mật khẩu mới (ít nhất 10 ký tự): ', true);
  if (password.length < 10) { console.error('Mật khẩu quá ngắn.'); process.exit(1); }
  const again = await ask('Nhập lại mật khẩu: ', true);
  if (again !== password) { console.error('Hai lần nhập không khớp.'); process.exit(1); }

  const hash = bcrypt.hashSync(password, 10);
  if (existing) {
    db.prepare('UPDATE users SET password=?, plain_password=NULL, active=1 WHERE id=?').run(hash, existing.id);
    console.log(`✅ Đã đặt lại mật khẩu cho tài khoản quản trị "${username}".`);
  } else {
    db.prepare("INSERT INTO users (username,password,plain_password,full_name,role) VALUES (?,?,NULL,'Quản Trị Viên','admin')").run(username, hash);
    console.log(`✅ Đã tạo tài khoản quản trị "${username}".`);
  }
  console.log('   (Nếu web đang chạy thì không cần khởi động lại — đăng nhập được ngay.)');
  rl.close();
})();
