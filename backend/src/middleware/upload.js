const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const UPLOADS_DIR = path.join(__dirname, '../../uploads');

// Đuôi file do SERVER quyết định theo loại file khai báo (whitelist), KHÔNG lấy từ tên người dùng gửi.
// Nếu lấy đuôi từ tên gốc, người dùng có thể tải lên "x.html" khai là PDF/ảnh rồi để trình duyệt chạy
// script ngay trên tên miền của web (XSS → lấy token đăng nhập của giáo viên/admin khi họ mở file).
const EXT_BY_MIME = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg', 'image/jpg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif',
  'video/mp4': '.mp4', 'video/webm': '.webm', 'video/quicktime': '.mov', 'video/x-matroska': '.mkv', 'video/x-msvideo': '.avi',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.ms-powerpoint': '.ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
};
function safeExt(file) {
  const mime = String(file.mimetype || '').toLowerCase();
  if (EXT_BY_MIME[mime]) return EXT_BY_MIME[mime];
  return mime.startsWith('video/') ? '.mp4' : '.bin'; // video lạ: trình duyệt không chạy script từ video
}

function createStorage(subDir) {
  const dir = path.join(UPLOADS_DIR, subDir);
  fs.mkdirSync(dir, { recursive: true });
  return multer.diskStorage({
    destination: (req, file, cb) => cb(null, dir),
    filename: (req, file, cb) => {
      cb(null, `${uuidv4()}${safeExt(file)}`);
    },
  });
}

const isRasterImage = (file) => /^image\/(jpe?g|png|webp|gif)$/i.test(file.mimetype || '');

const uploadAd = multer({
  storage: createStorage('ads'),
  fileFilter: (req, file, cb) => {
    if (isRasterImage(file)) cb(null, true);
    else cb(new Error('Chỉ chấp nhận file ảnh'));
  },
  limits: { fileSize: 10 * 1024 * 1024 },
});

const uploadHomework = multer({
  storage: createStorage('homework'),
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Chỉ chấp nhận file PDF'));
  },
  limits: { fileSize: 50 * 1024 * 1024 },
});

const uploadSubmission = multer({
  storage: createStorage('submissions'),
  fileFilter: (req, file, cb) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Chỉ chấp nhận file PDF hoặc ảnh'));
  },
  limits: { fileSize: 20 * 1024 * 1024 },
});

const uploadVideo = multer({
  storage: createStorage('videos'),
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('video/')) cb(null, true);
    else cb(new Error('Chỉ chấp nhận file video'));
  },
  limits: { fileSize: 500 * 1024 * 1024 },
});

// File đính kèm bài giảng: tài liệu bài giảng / đáp án bài tập trên lớp (PDF, ảnh, Office)
const LESSON_FILE_TYPES = [
  'application/pdf',
  'image/jpeg', 'image/png', 'image/jpg', 'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];
const uploadLessonFile = multer({
  storage: createStorage('lessons'),
  fileFilter: (req, file, cb) => {
    if (LESSON_FILE_TYPES.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Chỉ chấp nhận file PDF, ảnh hoặc tài liệu Office'));
  },
  limits: { fileSize: 50 * 1024 * 1024 },
});

const uploadCourseThumbnail = multer({
  storage: createStorage('courses'),
  fileFilter: (req, file, cb) => {
    if (isRasterImage(file)) cb(null, true);
    else cb(new Error('Chỉ chấp nhận file ảnh'));
  },
  limits: { fileSize: 5 * 1024 * 1024 },
});

const uploadAssistantPhoto = multer({
  storage: createStorage('assistants'),
  fileFilter: (req, file, cb) => {
    if (isRasterImage(file)) cb(null, true);
    else cb(new Error('Chỉ chấp nhận file ảnh'));
  },
  limits: { fileSize: 5 * 1024 * 1024 },
});

// Upload ảnh chung cho nội dung trang (học sinh, giáo viên, khóa tiêu biểu, thành tích)
function makeImageUpload(subDir) {
  return multer({
    storage: createStorage(subDir),
    fileFilter: (req, file, cb) => {
      if (isRasterImage(file)) cb(null, true);
      else cb(new Error('Chỉ chấp nhận file ảnh'));
    },
    limits: { fileSize: 5 * 1024 * 1024 },
  });
}

const uploadContent = {
  'featured-students': makeImageUpload('featured_students'),
  'staff': makeImageUpload('staff'),
  'featured-courses': makeImageUpload('featured_courses'),
  'achievements': makeImageUpload('achievements'),
};

// Đề thi (mục "Đề và chuyên môn"): 1 ảnh bìa + 1 file PDF
const uploadExam = multer({
  storage: createStorage('exams'),
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'thumbnail' && isRasterImage(file)) cb(null, true);
    else if (file.fieldname === 'pdf' && file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error(file.fieldname === 'pdf' ? 'Đề thi phải là file PDF' : 'Ảnh bìa phải là file ảnh'));
  },
  limits: { fileSize: 30 * 1024 * 1024 },
}).fields([{ name: 'thumbnail', maxCount: 1 }, { name: 'pdf', maxCount: 1 }]);

module.exports = { uploadExam, uploadAd, uploadHomework, uploadSubmission, uploadVideo, uploadCourseThumbnail, uploadContent, uploadLessonFile, uploadAssistantPhoto };
