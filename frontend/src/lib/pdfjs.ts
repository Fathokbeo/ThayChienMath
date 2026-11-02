// Nạp PDF.js bản "legacy" (kèm polyfill). Bản thường của pdfjs-dist 6 gọi thẳng các hàm JS rất mới
// (vd Map.getOrInsertComputed) → Chrome cũ (vd 142) và WebView Android cũ báo lỗi: không vẽ được ảnh bìa đề,
// học sinh không mở được PDF.
export async function loadPdfjs() {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const workerUrl = (await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  return pdfjs;
}
