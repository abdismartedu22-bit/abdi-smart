import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { muted, btnPrimary, btnGhost, fmtDateTime } from './shared';
import type { ToPackage, ToExam, ToAttempt } from '../../types';

export default function ToExamListTaker() {
  const { packageId } = useParams<{ packageId: string }>();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const base = profile?.role === 'teacher' ? '/teacher/to' : '/student/to';

  const [pkg, setPkg] = useState<ToPackage | null>(null);
  const [exams, setExams] = useState<ToExam[]>([]);
  const [attempts, setAttempts] = useState<Record<string, ToAttempt>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, [packageId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    if (!packageId) return;
    setLoading(true);
    const [{ data: p }, { data: e }] = await Promise.all([
      supabase.from('to_packages').select('*').eq('id', packageId).single(),
      supabase.from('to_exams').select('*').eq('package_id', packageId).order('urutan'),
    ]);
    setPkg(p ?? null);
    const examList = (e ?? []) as ToExam[];
    setExams(examList);

    if (examList.length > 0) {
      const { data: att } = await supabase.from('to_attempts').select('*')
        .in('exam_id', examList.map(x => x.id))
        .is('voided_at', null);
      const map: Record<string, ToAttempt> = {};
      (att ?? []).forEach((a: ToAttempt) => { map[a.exam_id] = a; });
      setAttempts(map);
    }
    setLoading(false);
  }

  if (loading) return <p style={muted}>Memuat...</p>;
  if (!pkg) return <p style={muted}>Paket tidak ditemukan.</p>;

  const now = Date.now();

  return (
    <div>
      <Link to={base} style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: '#0D5C3A', textDecoration: 'none' }}>&larr; Kembali ke Try Out</Link>

      <div style={{ margin: '10px 0 24px' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', margin: 0, color: '#0D0D0D' }}>{pkg.nama}</h1>
        <p style={{ ...muted, marginTop: '4px' }}>{fmtDateTime(pkg.tanggal_mulai)} &mdash; {fmtDateTime(pkg.tanggal_selesai)}</p>
      </div>

      {exams.length === 0 ? (
        <p style={muted}>Belum ada ujian dalam paket ini.</p>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #E2E1DC', borderRadius: '10px', overflow: 'hidden' }}>
          {exams.map((exam, i) => {
            const attempt = attempts[exam.id];
            const windowClosed = now >= new Date(exam.tanggal_selesai).getTime();
            const windowOpen = now >= new Date(exam.tanggal_mulai).getTime() && !windowClosed;

            let action: { label: string; onClick?: () => void; disabled?: boolean } = { label: 'Belum Waktu', disabled: true };
            if (attempt?.status === 'submitted') {
              action = windowClosed
                ? { label: 'Lihat Hasil', onClick: () => navigate(`${base}/review/${attempt.id}`) }
                : { label: 'Sudah Selesai', disabled: true };
            } else if (attempt?.status === 'in_progress') {
              action = { label: 'Lanjutkan', onClick: () => navigate(`${base}/ujian/${attempt.id}`) };
            } else if (windowOpen) {
              action = { label: 'Ikut Ujian', onClick: () => navigate(`${base}/token/${exam.id}`) };
            } else if (windowClosed) {
              action = { label: 'Waktu Habis', disabled: true };
            }

            return (
              <div key={exam.id} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px', borderBottom: i < exams.length - 1 ? '1px solid #E2E1DC' : 'none', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <div style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.92rem', color: '#0D0D0D' }}>{exam.nama_ujian}</div>
                  <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: '#888', marginTop: '2px' }}>
                    {exam.mata_pelajaran} &middot; {exam.jumlah_soal_target} soal &middot; {exam.durasi_menit} menit
                  </div>
                </div>
                <button
                  onClick={action.onClick}
                  disabled={action.disabled || !action.onClick}
                  style={{ ...(action.onClick ? btnPrimary : btnGhost), flex: 'none', opacity: action.disabled ? 0.5 : 1 }}
                >
                  {action.label}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
