// Đối chiếu đáp án học sinh đã điền với đáp án đúng (key) — dùng cho giáo viên xem bài nộp.
import { parsePartsConfig, keyIsSet } from '../lib/homeworkParts';

interface Props {
  partsConfig: any;       // parts_config đầy đủ (có answers/key)
  structuredAnswers: any; // structured_answers học sinh đã nộp
}

const TF = ['a', 'b', 'c', 'd'];
const conv = (v: any) => (v ? (String(v).toUpperCase().startsWith('T') ? 'Đúng' : 'Sai') : '—');

export default function StructuredAnswerReview({ partsConfig, structuredAnswers }: Props) {
  const cfg = parsePartsConfig(partsConfig);
  let ans: any = structuredAnswers;
  if (typeof ans === 'string') { try { ans = JSON.parse(ans); } catch { ans = null; } }
  if (!cfg || !ans) return null;

  const enabled = (k: string) => (cfg as any)[k] && (cfg as any)[k].enabled;
  const cell = (ok: boolean): React.CSSProperties => ({
    padding: '2px 8px', borderRadius: 6, fontWeight: 700, fontSize: '0.78rem',
    background: ok ? '#E5F1EA' : '#F8E6DF', color: ok ? '#3A7D5C' : '#B04A2A',
  });

  return (
    <div style={{ marginTop: 12 }}>
      <strong style={{ fontSize: '0.83rem', color: '#1D2A30' }}>Bài làm có cấu trúc của học sinh:</strong>

      {enabled('multiple_choice') && Array.isArray(ans.multiple_choice) && (
        <div style={{ marginTop: 8 }}>
          <div style={subTitle}>Trắc nghiệm</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {(cfg.multiple_choice.answers || []).map((key: string, i: number) => {
              const got = ans.multiple_choice[i] || '—';
              if (!keyIsSet('multiple_choice', key)) return <span key={i} style={neutral}>Câu {i + 1}: {got} (AI chấm)</span>;
              const ok = String(got).toUpperCase() === String(key).toUpperCase();
              return <span key={i} style={cell(ok)}>Câu {i + 1}: {got}{ok ? '' : ` (đáp án ${key})`}</span>;
            })}
          </div>
        </div>
      )}

      {enabled('true_false') && Array.isArray(ans.true_false) && (
        <div style={{ marginTop: 8 }}>
          <div style={subTitle}>Đúng / Sai</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {(cfg.true_false.answers || []).map((keyRow: string[], i: number) => {
              const unset = !keyIsSet('true_false', keyRow);
              return (
                <div key={i} style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, minWidth: 50 }}>Câu {i + 1}</span>
                  {TF.map((sub, j) => {
                    const got = (ans.true_false[i] || [])[j];
                    if (unset) return <span key={sub} style={neutral}>{sub}) {conv(got)}</span>;
                    const ok = got && String(got).toUpperCase()[0] === String(keyRow[j]).toUpperCase()[0];
                    return <span key={sub} style={cell(!!ok)}>{sub}) {conv(got)}{ok ? '' : ` (${conv(keyRow[j])})`}</span>;
                  })}
                  {unset && <span style={{ fontSize: '0.72rem', color: '#7A8287' }}>(AI chấm)</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {enabled('short_answer') && Array.isArray(ans.short_answer) && (
        <div style={{ marginTop: 8 }}>
          <div style={subTitle}>Trả lời ngắn</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {(cfg.short_answer.answers || []).map((key: string, i: number) => {
              const got = ans.short_answer[i] || '—';
              return (
                <div key={i} style={{ fontSize: '0.8rem' }}>
                  <strong>Câu {i + 1}:</strong> HS trả lời "<span style={{ color: '#2F6F82' }}>{got}</span>"
                  {keyIsSet('short_answer', key)
                    ? <> — đáp án: "<span style={{ color: '#3A7D5C' }}>{key}</span>"</>
                    : <span style={{ color: '#7A8287' }}> — (AI chấm theo file đáp án)</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

const subTitle: React.CSSProperties = { fontSize: '0.78rem', fontWeight: 700, color: '#6E5A94', margin: '2px 0 4px' };
const neutral: React.CSSProperties = { padding: '2px 8px', borderRadius: 6, fontWeight: 700, fontSize: '0.78rem', background: '#ECE8F3', color: '#5B4C8A' };
