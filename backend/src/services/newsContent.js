// Nội dung bài tin tức: HTML do trình soạn thảo (Quill) ở trang quản trị tạo ra. Luôn làm sạch trước khi lưu —
// chỉ giữ các thẻ định dạng bài báo (đoạn, tiêu đề, đậm/nghiêng, danh sách, trích dẫn, link, ảnh, video YouTube/Vimeo,
// video tự tải lên),
// bỏ hết script/style/thuộc tính lạ, để trang tin công khai không bị chèn mã độc.
const sanitizeHtml = require('sanitize-html');

const ALIGN_CLASSES = ['ql-align-center', 'ql-align-right', 'ql-align-justify'];
const INDENT_CLASSES = Array.from({ length: 8 }, (_, i) => `ql-indent-${i + 1}`);
// Video tải lên trang tin: lưu cùng thư mục ảnh tin (uploads/news), tên do máy chủ đặt
const VIDEO_FILE_RE = /^[\w-]+\.(mp4|webm|mov)$/;
const LOCAL_VIDEO_SRC_RE = /^\/uploads\/news\/[\w-]+\.(mp4|webm|mov)$/;

const youtubeId = (s) => (/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([\w-]{11})(?![\w-])/.exec(s) || [])[1];
const vimeoId = (s) => (/vimeo\.com\/(?:video\/)?(\d{5,12})/.exec(s) || [])[1];

// Video đầu bài (thay / kèm ảnh bìa): link YouTube / Vimeo (đổi về dạng chuẩn) hoặc tên file video đã tải lên.
// Giá trị lạ → null (không lưu).
function normalizeNewsVideo(v) {
  const s = String(v || '').trim();
  if (!s) return null;
  if (VIDEO_FILE_RE.test(s)) return s;
  const yt = youtubeId(s);
  if (yt) return `https://www.youtube.com/watch?v=${yt}`;
  const vm = vimeoId(s);
  if (vm) return `https://vimeo.com/${vm}`;
  return null;
}
const isLocalVideo = (v) => VIDEO_FILE_RE.test(String(v || ''));

function sanitizeNewsHtml(html) {
  return sanitizeHtml(String(html || ''), {
    allowedTags: ['p', 'br', 'h2', 'h3', 'h4', 'strong', 'b', 'em', 'i', 'u', 's', 'a', 'ul', 'ol', 'li',
      'blockquote', 'img', 'figure', 'figcaption', 'hr', 'span', 'iframe', 'video', 'sub', 'sup'],
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
      img: ['src', 'alt', 'width'],
      li: ['data-list', 'class'],
      iframe: ['src', 'class', 'frameborder', 'allowfullscreen'],
      video: ['src', 'class', 'controls', 'preload', 'playsinline'],
      p: ['class'], h2: ['class'], h3: ['class'], h4: ['class'], blockquote: ['class'], span: ['class'],
    },
    allowedClasses: {
      '*': [...ALIGN_CLASSES, ...INDENT_CLASSES],
      iframe: ['ql-video'],
      video: ['ql-local-video'],
    },
    // Ảnh: chỉ ảnh đã tải lên trang tin (/uploads/news/...) hoặc link https
    allowedSchemesByTag: { img: ['https'], a: ['http', 'https', 'mailto', 'tel'] },
    allowProtocolRelative: false,
    allowedIframeHostnames: ['www.youtube.com', 'youtube.com', 'www.youtube-nocookie.com', 'player.vimeo.com'],
    exclusiveFilter: (frame) => (frame.tag === 'img' && !/^(\/uploads\/news\/[\w.-]+|https:\/\/)/.test(frame.attribs.src || ''))
      || (frame.tag === 'iframe' && !frame.attribs.src) // iframe trang lạ đã bị bỏ src → bỏ luôn thẻ
      || (frame.tag === 'video' && !LOCAL_VIDEO_SRC_RE.test(frame.attribs.src || '')), // chỉ video đã tải lên trang tin
    transformTags: {
      a: (tagName, attribs) => ({ tagName, attribs: { ...attribs, target: '_blank', rel: 'noopener noreferrer' } }),
      video: (tagName, attribs) => ({ tagName, attribs: { src: attribs.src, class: 'ql-local-video', controls: '', preload: 'metadata', playsinline: '' } }),
    },
  }).trim();
}

// Tên các file ảnh / video (đã tải lên thư mục news) được dùng trong nội dung bài
function inlineImages(html) {
  return new Set([...String(html || '').matchAll(/\/uploads\/news\/([\w-]+\.(?:jpg|png|webp|gif|mp4|webm|mov))/g)].map((m) => m[1]));
}

module.exports = { sanitizeNewsHtml, inlineImages, normalizeNewsVideo, isLocalVideo };
