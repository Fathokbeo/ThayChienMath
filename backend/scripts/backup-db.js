// Sao lưu database SQLite an toàn khi web ĐANG chạy (dùng API backup của SQLite — không copy file thô,
// vì copy thẳng file .db lúc đang ghi có thể ra bản hỏng).
// Cách dùng: node scripts/backup-db.js <đường dẫn file đích>
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { DB_PATH } = require('../src/db/database');

const dest = process.argv[2];
if (!dest) { console.error('Cách dùng: node scripts/backup-db.js <file-dich.db>'); process.exit(1); }
if (!fs.existsSync(DB_PATH)) { console.error(`Không thấy database: ${DB_PATH}`); process.exit(1); }

fs.mkdirSync(path.dirname(path.resolve(dest)), { recursive: true });
const src = new Database(DB_PATH, { readonly: true, fileMustExist: true });
src.backup(dest)
  .then(() => { src.close(); console.log(`✅ Đã sao lưu database → ${dest}`); })
  .catch((e) => { src.close(); console.error('❌ Sao lưu lỗi:', e.message); process.exit(1); });
