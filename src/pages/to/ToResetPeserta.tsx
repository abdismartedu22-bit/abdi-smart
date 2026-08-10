import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { input, btnGhost, muted, fmtDateTime } from './shared';
import type { ToExam, ToAttempt, Profile } from '../../types';

type Row = ToAttempt & { student: Pick<Profile, 'display_name'> | null };

export default function ToResetPeserta() {
  const [exams, setExams] = useState<ToExam[]>([]);
  const [examId, setExamId] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [resettingId, setResettingId] = useState<string | null>(null);

  useEffect(() => {
    supabase.from('to_exams').select('*').order('created_at', { ascending: false })
      .then(({ data }) => setExams((data ?? []) as ToExam[]));
  }, []);

  useEffect(() => {
    if (!examId) { setRows([]); return; }
    load();
  }, [examId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('to_attempts')
      .select('*, student:profiles!student_id(display_name)')
      .eq('exam_id', examId)
      .is('voided_at', null)
      .order('started_at', { ascending: false });
    setRows((data ?? []) as unknown as Row[]);
    setLoading(false);
  }

  async function reset(attemptId: string) {
    setResettingId(attemptId);
    await supabase.rpc('reset_to_attempt', { p_attempt_id: attemptId, p_reason: 'Direset oleh staff/admin' });
    setResettingId(null);
    load();
  }

  return (
    <div>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', margin: '0 0 20px', color: '#0D0D0D' }}>Try Out &mdash; Reset Peserta</h1>

      <div style={{ marginBottom: '20px', maxWidth: '400px' }}>
        <select style={{ ...input, cursor: 'pointer' }} value={examId} onChange={e => setExamId(e.target.value)}>
          <option value="">- Pilih Ujian -</option>
          {exams.map(e => <option key={e.id} value={e.id}>{e.nama_ujian} ({e.mata_pelajaran})</option>)}
        </select>
      </div>

      {!examId ? (
        <p style={muted}>Pilih ujian untuk melihat daftar peserta.</p>
      ) : loading ? (
        <p style={muted}>Memuat...</p>
      ) : rows.length === 0 ? (
        <p style={muted}>Belum ada peserta untuk ujian ini.</p>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #E2E1DC', borderRadius: '10px', overflow: 'hidden' }}>
          {rows.map((r, i) => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '12px 16px', borderBottom: i < rows.length - 1 ? '1px solid #F3F2EE' : 'none', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '160px' }}>
                <div style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.85rem', color: '#0D0D0D' }}>{r.student?.display_name ?? '-'}</div>
                <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.72rem', color: '#888' }}>
                  Mulai {fmtDateTime(r.started_at)}{r.submitted_at ? ` · Selesai ${fmtDateTime(r.submitted_at)}` : ''}
                </div>
              </div>
              <span style={{
                fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.7rem', padding: '3px 10px', borderRadius: '20px',
                background: r.status === 'submitted' ? '#D1FAE5' : '#FEF9C3',
                color: r.status === 'submitted' ? '#065F46' : '#92400E',
              }}>
                {r.status === 'submitted' ? 'Selesai' : 'Sedang Mengerjakan'}
              </span>
              <button onClick={() => reset(r.id)} disabled={resettingId === r.id} style={{ ...btnGhost, color: '#DC0A1E' }}>
                {resettingId === r.id ? 'Mereset...' : 'Reset'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
