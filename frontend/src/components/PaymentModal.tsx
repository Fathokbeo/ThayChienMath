import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { CheckCircle2, Copy, Loader2, Smartphone } from 'lucide-react';
import api from '../lib/api';
import Modal from './Modal';
import { toast } from './Toast';
import { vnd, type OrderRequest, type PaymentOrder } from '../lib/payments';

const POLL_MS = 3000;

// Hộp thanh toán: tạo đơn → hiện mã QR VietQR (đã điền sẵn số tiền + nội dung) → hỏi máy chủ mỗi 3 giây
// xem ngân hàng đã báo tiền về chưa → báo thành công và gọi onPaid (mở quyền tải / VIP ngay, không cần tải lại trang).
export default function PaymentModal({ request, onClose, onPaid }: { request: OrderRequest | null; onClose: () => void; onPaid?: (o: PaymentOrder) => void }) {
  const [order, setOrder] = useState<PaymentOrder | null>(null);
  const [error, setError] = useState('');
  const [qrImg, setQrImg] = useState('');
  const paidRef = useRef(false);

  // Tạo (hoặc lấy lại) đơn khi mở hộp
  useEffect(() => {
    setOrder(null); setError(''); setQrImg(''); paidRef.current = false;
    if (!request) return;
    api.post('/payments/orders', request).then((r) => setOrder(r.data))
      .catch((e) => setError(e.response?.data?.message || 'Không tạo được đơn thanh toán'));
  }, [request]);

  // Vẽ mã QR từ chuỗi VietQR máy chủ trả về
  useEffect(() => {
    if (!order?.qr) return;
    QRCode.toDataURL(order.qr, { width: 520, margin: 1, errorCorrectionLevel: 'M', color: { dark: '#1D1D1F', light: '#FFFFFF' } })
      .then(setQrImg).catch(() => setQrImg(''));
  }, [order?.qr]);

  // Chờ ngân hàng báo tiền về
  useEffect(() => {
    if (!order || order.status !== 'pending') return;
    const t = setInterval(() => {
      api.get(`/payments/orders/${order.code}`).then((r) => {
        const o: PaymentOrder = r.data;
        if (o.status !== 'pending') setOrder(o);
        if (o.status === 'paid' && !paidRef.current) { paidRef.current = true; onPaid?.(o); }
      }).catch(() => {});
    }, POLL_MS);
    return () => clearInterval(t);
  }, [order, onPaid]);

  const copy = (text: string, what: string) => navigator.clipboard?.writeText(text).then(() => toast.success(`Đã sao chép ${what}`), () => {});
  const paid = order?.status === 'paid';

  return (
    <Modal open={!!request} onClose={onClose} title={paid ? 'Thanh toán thành công' : 'Thanh toán chuyển khoản'}
      footer={<button className="btn btn-ghost" onClick={onClose}>{paid ? 'Xong' : 'Đóng'}</button>}>
      {error ? (
        <div className="pay-error">{error}</div>
      ) : !order ? (
        <div className="pay-loading"><Loader2 size={22} className="spin" /> Đang tạo mã thanh toán…</div>
      ) : paid ? (
        <div className="pay-done">
          <CheckCircle2 size={56} color="#3A7D5C" />
          <div className="pay-done-title">Đã nhận {vnd(order.amount)}</div>
          <div className="pay-done-sub">{order.title}</div>
          <div className="pay-done-sub">{order.kind === 'vip' ? 'Tài khoản của bạn đã lên VIP.' : 'Bạn đã tải được file này — bấm nút tải ở trang đề.'}</div>
        </div>
      ) : (
        <div className="pay-box">
          <div className="pay-item">{order.title}</div>
          <div className="pay-amount">{vnd(order.amount)}</div>
          <div className="pay-qr">
            {qrImg ? <img src={qrImg} alt={`Mã QR chuyển ${vnd(order.amount)}`} /> : <Loader2 size={26} className="spin" />}
          </div>
          <div className="pay-hint"><Smartphone size={15} /> Mở app ngân hàng → <b>Quét mã QR</b> → kiểm tra rồi xác nhận chuyển</div>
          <div className="pay-rows">
            <div className="pay-row"><span>Ngân hàng</span><b>{order.bank.name || order.bank.bin}</b></div>
            <div className="pay-row"><span>Số tài khoản</span><b>{order.bank.account}</b>
              <button type="button" onClick={() => copy(order.bank.account, 'số tài khoản')} aria-label="Sao chép số tài khoản"><Copy size={14} /></button></div>
            <div className="pay-row"><span>Chủ tài khoản</span><b>{order.bank.account_name}</b></div>
            <div className="pay-row"><span>Nội dung</span><b className="pay-code">{order.code}</b>
              <button type="button" onClick={() => copy(order.code, 'nội dung chuyển khoản')} aria-label="Sao chép nội dung"><Copy size={14} /></button></div>
          </div>
          <div className="pay-wait"><span className="pay-dot" /> Đang chờ thanh toán — trang tự cập nhật khi tiền về</div>
          <div className="pay-note">Chuyển khoản tay thì nhớ ghi đúng nội dung <b>{order.code}</b> để hệ thống tự nhận.</div>
        </div>
      )}
    </Modal>
  );
}
