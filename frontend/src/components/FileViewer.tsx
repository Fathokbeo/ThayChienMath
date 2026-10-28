import { useState } from 'react';
import { ChevronLeft, ChevronRight, Download, FileText, ZoomIn, ZoomOut } from 'lucide-react';
import PdfCanvasViewer from './PdfCanvasViewer';
import { IS_NATIVE } from '../lib/native';

const isPdf = (url: string) => url.split('?')[0].toLowerCase().endsWith('.pdf');

// Xem 1 hoặc nhiều tài liệu (ảnh / PDF). Có điều hướng + dải thumbnail khi nhiều file.
export default function FileViewer({ files, onClose }: { files: string[]; onClose: () => void }) {
  const [idx, setIdx] = useState(0);
  const [zoom, setZoom] = useState(1);
  if (!files || files.length === 0) return null;

  const i = Math.min(idx, files.length - 1);
  const url = files[i];
  const multi = files.length > 1;
  const go = (delta: number) => setIdx((p) => (p + delta + files.length) % files.length);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div style={{ background: 'white', borderRadius: 12, width: '90vw', height: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
        onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #E8E8ED', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 600 }}>Xem tài liệu {multi && <span style={{ color: '#6E6E73', fontWeight: 400 }}>({i + 1}/{files.length})</span>}</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <a className="btn btn-ghost btn-sm" href={url} target="_blank" rel="noreferrer"><Download size={13} /> Tải về</a>
            <button className="btn btn-ghost btn-sm" onClick={onClose}>Đóng</button>
          </div>
        </div>

        <div style={{ flex: 1, position: 'relative', overflow: 'auto', background: '#26343A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {isPdf(url)
            // App Android: WebView không tự hiển thị PDF trong iframe → vẽ bằng pdf.js (kèm nút phóng to/nhỏ)
            ? IS_NATIVE
              ? (
                <>
                  <PdfCanvasViewer url={url} zoom={zoom} />
                  <div style={{ position: 'absolute', bottom: 14, right: 14, display: 'flex', gap: 4, background: 'rgba(32,32,40,0.72)', borderRadius: 99, padding: 3 }}>
                    <button type="button" className="zoom-pill-btn" onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))} disabled={zoom <= 0.5} aria-label="Thu nhỏ"><ZoomOut size={17} /></button>
                    <button type="button" className="zoom-pill-btn" onClick={() => setZoom((z) => Math.min(3, z + 0.25))} disabled={zoom >= 3} aria-label="Phóng to"><ZoomIn size={17} /></button>
                  </div>
                </>
              )
              : <iframe src={url} style={{ width: '100%', height: '100%', border: 'none', background: 'white' }} title="PDF" />
            : <img src={url} alt={`Trang ${i + 1}`} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />}

          {multi && (
            <>
              <button onClick={() => go(-1)} aria-label="Trước" style={navBtnStyle('left')}><ChevronLeft size={22} /></button>
              <button onClick={() => go(1)} aria-label="Sau" style={navBtnStyle('right')}><ChevronRight size={22} /></button>
            </>
          )}
        </div>

        {multi && (
          <div style={{ display: 'flex', gap: 6, padding: 8, overflowX: 'auto', borderTop: '1px solid #E8E8ED', background: '#FAFAFC' }}>
            {files.map((f, k) => (
              <button key={k} onClick={() => setIdx(k)} title={`Trang ${k + 1}`}
                style={{
                  width: 56, height: 56, flexShrink: 0, borderRadius: 8, overflow: 'hidden', cursor: 'pointer', padding: 0,
                  border: k === i ? '2px solid #1F5C68' : '2px solid transparent', background: '#E8E8ED',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                {isPdf(f)
                  ? <FileText size={20} color="#1F5C68" />
                  : <img src={f} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function navBtnStyle(side: 'left' | 'right'): React.CSSProperties {
  return {
    position: 'absolute', top: '50%', transform: 'translateY(-50%)', [side]: 12,
    width: 40, height: 40, borderRadius: '50%', border: 'none', cursor: 'pointer',
    background: 'rgba(0,0,0,0.45)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
  } as React.CSSProperties;
}
