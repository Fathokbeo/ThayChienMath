// Kiểu dữ liệu + tiện ích dùng chung cho thanh toán QR, VIP và quyền tải file đề.

export type AccessFlag = 'account' | 'student' | 'vip' | 'buy';
export type FileAccess = {
  has_file: boolean; allowed: boolean; via: string | null; flags: AccessFlag[]; price: number | null;
  need_login?: boolean; vip_out_of_quota?: boolean; quota_left?: number;
};
export type VipPlan = { id: string; name: string; price: number; days: number; word_quota: number };
export type VipStatus = { vip: boolean; vip_until: string | null; word_quota: number };
export type PaymentOrder = {
  code: string; kind: 'vip' | 'file'; title: string; amount: number; status: 'pending' | 'paid' | 'cancelled';
  exam_id?: number | null; file_kind?: 'pdf' | 'docx' | null; created_at: string; paid_at?: string | null;
  bank: { name: string; bin: string; account: string; account_name: string }; qr: string | null;
};
export type OrderRequest = { kind: 'vip'; plan_id: string } | { kind: 'file'; exam_id: number; file_kind: 'pdf' | 'docx' };

export const ACCESS_OPTIONS: { value: AccessFlag; label: string; hint: string }[] = [
  { value: 'account', label: 'Mọi tài khoản', hint: 'Ai đã đăng nhập (kể cả tài khoản khách) đều tải miễn phí' },
  { value: 'student', label: 'Học sinh trung tâm', hint: 'Tài khoản học sinh tải miễn phí' },
  { value: 'vip', label: 'Tài khoản VIP', hint: 'Tải khi đã mua gói VIP (file Word trừ lượt tải của gói)' },
  { value: 'buy', label: 'Mua lẻ file này', hint: 'Ai muốn tải thì trả tiền riêng cho file này' },
];

export const vnd = (n: number | null | undefined) => (n == null ? '' : `${n.toLocaleString('vi-VN')}đ`);
export const parseFlags = (s?: string | null): AccessFlag[] => String(s || '').split(',').map((x) => x.trim()).filter(Boolean) as AccessFlag[];
export const fmtDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '');
