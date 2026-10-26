import { useEffect, useRef, useState } from 'react';
import api from '../lib/api';
import Modal from './Modal';
import { toast } from './Toast';
import { Camera, FileUp, X, FileText, AlertTriangle, CheckCircle } from 'lucide-react';

// Giáo viên thu bài trên lớp rồi NỘP HỘ học sinh: chụp ảnh (điện thoại mở thẳng camera) hoặc chọn file,
// nộp xong chuyển ngay sang em tiếp theo — không phải đăng nhập tài khoản học sinh.

type Picked = { file: File; url: string | null };
type RosterRow = { student_id: number; full_name: string; username: string; submission_id?: number | null; submitted_at?: string | null };

const MAX_SIDE = 2000;

// Ảnh chụp điện thoại thường 4–10MB → thu nhỏ (cạnh dài ≤ 2000px, JPEG) cho tải lên nhanh mà AI vẫn đọc rõ chữ
async function shrinkImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
    if (scale === 1 && file.size < 1.5 * 1024 * 1024) return file;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.85));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return file; // trình duyệt không đọc được ảnh (vd HEIC) → gửi nguyên file
  }
}

interface Props {
  open: boolean;
  homeworkId: number | string;
  roster: RosterRow[];
  startStudentId: number | null;
  onClose: () => void;
  onSubmitted: () => void;
}

export default function ProxySubmitModal({ open, homeworkId, roster, startStudentId, onClose, onSubmitted }: Props) {
  const [studentId, setStudentId] = useState<number | null>(null);
  const [picked, setPicked] = useState<Picked[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const firstMissing = () => roster.find((s) => !s.submission_id)?.student_id ?? roster[0]?.student_id ?? null;

  useEffect(() => {
    if (open) setStudentId(startStudentId ?? firstMissing());
    else clearPicked();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, startStudentId]);

  const clearPicked = () => setPicked((prev) => { prev.forEach((p) => p.url && URL.revokeObjectURL(p.url)); return []; });

  const addFiles = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    const files = await Promise.all([...list].map(shrinkImage));
    setPicked((prev) => [...prev, ...files.map((f) => ({ file: f, url: f.type.startsWith('image/') ? URL.createObjectURL(f) : null }))]);
  };

  const removeAt = (i: number) => setPicked((prev) => { const p = prev[i]; if (p?.url) URL.revokeObjectURL(p.url); return prev.filter((_, k) => k !== i); });

  const student = roster.find((s) => s.student_id === studentId);
  const done = roster.filter((s) => s.submission_id).length;
  // Em tiếp theo CHƯA nộp, tính từ sau em đang chọn (hết thì vòng lại đầu danh sách)
  const nextMissing = () => {
    const i = roster.findIndex((s) => s.student_id === studentId);
    const order = [...roster.slice(i + 1), ...roster.slice(0, Math.max(0, i))];
    return order.find((s) => !s.submission_id)?.student_id ?? null;
  };

  const submit = async (goNext: boolean) => {
    if (!studentId) return;
    if (picked.length === 0) { toast.error('Chụp hoặc chọn ít nhất 1 ảnh bài làm'); return; }
    setBusy(true); setProgress(0);
    try {
      const fd = new FormData();
      picked.forEach((p) => fd.append('files', p.file));
      const { data } = await api.post(`/homework/${homeworkId}/students/${studentId}/submit`, fd, {
        onUploadProgress: (e) => e.total && setProgress(Math.round((e.loaded / e.total) * 100)),
      });
      toast.success(data.submission?.grading_status ? `Đã nộp hộ ${student?.full_name} — đang tự động chấm` : `Đã nộp hộ ${student?.full_name}`);
      const next = goNext ? nextMissing() : null;
      clearPicked();
      onSubmitted();
      if (goNext && next) setStudentId(next);
      else onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Nộp hộ thất bại');
    } finally {
      setBusy(false);
    }
  };

  const remainingAfter = roster.filter((s) => !s.submission_id && s.student_id !== studentId).length;

  return (
    <Modal open={open} onClose={() => !busy && onClose()} title="Nộp bài hộ học sinh" size="lg"
      footer={<>
        <button className="btn btn-ghost" onClick={onClose} disabled={busy}>Đóng</button>
        <button className="btn btn-secondary proxy-wide-only" onClick={() => submit(false)} disabled={busy || picked.length === 0}>Nộp</button>
        <button className="btn btn-primary" onClick={() => submit(true)} disabled={busy || picked.length === 0}>
          {busy ? `Đang tải lên ${progress}%…` : remainingAfter > 0 ? 'Nộp & sang em tiếp theo' : 'Nộp'}
        </button>
      </>}>
      <div className="form-group">
        <label className="label" htmlFor="proxy-student">Học sinh <span style={{ color: '#86868B', fontWeight: 500 }}>· lớp đã nộp {done}/{roster.length}</span></label>
        <select id="proxy-student" className="input" value={studentId ?? ''} onChange={(e) => { clearPicked(); setStudentId(Number(e.target.value)); }} disabled={busy}>
          {roster.map((s) => (
            <option key={s.student_id} value={s.student_id}>{s.full_name} ({s.username}){s.submission_id ? ' — đã nộp' : ''}</option>
          ))}
        </select>
      </div>

      {student?.submission_id && (
        <div className="proxy-warn">
          <AlertTriangle size={16} />
          <span>Em này đã có bài nộp{student.submitted_at ? ` lúc ${new Date(student.submitted_at).toLocaleString('vi-VN')}` : ''}. Nộp hộ sẽ thay bằng bài mới và chấm lại (lần có điểm cao nhất vẫn được giữ).</span>
        </div>
      )}

      <div className="proxy-pick">
        <button type="button" className="proxy-pick-btn" onClick={() => cameraRef.current?.click()} disabled={busy}>
          <Camera size={22} /><span>Chụp ảnh</span><small>Điện thoại mở camera — chụp lần lượt từng trang</small>
        </button>
        <button type="button" className="proxy-pick-btn" onClick={() => fileRef.current?.click()} disabled={busy}>
          <FileUp size={22} /><span>Chọn file</span><small>Ảnh hoặc PDF đã quét, chọn được nhiều file</small>
        </button>
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden
          onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
        <input ref={fileRef} type="file" accept="image/*,application/pdf" multiple hidden
          onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
      </div>

      {picked.length > 0 ? (
        <>
          <div className="proxy-count"><CheckCircle size={14} /> {picked.length} trang bài làm của <strong>{student?.full_name}</strong></div>
          <div className="proxy-thumbs">
            {picked.map((p, i) => (
              <div key={i} className="proxy-thumb">
                {p.url ? <img src={p.url} alt={`Trang ${i + 1}`} /> : <div className="proxy-pdf"><FileText size={26} /><span>{p.file.name}</span></div>}
                <span className="proxy-page">Trang {i + 1}</span>
                <button type="button" className="proxy-del" onClick={() => removeAt(i)} disabled={busy} title="Bỏ trang này" aria-label={`Bỏ trang ${i + 1}`}><X size={14} /></button>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="proxy-hint">Chụp hoặc chọn ảnh bài làm của em. Bài nộp hộ được AI chấm như khi học sinh tự nộp, không phải đăng nhập tài khoản học sinh, và vẫn nộp được khi đã quá hạn.</p>
      )}
    </Modal>
  );
}
