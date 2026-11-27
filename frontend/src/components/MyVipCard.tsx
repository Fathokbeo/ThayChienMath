import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Crown, FileText, FileType2, Receipt } from 'lucide-react';
import api from '../lib/api';
import PaymentModal from './PaymentModal';
import { VipPlansModal } from './ExamDownloads';
import { vnd, fmtDate, type OrderRequest, type VipPlan, type VipStatus } from '../lib/payments';

type Me = VipStatus & {
  orders: { code: string; kind: 'vip' | 'file'; plan_id: string | null; title: string; amount: number; status: string; exam_id: number | null; file_kind: 'pdf' | 'docx' | null; created_at: string }[];
  files: { exam_id: number; kind: 'pdf' | 'docx'; source: string; title: string; created_at: string }[];
};

// Trang tài khoản khách: trạng thái VIP, nâng cấp / gia hạn, file đã mua, đơn đang chờ thanh toán
export default function MyVipCard({ isMobile }: { isMobile: boolean }) {
  const [me, setMe] = useState<Me | null>(null);
  const [cfg, setCfg] = useState<{ enabled: boolean; vip_plans: VipPlan[] } | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [request, setRequest] = useState<OrderRequest | null>(null);
  const load = useCallback(() => { api.get('/payments/me').then((r) => setMe(r.data)).catch(() => {}); }, []);
  useEffect(() => { load(); api.get('/payments/config').then((r) => setCfg(r.data)).catch(() => {}); }, [load]);
  if (!me || !cfg) return null;
  if (!cfg.enabled && !me.vip && !me.files.length && !me.orders.length) return null; // chưa bật thanh toán, chưa mua gì → ẩn

  const pending = me.orders.filter((o) => o.status === 'pending');
  const resume = (o: Me['orders'][number]) => setRequest(o.kind === 'vip'
    ? { kind: 'vip', plan_id: o.plan_id || '' } : { kind: 'file', exam_id: o.exam_id || 0, file_kind: o.file_kind || 'docx' });

  return (
    <div className={`myvip ${me.vip ? 'on' : ''}`} style={{ padding: isMobile ? '1.15rem' : '1.4rem 1.8rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <span className="myvip-icon"><Crown size={22} /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: '1.05rem' }}>{me.vip ? 'Tài khoản VIP' : 'Tài khoản thường'}</div>
          <div style={{ fontSize: '0.86rem', color: '#6E6E73' }}>
            {me.vip ? `Hạn dùng đến ${fmtDate(me.vip_until)} · còn ${me.word_quota} lượt tải file Word` : 'Nâng cấp VIP để tải các đề dành cho VIP, gồm cả bản Word sửa được.'}
          </div>
        </div>
        {cfg.enabled && cfg.vip_plans.length > 0 && (
          <button className="btn vip-btn" onClick={() => setChoosing(true)}><Crown size={15} /> {me.vip ? 'Gia hạn / thêm lượt' : 'Nâng cấp VIP'}</button>
        )}
      </div>

      {pending.length > 0 && (
        <div className="myvip-sec">
          <div className="myvip-head">Đang chờ thanh toán</div>
          {pending.map((o) => (
            <div key={o.code} className="myvip-row"><Receipt size={15} /><span>{o.title} · <b>{vnd(o.amount)}</b></span>
              <button className="btn btn-ghost btn-sm" onClick={() => resume(o)}>Thanh toán tiếp</button></div>
          ))}
        </div>
      )}

      {me.files.length > 0 && (
        <div className="myvip-sec">
          <div className="myvip-head">File đã mở khóa ({me.files.length})</div>
          {me.files.slice(0, 12).map((f) => (
            <Link key={`${f.exam_id}-${f.kind}`} to={`/de-thi/${f.exam_id}`} className="myvip-row">
              {f.kind === 'pdf' ? <FileText size={15} /> : <FileType2 size={15} />}
              <span>{f.title} <small>· {f.kind === 'pdf' ? 'PDF' : 'Word'} · {f.source === 'buy' ? 'đã mua' : 'lượt VIP'}</small></span>
            </Link>
          ))}
        </div>
      )}

      <VipPlansModal open={choosing} plans={cfg.vip_plans} vip={me} onClose={() => setChoosing(false)}
        onPick={(p) => { setChoosing(false); setRequest({ kind: 'vip', plan_id: p.id }); }} />
      <PaymentModal request={request} onClose={() => { setRequest(null); load(); }} onPaid={load} />
    </div>
  );
}
