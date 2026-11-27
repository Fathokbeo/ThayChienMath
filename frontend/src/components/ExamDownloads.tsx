import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, FileText, FileType2, Lock, LogIn, Crown, ShoppingBag, Check } from 'lucide-react';
import { fileUrl } from '../lib/api';
import Modal from './Modal';
import PaymentModal from './PaymentModal';
import { vnd, fmtDate, type FileAccess, type OrderRequest, type VipPlan, type VipStatus } from '../lib/payments';

type Props = {
  examId: number;
  access: { pdf: FileAccess; docx: FileAccess };
  payments: { enabled: boolean; vip_plans: VipPlan[] };
  vip: VipStatus | null;
  loggedIn: boolean;
  onDownload?: () => void;
  onChanged: () => void; // mua xong / lên VIP → tải lại quyền
};

const KINDS = [
  { kind: 'pdf' as const, name: 'Bản PDF', icon: FileText, bg: '#E6F0F2', fg: '#1F5C68' },
  { kind: 'docx' as const, name: 'Bản Word (sửa được)', icon: FileType2, bg: '#EFEBF5', fg: '#6E5A94' },
];

// Dòng mô tả: được tải nhờ đâu / cần làm gì để tải
function statusText(a: FileAccess, vip: VipStatus | null) {
  if (a.allowed) {
    switch (a.via) {
      case 'bought': return 'Bạn đã mua file này';
      case 'vip': return 'Đã mở bằng gói VIP';
      case 'vip_quota': return `Gói VIP · tải file này dùng 1 lượt (còn ${a.quota_left} lượt)`;
      case 'student': return 'Miễn phí cho học sinh trung tâm';
      case 'staff': return 'Giáo viên / quản trị tải được mọi file';
      default: return 'Miễn phí cho tài khoản đã đăng nhập';
    }
  }
  if (!a.flags.length) return 'Chỉ xem trên web, không tải về';
  if (a.vip_out_of_quota) return `Gói VIP đã hết lượt tải Word${vip?.vip_until ? ` · hạn ${fmtDate(vip.vip_until)}` : ''}`;
  const ways = [
    a.flags.includes('account') && 'tài khoản đã đăng nhập',
    a.flags.includes('student') && 'học sinh trung tâm',
    a.flags.includes('vip') && 'tài khoản VIP',
    a.flags.includes('buy') && a.price && `mua lẻ ${vnd(a.price)}`,
  ].filter(Boolean);
  return `Tải được với: ${ways.join(' · ')}`;
}

// Khối tải đề ở trang chi tiết: mỗi bản (PDF / Word) một dòng — nút tải nếu đã có quyền, còn không thì nút
// Đăng nhập / Mua file / Nâng cấp VIP tùy admin tích. Bấm mua → hộp QR, tiền về là mở khóa ngay.
export default function ExamDownloads({ examId, access, payments, vip, loggedIn, onDownload, onChanged }: Props) {
  const [request, setRequest] = useState<OrderRequest | null>(null);
  const [choosingVip, setChoosingVip] = useState(false);
  const files = KINDS.filter((k) => access[k.kind]?.has_file);
  if (!files.length) return null;
  const next = encodeURIComponent(`/de-thi/${examId}`);

  return (
    <div className="dl-panel">
      {files.map(({ kind, name, icon: Icon, bg, fg }) => {
        const a = access[kind];
        const canBuy = !a.allowed && loggedIn && payments.enabled && a.flags.includes('buy') && !!a.price;
        const canVip = !a.allowed && loggedIn && payments.enabled && a.flags.includes('vip') && payments.vip_plans.length > 0;
        return (
          <div key={kind} className="dl-file">
            <span className="dl-icon" style={{ background: bg, color: fg }}>{a.allowed ? <Icon size={20} /> : <Lock size={18} />}</span>
            <div className="dl-info">
              <div className="dl-name">{name} {a.via?.startsWith('vip') && <span className="vip-badge"><Crown size={11} /> VIP</span>}</div>
              <div className="dl-sub">{statusText(a, vip)}</div>
            </div>
            <div className="dl-actions">
              {a.allowed ? (
                <a href={fileUrl(`/api/public/exams/${examId}/file/${kind}`)} download className="btn btn-primary btn-sm"
                  onClick={() => { onDownload?.(); if (a.via === 'vip_quota') setTimeout(onChanged, 1500); }}>
                  <Download size={14} /> Tải về
                </a>
              ) : a.need_login ? (
                <Link to={`/login?muc=khach&next=${next}`} className="btn btn-primary btn-sm"><LogIn size={14} /> Đăng nhập để tải</Link>
              ) : (
                <>
                  {canBuy && <button type="button" className="btn btn-primary btn-sm" onClick={() => setRequest({ kind: 'file', exam_id: examId, file_kind: kind })}><ShoppingBag size={14} /> Mua file · {vnd(a.price)}</button>}
                  {canVip && <button type="button" className="btn btn-sm vip-btn" onClick={() => setChoosingVip(true)}><Crown size={14} /> {a.vip_out_of_quota ? 'Gia hạn VIP' : 'Nâng cấp VIP'}</button>}
                  {!canBuy && !canVip && a.flags.some((f) => f === 'buy' || f === 'vip') && !payments.enabled && <span className="dl-sub">Trung tâm chưa mở thanh toán trực tuyến</span>}
                </>
              )}
            </div>
          </div>
        );
      })}

      <VipPlansModal open={choosingVip} plans={payments.vip_plans} vip={vip} onClose={() => setChoosingVip(false)}
        onPick={(p) => { setChoosingVip(false); setRequest({ kind: 'vip', plan_id: p.id }); }} />
      <PaymentModal request={request} onClose={() => setRequest(null)} onPaid={onChanged} />
    </div>
  );
}

// Chọn gói VIP (dùng ở trang đề và trang tài khoản)
export function VipPlansModal({ open, plans, vip, onClose, onPick }: { open: boolean; plans: VipPlan[]; vip: VipStatus | null; onClose: () => void; onPick: (p: VipPlan) => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Nâng cấp tài khoản VIP">
      {vip?.vip && <div className="vip-current"><Crown size={15} /> Bạn đang là VIP đến {fmtDate(vip.vip_until)} · còn {vip.word_quota} lượt tải Word. Mua thêm sẽ cộng dồn.</div>}
      <div className="vip-plans">
        {plans.map((p) => (
          <button key={p.id} type="button" className="vip-plan" onClick={() => onPick(p)}>
            <span className="vip-plan-name"><Crown size={16} /> {p.name}</span>
            <span className="vip-plan-price">{vnd(p.price)}</span>
            <span className="vip-plan-feats">
              <span><Check size={14} /> Dùng {p.days} ngày</span>
              <span><Check size={14} /> Tải {p.word_quota > 0 ? `${p.word_quota} file Word` : 'các file dành cho VIP'}</span>
              <span><Check size={14} /> Tải PDF các đề dành cho VIP</span>
            </span>
          </button>
        ))}
        {!plans.length && <div className="dl-sub">Trung tâm chưa mở gói VIP.</div>}
      </div>
    </Modal>
  );
}
