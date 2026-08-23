import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { toDirectImg } from '../../lib/googleDriveImg';
import { ToRichContent, Watermark, muted, errorText, TIPE_LABELS } from './shared';
import type { ToAttempt, ToQuestionTipe, ToGridConfig, ToJawaban } from '../../types';

type ReviewQuestion = {
  id: string;
  urutan: number;
  tipe: ToQuestionTipe;
  konten_html: string;
  gambar_url: string | null;
  opsi: string[] | null;
  grid_config: ToGridConfig | null;
  jawaban_benar: ToJawaban;
  pembahasan_html: string | null;
  pembahasan_gambar_url: string | null;
  jawaban_siswa: ToJawaban | null;
  ragu: boolean;
  benar: boolean | null;
};

export default function ToReview() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const { profile } = useAuth();
  const base = profile?.role === 'teacher' ? '/teacher/to' : '/student/to';

  const [attempt, setAttempt] = useState<ToAttempt | null>(null);
  const [questions, setQuestions] = useState<ReviewQuestion[]>([]);
  const [qStats, setQStats] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!attemptId) return;
    (async () => {
      setLoading(true);
      const { data: att } = await supabase.from('to_attempts').select('*').eq('id', attemptId).single();
      const attemptRow = att as ToAttempt | null;
      setAttempt(attemptRow);

      const { data, error: err } = await supabase.rpc('get_to_review', { p_attempt_id: attemptId });
      if (err) { setError(err.message.replace(/^.*: /, '')); setLoading(false); return; }
      setQuestions((data ?? []) as ReviewQuestion[]);

      if (attemptRow?.exam_id) {
        const { data: stats } = await supabase.rpc('get_to_question_stats', { p_exam_id: attemptRow.exam_id });
        const map: Record<string, number> = {};
        ((stats ?? []) as { question_id: string; pct_correct: number }[]).forEach(s => { map[s.question_id] = s.pct_correct; });
        setQStats(map);
      }

      setLoading(false);
    })();
  }, [attemptId]);

  function difficultyBand(pct: number): { label: string; color: string } {
    if (pct <= 20) return { label: 'Sangat Sulit', color: '#DC0A1E' };
    if (pct <= 40) return { label: 'Sulit', color: '#EA580C' };
    if (pct <= 60) return { label: 'Normal', color: '#A16207' };
    if (pct <= 80) return { label: 'Mudah', color: '#15803D' };
    return { label: 'Sangat Mudah', color: '#0D5C3A' };
  }

  if (loading) return <p style={muted}>Memuat...</p>;
  if (error) return (
    <div>
      <Link to={base} style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: '#0D5C3A', textDecoration: 'none' }}>&larr; Kembali</Link>
      <p style={{ ...errorText, marginTop: '16px' }}>{error}</p>
    </div>
  );
  if (!attempt) return <p style={muted}>Attempt tidak ditemukan.</p>;

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto' }}>
      <Link to={base} style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: '#0D5C3A', textDecoration: 'none' }}>&larr; Kembali</Link>

      <div style={{ background: '#0D5C3A', border: '1.5px solid #1B7A50', borderRadius: '6px', padding: '24px', margin: '14px 0 20px', display: 'flex', justifyContent: 'center', textAlign: 'center' }}>
        <div style={{ padding: '0 28px' }}><ScoreStat label="Benar" value={attempt.jumlah_benar ?? 0} color="#86EFAC" /></div>
        <div style={{ padding: '0 28px', borderLeft: '1.5px solid rgba(255,255,255,0.18)' }}><ScoreStat label="Salah" value={attempt.jumlah_salah ?? 0} color="#FCA5A5" /></div>
        <div style={{ padding: '0 28px', borderLeft: '1.5px solid rgba(255,255,255,0.18)' }}><ScoreStat label="Kosong" value={attempt.jumlah_kosong ?? 0} color="#FDE68A" /></div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {questions.map((q, i) => (
          <div key={q.id} style={{ position: 'relative', background: '#fff', border: `1.5px solid ${q.benar === true ? '#86EFAC' : q.benar === false ? '#FCA5A5' : '#E2E1DC'}`, borderRadius: '10px', padding: '16px', overflow: 'hidden' }}>
            {profile?.display_name && <Watermark text={profile.display_name} />}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: '#aaa' }}>Soal #{i + 1}</span>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', background: '#F3F2EE', color: '#666' }}>{TIPE_LABELS[q.tipe]}</span>
              <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.75rem', color: q.benar === true ? '#15803D' : q.benar === false ? '#DC0A1E' : '#888' }}>
                {q.benar === true ? 'Benar' : q.benar === false ? 'Salah' : 'Kosong'}
              </span>
            </div>

            <ToRichContent html={q.konten_html} style={{ fontSize: '0.88rem', color: '#0D0D0D', marginBottom: '10px' }} />
            {q.gambar_url && (
              <img src={toDirectImg(q.gambar_url)} alt="" style={{ maxWidth: '100%', maxHeight: '260px', objectFit: 'contain', display: 'block', marginBottom: '10px', borderRadius: '8px' }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
            )}

            <AnswerComparison q={q} />

            {(q.pembahasan_html || q.pembahasan_gambar_url || qStats[q.id] !== undefined) && (
              <div style={{ marginTop: '12px', padding: '12px', background: '#F9F9F7', borderRadius: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.75rem', color: '#666' }}>Pembahasan</span>
                  {qStats[q.id] !== undefined && (() => {
                    const band = difficultyBand(qStats[q.id]);
                    return (
                      <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: '20px', background: '#fff', border: `1.5px solid ${band.color}`, color: band.color }}>
                        {band.label} &middot; {qStats[q.id]}% siswa jawab benar
                      </span>
                    );
                  })()}
                </div>
                {q.pembahasan_html && (
                  <ToRichContent html={q.pembahasan_html} style={{ fontSize: '0.85rem', color: '#0D0D0D' }} />
                )}
                {q.pembahasan_gambar_url && (
                  <img
                    src={toDirectImg(q.pembahasan_gambar_url)}
                    alt="Gambar pembahasan"
                    style={{ maxWidth: '100%', maxHeight: '260px', objectFit: 'contain', display: 'block', marginTop: '10px', borderRadius: '8px' }}
                    onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                  />
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ScoreStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 800, color }}>{value}</div>
      <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: '#D6EEE2' }}>{label}</div>
    </div>
  );
}

function AnswerComparison({ q }: { q: ReviewQuestion }) {
  if (q.tipe === 'grid_pernyataan') {
    const labels = q.grid_config?.column_labels ?? ['Kolom 1', 'Kolom 2'];
    const studentMap = (q.jawaban_siswa && typeof q.jawaban_siswa === 'object' && !Array.isArray(q.jawaban_siswa))
      ? q.jawaban_siswa as Record<string, number> : {};
    const correctMap = (q.jawaban_benar && typeof q.jawaban_benar === 'object' && !Array.isArray(q.jawaban_benar))
      ? q.jawaban_benar as Record<string, number> : {};

    return (
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-body)', fontSize: '0.82rem' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '2px solid #E2E1DC', color: '#888', fontSize: '0.7rem' }}>Pernyataan</th>
              <th style={{ padding: '6px 8px', borderBottom: '2px solid #E2E1DC', color: '#888', fontSize: '0.7rem', minWidth: '90px' }}>Jawabanmu</th>
              <th style={{ padding: '6px 8px', borderBottom: '2px solid #E2E1DC', color: '#888', fontSize: '0.7rem', minWidth: '90px' }}>Kunci Jawaban</th>
            </tr>
          </thead>
          <tbody>
            {(q.grid_config?.statements ?? []).map(s => {
              const sVal = studentMap[s.id];
              const cVal = correctMap[s.id];
              const answered = sVal !== undefined;
              const isRight = answered && sVal === cVal;
              return (
                <tr key={s.id}>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #F3F2EE' }}><ToRichContent html={s.text_html} /></td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #F3F2EE', textAlign: 'center', fontWeight: 700, color: !answered ? '#999' : isRight ? '#15803D' : '#DC0A1E' }}>
                    {answered ? labels[sVal] : '(kosong)'}
                  </td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #F3F2EE', textAlign: 'center', fontWeight: 700, color: '#15803D' }}>
                    {labels[cVal]}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  if (q.tipe === 'pilihan_ganda') {
    const correctLabel = typeof q.jawaban_benar === 'string' ? q.jawaban_benar.trim() : '';
    const selectedLabel = typeof q.jawaban_siswa === 'string' ? q.jawaban_siswa.trim() : '';

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontFamily: 'var(--font-body)', fontSize: '0.82rem', marginBottom: '2px' }}>
          <div>
            <div style={{ color: '#888', fontSize: '0.7rem', marginBottom: '2px' }}>Jawabanmu</div>
            <div style={{ color: '#0D0D0D', fontWeight: 600 }}>{selectedLabel || '(kosong)'}</div>
          </div>
          <div>
            <div style={{ color: '#888', fontSize: '0.7rem', marginBottom: '2px' }}>Kunci Jawaban</div>
            <div style={{ color: '#15803D', fontWeight: 600 }}>{correctLabel || '-'}</div>
          </div>
        </div>
        {(q.opsi ?? []).map((text, i) => {
          const label = String.fromCharCode(65 + i);
          const isCorrect = label === correctLabel;
          const isSelected = label === selectedLabel;
          let bg = '#F9F9F7', border = '#E2E1DC', badge = '';
          if (isCorrect && isSelected) { bg = '#F0FDF4'; border = '#86EFAC'; badge = '✓ Dipilih, benar'; }
          else if (isCorrect && !isSelected) { bg = '#FFFBEB'; border = '#FCD34D'; badge = 'Kunci Jawaban'; }
          else if (!isCorrect && isSelected) { bg = '#FEF2F2'; border = '#FCA5A5'; badge = 'Dipilih, salah'; }
          return (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '8px', background: bg, border: `1.5px solid ${border}` }}>
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.85rem', color: '#0D0D0D', flexShrink: 0 }}>{label}</span>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#0D0D0D', flex: 1 }}>{text}</span>
              {badge && <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.68rem', fontWeight: 700, color: isSelected && !isCorrect ? '#DC0A1E' : isCorrect && !isSelected ? '#92400E' : '#15803D', flexShrink: 0 }}>{badge}</span>}
            </div>
          );
        })}
      </div>
    );
  }

  if (q.tipe === 'centang_semua') {
    const correctSet = new Set(Array.isArray(q.jawaban_benar) ? q.jawaban_benar as string[] : []);
    const studentSet = new Set(Array.isArray(q.jawaban_siswa) ? q.jawaban_siswa as string[] : []);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {(q.opsi ?? []).map((text, i) => {
          const label = String.fromCharCode(65 + i);
          const isCorrect = correctSet.has(label);
          const isSelected = studentSet.has(label);
          let bg = '#F9F9F7', border = '#E2E1DC', badge = '';
          if (isCorrect && isSelected) { bg = '#F0FDF4'; border = '#86EFAC'; badge = '✓ Dipilih, benar'; }
          else if (isCorrect && !isSelected) { bg = '#FFFBEB'; border = '#FCD34D'; badge = 'Seharusnya dipilih'; }
          else if (!isCorrect && isSelected) { bg = '#FEF2F2'; border = '#FCA5A5'; badge = 'Dipilih, salah'; }
          return (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '8px', background: bg, border: `1.5px solid ${border}` }}>
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.85rem', color: '#0D0D0D', flexShrink: 0 }}>{label}</span>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#0D0D0D', flex: 1 }}>{text}</span>
              {badge && <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.68rem', fontWeight: 700, color: isSelected && !isCorrect ? '#DC0A1E' : isCorrect && !isSelected ? '#92400E' : '#15803D', flexShrink: 0 }}>{badge}</span>}
            </div>
          );
        })}
      </div>
    );
  }

  const fmt = (v: ToJawaban | null | undefined): string => {
    if (v === null || v === undefined) return '(kosong)';
    return String(v);
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontFamily: 'var(--font-body)', fontSize: '0.82rem' }}>
      <div>
        <div style={{ color: '#888', fontSize: '0.7rem', marginBottom: '2px' }}>Jawabanmu</div>
        <div style={{ color: '#0D0D0D', fontWeight: 600 }}>{fmt(q.jawaban_siswa)}</div>
      </div>
      <div>
        <div style={{ color: '#888', fontSize: '0.7rem', marginBottom: '2px' }}>Kunci Jawaban</div>
        <div style={{ color: '#15803D', fontWeight: 600 }}>{fmt(q.jawaban_benar)}</div>
      </div>
    </div>
  );
}
