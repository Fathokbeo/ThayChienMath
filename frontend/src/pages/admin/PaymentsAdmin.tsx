import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { Check, Copy, Crown, Eye, EyeOff, Plus, RefreshCw, Trash2, X, Landmark, Webhook, Receipt } from 'lucide-react';
import api from '../../lib/api';
import { toast } from '../../components/Toast';
import { PageHeader } from '../../components/ui';
import { BANKS } from '../../lib/banks';
import { vnd, type VipPlan } from '../../lib/payments';

type Config = {
  enabled: boolean; ready: boolean; bank_bin: string; bank_name: string; bank_account: string; bank_account_name: string;
  webhook_key: string; vip_plans: VipPlan[];
};
type Order = {
  id: number; code: string; kind: 'vip' | 'file'; title: string; amount: number; status: 'pending' | 'paid' | 'cancelled';
  paid_amount: number | null; paid_at: string | null; paid_via: string | null; created_at: string;
  full_name: string | null; username: string | null; email: string | null;
};

const STATUS: Record<Order['status'], { label: string; cls: string }> = {
  pending: { label: 'Chờ thanh toán', cls: 'badge-orange' },
  paid: { label: 'Đã thanh toán', cls: 'badge-green' },
  cancelled: { label: 'Đã hủy', cls: 'badge-gray' },
};
const fmtTime = (s: string | null) => (s ? new Date(s.replace(' ', 'T') + (s.includes('T') ? '' : 'Z')).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : '');

// Tạo chuỗi VietQR ở trình duyệt để admin quét thử trước khi bật (cùng thuật toán với máy chủ)
const tlv = (id: string, v: string) => `${id}${String(v.length).padStart(2, '0')}${v}`;
function crc16(s: string) {
  let c = 0xffff;
  for (const b of new TextEncoder().encode(s)) { c ^= b << 8; for (let i = 0; i < 8; i++) c = c & 0x8000 ? ((c << 1) ^ 0x1021) & 0xffff : (c << 1) & 0xffff; }
  return c.toString(16).toUpperCase().padStart(4, '0');
}
function testQr(bin: string, account: string) {
  const m = tlv('00', 'A000000727') + tlv('01', tlv('00', bin) + tlv('01', account)) + tlv('02', 'QRIBFTTA');
  const s = tlv('00', '01') + tlv('01', '12') + tlv('38', m) + tlv('53', '704') + tlv('54', '10000') + tlv('58', 'VN') + tlv('62', tlv('08', 'QUET THU')) + '6304';
  return s + crc16(s);
}

// Trang Thanh toán & VIP (mục Trang web): tài khoản nhận tiền, gói VIP, tự xác nhận qua webhook, danh sách đơn
export default function PaymentsAdmin() {
  const [cfg, setCfg] = useState<Config | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [month, setMonth] = useState<{ n: number; total: number }>({ n: 0, total: 0 });
  const [saving, setSaving] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [filter, setFilter] = useState<'all' | Order['status']>('all');
  const [qrImg, setQrImg] = useState('');

  const load = () => api.get('/admin/site/payments').then((r) => { setCfg(r.data.config); setOrders(r.data.orders); setMonth(r.data.month); });
  useEffect(() => { load(); }, []);

  const bankKnown = !!cfg && BANKS.some((b) => b.bin === cfg.bank_bin);
  const [otherBank, setOtherBank] = useState(false);
  useEffect(() => { if (cfg && cfg.bank_bin && !bankKnown) setOtherBank(true); }, [cfg?.bank_bin]); // eslint-disable-line react-hooks/exhaustive-deps

  const canPreview = !!cfg && /^\d{6}$/.test(cfg.bank_bin) && !!cfg.bank_account;
  useEffect(() => {
    if (!canPreview || !cfg) { setQrImg(''); return; }
    QRCode.toDataURL(testQr(cfg.bank_bin, cfg.bank_account), { width: 360, margin: 1 }).then(setQrImg).catch(() => setQrImg(''));
  }, [canPreview, cfg?.bank_bin, cfg?.bank_account]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async (patch: Partial<Config> = {}) => {
    if (!cfg) return;
    const next = { ...cfg, ...patch };
    if (next.enabled && !(/^\d{6}$/.test(next.bank_bin) && next.bank_account && next.bank_account_name)) {
      toast.error('Điền đủ ngân hàng, số tài khoản, tên chủ tài khoản trước khi bật'); return;
    }
    setSaving(true);
    try {
      const r = await api.put('/admin/site/payments/config', {
        payments_enabled: next.enabled, bank_bin: next.bank_bin, bank_name: next.bank_name, bank_account: next.bank_account,
        bank_account_name: next.bank_account_name, vip_plans: next.vip_plans,
      });
      setCfg({ ...r.data.config, webhook_key: cfg.webhook_key });
      toast.success('Đã lưu');
    } catch (e: any) { toast.error(e.response?.data?.message || 'Lỗi lưu'); } finally { setSaving(false); }
  };

  const rotateKey = async () => {
    if (cfg?.webhook_key && !confirm('Tạo khóa mới? Khóa cũ hết hiệu lực ngay — phải dán khóa mới vào dịch vụ đọc giao dịch.')) return;
    const r = await api.post('/admin/site/payments/webhook-key');
    setCfg((c) => (c ? { ...c, webhook_key: r.data.webhook_key } : c)); setShowKey(true);
    toast.success('Đã tạo khóa mới');
  };
  const confirmOrder = async (o: Order) => {
    if (!confirm(`Xác nhận đã nhận ${vnd(o.amount)} cho đơn ${o.code}? Người mua sẽ được mở quyền ngay.`)) return;
    await api.post(`/admin/site/payments/orders/${o.id}/confirm`); toast.success('Đã xác nhận'); load();
  };
  const cancelOrder = async (o: Order) => { await api.post(`/admin/site/payments/orders/${o.id}/cancel`); load(); };
  const copy = (t: string) => navigator.clipboard?.writeText(t).then(() => toast.success('Đã sao chép'), () => {});

  const webhookUrl = `${window.location.origin}/api/payments/webhook`;
  const shown = useMemo(() => orders.filter((o) => filter === 'all' || o.status === filter), [orders, filter]);
  const pendingCount = orders.filter((o) => o.status === 'pending').length;
  if (!cfg) return <div style={{ color: '#86868B' }}>Đang tải...</div>;

  const setPlan = (i: number, patch: Partial<VipPlan>) => setCfg({ ...cfg, vip_plans: cfg.vip_plans.map((p, k) => (k === i ? { ...p, ...patch } : p)) });

  return (
    <div className="fade-in">
      <PageHeader title="Thanh toán & VIP" subtitle="Khách quét mã QR để mua file đề lẻ hoặc gói VIP — tiền vào thẳng tài khoản của trung tâm." />

      {/* Bật / tắt + doanh thu tháng */}
      <div className={`pay-switch ${cfg.enabled && cfg.ready ? 'on' : ''}`}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700 }}>{cfg.enabled && cfg.ready ? 'Đang nhận thanh toán' : 'Chưa bật thanh toán'}</div>
          <div style={{ fontSize: '0.84rem', color: '#6E6E73' }}>
            {cfg.enabled && cfg.ready ? `Tháng này: ${month.n} đơn · ${vnd(month.total)}` : 'Khách chưa thấy nút Mua file / Nâng cấp VIP cho tới khi bật.'}
            {pendingCount > 0 && ` · ${pendingCount} đơn đang chờ`}
          </div>
        </div>
        <button className={`btn ${cfg.enabled ? 'btn-ghost' : 'btn-primary'}`} disabled={saving} onClick={() => save({ enabled: !cfg.enabled })}>
          {cfg.enabled ? 'Tắt thanh toán' : 'Bật thanh toán'}
        </button>
      </div>

      <div className="pay-admin-grid">
        {/* 1. Tài khoản nhận tiền */}
        <section className="card pay-admin-card">
          <h3><Landmark size={17} /> Tài khoản nhận tiền</h3>
          <label className="form-field"><span>Ngân hàng</span>
            <select className="input" value={otherBank ? '__other' : cfg.bank_bin} onChange={(e) => {
              if (e.target.value === '__other') { setOtherBank(true); return; }
              setOtherBank(false); const b = BANKS.find((x) => x.bin === e.target.value);
              setCfg({ ...cfg, bank_bin: e.target.value, bank_name: b?.name || '' });
            }}>
              <option value="">— Chọn ngân hàng —</option>
              {BANKS.map((b) => <option key={b.bin} value={b.bin}>{b.name}</option>)}
              <option value="__other">Ngân hàng khác (nhập mã BIN)…</option>
            </select></label>
          {otherBank && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <label className="form-field"><span>Tên ngân hàng</span><input className="input" value={cfg.bank_name} onChange={(e) => setCfg({ ...cfg, bank_name: e.target.value })} /></label>
              <label className="form-field"><span>Mã BIN (6 số)</span><input className="input" inputMode="numeric" value={cfg.bank_bin} onChange={(e) => setCfg({ ...cfg, bank_bin: e.target.value.replace(/\D/g, '').slice(0, 6) })} /></label>
            </div>
          )}
          <label className="form-field"><span>Số tài khoản</span>
            <input className="input" inputMode="numeric" value={cfg.bank_account} onChange={(e) => setCfg({ ...cfg, bank_account: e.target.value.replace(/\s/g, '') })} /></label>
          <label className="form-field"><span>Tên chủ tài khoản (viết hoa không dấu)</span>
            <input className="input" value={cfg.bank_account_name} onChange={(e) => setCfg({ ...cfg, bank_account_name: e.target.value.toUpperCase() })} placeholder="vd NGUYEN VAN CHIEN" /></label>
          {qrImg && (
            <div className="pay-test">
              <img src={qrImg} alt="Mã QR quét thử" />
              <div><b>Quét thử trước khi bật</b><br />Mở app ngân hàng quét mã này: phải hiện đúng tên chủ tài khoản và số tiền 10.000đ. Chỉ cần kiểm tra, không cần chuyển.</div>
            </div>
          )}
          <button className="btn btn-primary" disabled={saving} onClick={() => save()}>Lưu tài khoản nhận tiền</button>
        </section>

        {/* 2. Gói VIP */}
        <section className="card pay-admin-card">
          <h3><Crown size={17} /> Gói VIP</h3>
          <p className="pay-admin-sub">VIP tải được các file admin tích "Tài khoản VIP". File Word trừ 1 lượt cho mỗi file mới; PDF không giới hạn.</p>
          {cfg.vip_plans.map((p, i) => (
            <div key={p.id} className="vip-plan-edit">
              <input className="input" value={p.name} onChange={(e) => setPlan(i, { name: e.target.value })} placeholder="Tên gói, vd VIP 1 tháng" />
              <label>Giá<input className="input" inputMode="numeric" value={p.price || ''} onChange={(e) => setPlan(i, { price: Number(e.target.value.replace(/\D/g, '')) })} /></label>
              <label>Số ngày<input className="input" inputMode="numeric" value={p.days || ''} onChange={(e) => setPlan(i, { days: Number(e.target.value.replace(/\D/g, '')) })} /></label>
              <label>Lượt tải Word<input className="input" inputMode="numeric" value={p.word_quota ?? ''} onChange={(e) => setPlan(i, { word_quota: Number(e.target.value.replace(/\D/g, '')) })} /></label>
              <button className="btn btn-ghost btn-sm btn-icon" title="Xóa gói" onClick={() => setCfg({ ...cfg, vip_plans: cfg.vip_plans.filter((_, k) => k !== i) })}><Trash2 size={15} /></button>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-ghost" onClick={() => setCfg({ ...cfg, vip_plans: [...cfg.vip_plans, { id: Math.random().toString(36).slice(2, 8), name: `VIP ${cfg.vip_plans.length ? cfg.vip_plans.length + 1 : 1} tháng`, price: 99000, days: 30, word_quota: 20 }] })}>
              <Plus size={15} /> Thêm gói
            </button>
            <button className="btn btn-primary" disabled={saving} onClick={() => save()}>Lưu gói VIP</button>
          </div>
        </section>

        {/* 3. Tự xác nhận thanh toán */}
        <section className="card pay-admin-card">
          <h3><Webhook size={17} /> Tự xác nhận khi tiền về</h3>
          <p className="pay-admin-sub">
            Đăng ký một dịch vụ đọc giao dịch ngân hàng (vd <b>SePay</b>, <b>Casso</b>), liên kết tài khoản nhận tiền ở trên, rồi trong phần <b>Webhook</b> của dịch vụ đó dán 2 thông tin dưới đây. Mỗi khi có tiền vào kèm nội dung là mã đơn (vd EGK7M2QX), web tự mở quyền cho khách.
          </p>
          <label className="form-field"><span>Địa chỉ webhook (URL)</span>
            <div className="pay-copy"><code>{webhookUrl}</code><button className="btn btn-ghost btn-sm btn-icon" onClick={() => copy(webhookUrl)}><Copy size={14} /></button></div></label>
          <label className="form-field"><span>Khóa bí mật (API key)</span>
            {cfg.webhook_key ? (
              <div className="pay-copy"><code>{showKey ? cfg.webhook_key : '•'.repeat(24)}</code>
                <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setShowKey((v) => !v)}>{showKey ? <EyeOff size={14} /> : <Eye size={14} />}</button>
                <button className="btn btn-ghost btn-sm btn-icon" onClick={() => copy(cfg.webhook_key)}><Copy size={14} /></button></div>
            ) : <div className="pay-admin-sub" style={{ margin: 0 }}>Chưa có khóa — bấm tạo khóa.</div>}
          </label>
          <p className="pay-admin-sub" style={{ marginTop: 0 }}>Dịch vụ gửi khóa qua header <code>Authorization: Apikey &lt;khóa&gt;</code> (SePay) hoặc <code>secure-token</code> (Casso); hoặc thêm <code>?key=&lt;khóa&gt;</code> vào cuối URL.</p>
          <button className="btn btn-ghost" onClick={rotateKey}><RefreshCw size={15} /> {cfg.webhook_key ? 'Tạo khóa mới' : 'Tạo khóa'}</button>
        </section>
      </div>

      {/* 4. Đơn thanh toán */}
      <section style={{ marginTop: '1.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: 8 }}><Receipt size={18} /> Đơn thanh toán</h2>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {(['all', 'pending', 'paid', 'cancelled'] as const).map((k) => (
              <button key={k} className={`ph-chip ${filter === k ? 'active' : ''}`} onClick={() => setFilter(k)}>
                {k === 'all' ? `Tất cả (${orders.length})` : STATUS[k].label}
              </button>
            ))}
          </div>
        </div>
        {shown.length === 0 ? <div className="card" style={{ color: '#86868B', textAlign: 'center' }}>Chưa có đơn nào</div> : (
          <div className="list">
            {shown.map((o) => (
              <div key={o.id} className="list-row" style={{ alignItems: 'flex-start' }}>
                <span className="pay-kind" data-kind={o.kind}>{o.kind === 'vip' ? <Crown size={16} /> : <Receipt size={16} />}</span>
                <div className="list-row-main">
                  <div className="list-row-title">{o.title}</div>
                  <div className="list-row-sub">
                    <b className="pay-code">{o.code}</b> · {o.full_name || o.username || 'Tài khoản đã xóa'}{o.email ? ` (${o.email})` : ''} · {fmtTime(o.created_at)}
                    {o.status === 'paid' && ` · trả lúc ${fmtTime(o.paid_at)} ${o.paid_via === 'admin' ? '(admin xác nhận)' : '(tự động)'}`}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                  <b>{vnd(o.amount)}</b>
                  <span className={`badge ${STATUS[o.status].cls}`}>{STATUS[o.status].label}</span>
                  {o.status === 'pending' && (
                    <span style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => confirmOrder(o)} title="Đã thấy tiền về trong sao kê"><Check size={14} /> Xác nhận</button>
                      <button className="btn btn-ghost btn-sm btn-icon" onClick={() => cancelOrder(o)} title="Hủy đơn"><X size={14} /></button>
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
