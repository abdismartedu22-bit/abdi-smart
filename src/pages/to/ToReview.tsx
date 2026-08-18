import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { toDirectImg } from '../../lib/googleDriveImg';
import { ToRichContent, muted, errorText, TIPE_LABELS } from './shared';
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!attemptId) return;
    (async () => {
      setLoading(true);
      const { data: att } = await supabase.from('to_attempts').select('*').eq('id', attemptId).single();
      setAttempt(att as ToAttempt);

      const { data, error: err } = await supabase.rpc('get_to_review', { p_attempt_id: attemptId });
      if (err) { setError(err.message.replace(/^.*: /, '')); setLoading(false); return; }
      setQuestions((data ?? []) as ReviewQuestion[]);
      setLoading(false);
    })();
  }, [attemptId]);

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

      <div style={{ background: '#0D5C3A', borderRadius: '12px', padding: '24px', margin: '14px 0 20px', display: 'flex', gap: '24px', justifyContent: 'center', textAlign: 'center' }}>
        <ScoreStat label="Benar" value={attempt.jumlah_benar ?? 0} color="#86EFAC" />
        <ScoreStat label="Salah" value={attempt.jumlah_salah ?? 0} color="#FCA5A5" />
        <ScoreStat label="Kosong" value={attempt.jumlah_kosong ?? 0} color="#FDE68A" />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {questions.map((q, i) => (
          <div key={q.id} style={{ background: '#fff', border: `1.5px solid ${q.benar === true ? '#86EFAC' : q.benar === false ? '#FCA5A5' : '#E2E1DC'}`, borderRadius: '10px', padding: '16px' }}>
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

            {(q.pembahasan_html || q.pembahasan_gambar_url) && (
              <div style={{ marginTop: '12px', padding: '12px', background: '#F9F9F7', borderRadius: '8px' }}>
                <div style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.75rem', color: '#666', marginBottom: '6px' }}>Pembahasan</div>
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
  const fmt = (v: ToJawaban | null | undefined): string => {
    if (v === null || v === undefined) return '(kosong)';
    if (Array.isArray(v)) return v.join(', ') || '(kosong)';
    if (typeof v === 'object') {
      const labels = q.grid_config?.column_labels ?? ['Kolom 1', 'Kolom 2'];
      return (q.grid_config?.statements ?? []).map(s => `${labels[(v as Record<string, number>)[s.id]] ?? '-'}`).join(', ');
    }
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
