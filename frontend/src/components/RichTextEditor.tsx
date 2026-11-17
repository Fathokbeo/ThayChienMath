import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import Quill from 'quill';
import 'quill/dist/quill.snow.css';
import { embedUrlFromLink } from '../lib/newsVideo';

// Video tải lên chèn giữa bài: thẻ <video> (Quill mặc định chỉ có video nhúng YouTube dạng iframe)
const BlockEmbed = Quill.import('blots/block/embed') as any;
class LocalVideo extends BlockEmbed {
  static blotName = 'localVideo';
  static tagName = 'VIDEO';
  static className = 'ql-local-video';
  static create(src: string) {
    const node = super.create() as HTMLVideoElement;
    node.setAttribute('src', src);
    node.setAttribute('controls', '');
    node.setAttribute('preload', 'metadata');
    node.setAttribute('playsinline', '');
    return node;
  }
  static value(node: HTMLVideoElement) { return node.getAttribute('src'); }
}
Quill.register(LocalVideo, true);

const VIDEO_UPLOAD_ICON = '<svg viewBox="0 0 18 18"><rect class="ql-stroke" x="2" y="4" width="10" height="10" rx="1.5"/><polyline class="ql-stroke" points="12 7.5 16 5 16 13 12 10.5"/><line class="ql-stroke" x1="7" y1="11.5" x2="7" y2="6.5"/><polyline class="ql-stroke" points="5 8.5 7 6.5 9 8.5"/></svg>';

export type RichTextHandle = {
  // HTML hiện tại; ảnh dán trực tiếp (dạng data:...) được tải lên máy chủ trước rồi mới trả về
  getHTML: () => Promise<string>;
};

type Props = {
  initialHtml: string;
  uploadImage: (file: Blob) => Promise<string>; // trả về đường dẫn ảnh đã lưu (vd /uploads/news/abc.jpg)
  uploadVideo?: (file: File) => Promise<string>; // trả về đường dẫn video đã lưu (vd /uploads/news/abc.mp4)
  onChange?: () => void;
  placeholder?: string;
};

const TOOLBAR = [
  [{ header: [2, 3, false] }],
  ['bold', 'italic', 'underline', 'strike'],
  [{ list: 'ordered' }, { list: 'bullet' }, 'blockquote'],
  [{ align: [] }],
  ['link', 'image', 'video', 'videoUpload'],
  ['clean'],
];

// Ô soạn nội dung bài viết (giống soạn thảo Word): tiêu đề phụ, đậm/nghiêng, danh sách, trích dẫn, căn lề,
// chèn link / ảnh / video (link YouTube, Vimeo hoặc tải file video lên). Ảnh, video chèn được tải lên máy chủ ngay,
// trong bài chỉ lưu đường dẫn.
const RichTextEditor = forwardRef<RichTextHandle, Props>(function RichTextEditor({ initialHtml, uploadImage, uploadVideo, onChange, placeholder }, ref) {
  const hostRef = useRef<HTMLDivElement>(null);
  const quillRef = useRef<Quill | null>(null);
  const uploadRef = useRef(uploadImage); uploadRef.current = uploadImage;
  const uploadVideoRef = useRef(uploadVideo); uploadVideoRef.current = uploadVideo;
  const changeRef = useRef(onChange); changeRef.current = onChange;

  useEffect(() => {
    const host = hostRef.current!;
    const editorEl = document.createElement('div');
    host.appendChild(editorEl);
    const quill = new Quill(editorEl, {
      theme: 'snow',
      placeholder: placeholder || 'Viết nội dung bài...',
      modules: {
        toolbar: {
          container: TOOLBAR,
          handlers: {
            image: () => {
              const input = document.createElement('input');
              input.type = 'file'; input.accept = 'image/*';
              input.onchange = async () => {
                const file = input.files?.[0];
                if (!file) return;
                const range = quill.getSelection(true);
                try {
                  const url = await uploadRef.current(file);
                  quill.insertEmbed(range.index, 'image', url, 'user');
                  quill.setSelection(range.index + 1, 0, 'silent');
                } catch { /* uploadImage tự báo lỗi */ }
              };
              input.click();
            },
            // Nút video: dán link YouTube / Vimeo (mọi dạng link: watch, youtu.be, shorts…)
            video: () => {
              const link = window.prompt('Dán link video YouTube hoặc Vimeo (vd https://youtu.be/...).\nMuốn đăng video có sẵn trên máy thì dùng nút "Tải video lên" bên cạnh.');
              if (!link) return;
              const embed = embedUrlFromLink(link);
              if (!embed) { window.alert('Link chưa đúng — cần link video YouTube hoặc Vimeo.'); return; }
              const range = quill.getSelection(true);
              quill.insertEmbed(range.index, 'video', embed, 'user');
              quill.setSelection(range.index + 1, 0, 'silent');
            },
            // Tải file video từ máy lên rồi chèn vào vị trí con trỏ
            videoUpload: () => {
              if (!uploadVideoRef.current) return;
              const input = document.createElement('input');
              input.type = 'file'; input.accept = 'video/mp4,video/webm,video/quicktime';
              input.onchange = async () => {
                const file = input.files?.[0];
                if (!file) return;
                const range = quill.getSelection(true);
                try {
                  const url = await uploadVideoRef.current!(file);
                  quill.insertEmbed(range.index, 'localVideo', url, 'user');
                  quill.setSelection(range.index + 1, 0, 'silent');
                } catch { /* uploadVideo tự báo lỗi */ }
              };
              input.click();
            },
          },
        },
      },
    });
    // Nút "Tải video lên" (không có sẵn trong Quill): gắn biểu tượng + chú thích; trang không cho tải video thì ẩn
    const vbtn = host.querySelector<HTMLButtonElement>('.ql-videoUpload');
    if (vbtn) {
      if (uploadVideoRef.current) { vbtn.innerHTML = VIDEO_UPLOAD_ICON; vbtn.title = 'Tải video lên (MP4, tối đa 300MB)'; } else vbtn.remove();
    }
    host.querySelector('.ql-video')?.setAttribute('title', 'Chèn video YouTube / Vimeo');
    host.querySelector('.ql-image')?.setAttribute('title', 'Chèn ảnh');
    if (initialHtml) quill.clipboard.dangerouslyPasteHTML(initialHtml, 'silent');
    quill.on('text-change', () => changeRef.current?.());
    quillRef.current = quill;
    return () => { quillRef.current = null; host.innerHTML = ''; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useImperativeHandle(ref, () => ({
    getHTML: async () => {
      const root = quillRef.current?.root;
      if (!root) return '';
      // Ảnh dán từ chỗ khác (Word, web...) đang ở dạng data: → tải lên rồi thay bằng đường dẫn
      for (const img of Array.from(root.querySelectorAll<HTMLImageElement>('img[src^="data:"]'))) {
        try { img.setAttribute('src', await uploadRef.current(await (await fetch(img.src)).blob())); }
        catch { img.remove(); }
      }
      const html = root.innerHTML;
      return html === '<p><br></p>' ? '' : html;
    },
  }), []);

  return <div ref={hostRef} className="rte" />;
});

export default RichTextEditor;
