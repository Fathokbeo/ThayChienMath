import { Capacitor } from '@capacitor/core';

// Các xử lý riêng cho app Android (Capacitor). Bản web không gọi tới plugin nào — mọi hàm ở đây
// kiểm tra IS_NATIVE trước, và plugin chỉ được nạp (import động) khi chạy trong app.
export const IS_NATIVE = Capacitor.isNativePlatform();

// Trang "gốc" — bấm Back ở đây thì thu nhỏ app thay vì lùi về trang trước (vd lùi về trang đăng nhập).
const ROOT_PATHS = new Set(['/', '/login', '/admin', '/teacher', '/student', '/parent']);

// Đóng lớp phủ trên cùng (menu, bảng tìm nhanh, hộp thoại, màn làm bài) giống thao tác Esc / bấm ra ngoài.
// Trả về true nếu có lớp phủ để đóng.
function closeTopLayer(): boolean {
  // Menu thả xuống (tài khoản, Trang chủ, "Thêm") — các menu này tự đóng khi nhấn Esc
  if (document.querySelector('.menu-panel')) {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    return true;
  }
  const paletteInput = document.querySelector<HTMLInputElement>('.palette-overlay input');
  if (paletteInput) {
    paletteInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    return true;
  }
  // Hộp thoại: bấm vào nền mờ (đúng phần tử nền) là đóng — hộp nào cố ý không đóng khi bấm nền thì vẫn giữ nguyên
  const overlays = document.querySelectorAll<HTMLElement>('.modal-overlay');
  if (overlays.length) {
    overlays[overlays.length - 1].click();
    return true;
  }
  // Màn hình toàn trang (làm bài / nộp bài): bấm nút Đóng của màn đó
  const screen = document.querySelector<HTMLElement>('.safe-screen');
  if (screen) {
    screen.querySelector<HTMLElement>('button[title="Đóng"]')?.click();
    return true;
  }
  return false;
}

// Nút Back của Android: đóng lớp phủ → lùi trang → ở trang gốc thì thu nhỏ app (không thoát hẳn).
export async function initBackButton() {
  if (!IS_NATIVE) return;
  const { App } = await import('@capacitor/app');
  App.addListener('backButton', ({ canGoBack }) => {
    if (closeTopLayer()) return;
    if (canGoBack && !ROOT_PATHS.has(window.location.pathname)) window.history.back();
    else App.minimizeApp();
  });
}

// File tạo ngay trên máy (PDF nhận xét, Excel bảng điểm…): WebView không tải được kiểu "tải xuống" như trình
// duyệt, nên ghi vào bộ nhớ tạm của app rồi mở bảng Chia sẻ của Android — lưu vào Files/Drive hoặc gửi Zalo.
// Chỉ gọi khi IS_NATIVE; bản web vẫn tải về như cũ.
export async function shareGeneratedFile(filename: string, base64: string) {
  const { Filesystem, Directory } = await import('@capacitor/filesystem');
  const { Share } = await import('@capacitor/share');
  const { uri } = await Filesystem.writeFile({ path: filename.replace(/[\\/:*?"<>|]/g, '-'), data: base64, directory: Directory.Cache });
  try {
    await Share.share({ title: filename, files: [uri] });
  } catch (e: any) {
    // Người dùng tự đóng bảng Chia sẻ — không phải lỗi
    if (!/cancel/i.test(String(e?.message ?? e))) throw e;
  }
}

// Xuất Excel: web tải về như cũ, app mở bảng Chia sẻ.
export async function saveWorkbook(XLSX: typeof import('xlsx'), wb: import('xlsx').WorkBook, filename: string) {
  if (!IS_NATIVE) { XLSX.writeFile(wb, filename); return; }
  await shareGeneratedFile(filename, XLSX.write(wb, { type: 'base64', bookType: 'xlsx' }));
}

// Xuất PDF (jsPDF): web tải về như cũ, app mở bảng Chia sẻ.
export async function savePdf(pdf: import('jspdf').jsPDF, filename: string) {
  if (!IS_NATIVE) { pdf.save(filename); return; }
  await shareGeneratedFile(filename, pdf.output('datauristring').split(',')[1]);
}
