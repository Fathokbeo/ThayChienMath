// Nội dung bài tin tức: HTML do trình soạn thảo (Quill) ở trang quản trị tạo ra. Luôn làm sạch trước khi lưu —
// chỉ giữ các thẻ định dạng bài báo (đoạn, tiêu đề, đậm/nghiêng, danh sách, trích dẫn, link, ảnh, video YouTube),
// bỏ hết script/style/thuộc tính lạ, để trang tin công khai không bị chèn mã độc.
const sanitizeHtml = require('sanitize-html');

const ALIGN_CLASSES = ['ql-align-center', 'ql-align-right', 'ql-align-justify'];
const INDENT_CLASSES = Array.from({ length: 8 }, (_, i) => `ql-indent-${i + 1}`);

function sanitizeNewsHtml(html) {
  return sanitizeHtml(String(html || ''), {
    allowedTags: ['p', 'br', 'h2', 'h3', 'h4', 'strong', 'b', 'em', 'i', 'u', 's', 'a', 'ul', 'ol', 'li',
      'blockquote', 'img', 'figure', 'figcaption', 'hr', 'span', 'iframe', 'sub', 'sup'],
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
      img: ['src', 'alt', 'width'],
      li: ['data-list', 'class'],
      iframe: ['src', 'class', 'frameborder', 'allowfullscreen'],
      p: ['class'], h2: ['class'], h3: ['class'], h4: ['class'], blockquote: ['class'], span: ['class'],
    },
    allowedClasses: {
      '*': [...ALIGN_CLASSES, ...INDENT_CLASSES],
      iframe: ['ql-video'],
    },
    // Ảnh: chỉ ảnh đã tải lên trang tin (/uploads/news/...) hoặc link https
    allowedSchemesByTag: { img: ['https'], a: ['http', 'https', 'mailto', 'tel'] },
    allowProtocolRelative: false,
    allowedIframeHostnames: ['www.youtube.com', 'youtube.com', 'www.youtube-nocookie.com', 'player.vimeo.com'],
    exclusiveFilter: (frame) => (frame.tag === 'img' && !/^(\/uploads\/news\/[\w.-]+|https:\/\/)/.test(frame.attribs.src || ''))
      || (frame.tag === 'iframe' && !frame.attribs.src), // iframe trang lạ đã bị bỏ src → bỏ luôn thẻ
    transformTags: {
      a: (tagName, attribs) => ({ tagName, attribs: { ...attribs, target: '_blank', rel: 'noopener noreferrer' } }),
    },
  }).trim();
}

// Tên các file ảnh (đã tải lên thư mục news) được dùng trong nội dung bài
function inlineImages(html) {
  return new Set([...String(html || '').matchAll(/\/uploads\/news\/([\w-]+\.(?:jpg|png|webp|gif))/g)].map((m) => m[1]));
}

module.exports = { sanitizeNewsHtml, inlineImages };
