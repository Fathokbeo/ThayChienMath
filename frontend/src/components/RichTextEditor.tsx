import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import Quill from 'quill';
import 'quill/dist/quill.snow.css';

export type RichTextHandle = {
  // HTML hiện tại; ảnh dán trực tiếp (dạng data:...) được tải lên máy chủ trước rồi mới trả về
  getHTML: () => Promise<string>;
};

type Props = {
  initialHtml: string;
  uploadImage: (file: Blob) => Promise<string>; // trả về đường dẫn ảnh đã lưu (vd /uploads/news/abc.jpg)
  onChange?: () => void;
  placeholder?: string;
};

const TOOLBAR = [
  [{ header: [2, 3, false] }],
  ['bold', 'italic', 'underline', 'strike'],
  [{ list: 'ordered' }, { list: 'bullet' }, 'blockquote'],
  [{ align: [] }],
  ['link', 'image', 'video'],
  ['clean'],
];

// Ô soạn nội dung bài viết (giống soạn thảo Word): tiêu đề phụ, đậm/nghiêng, danh sách, trích dẫn, căn lề,
// chèn link / ảnh / video YouTube. Ảnh chèn được tải lên máy chủ ngay, trong bài chỉ lưu đường dẫn.
const RichTextEditor = forwardRef<RichTextHandle, Props>(function RichTextEditor({ initialHtml, uploadImage, onChange, placeholder }, ref) {
  const hostRef = useRef<HTMLDivElement>(null);
  const quillRef = useRef<Quill | null>(null);
  const uploadRef = useRef(uploadImage); uploadRef.current = uploadImage;
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
          },
        },
      },
    });
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
