import { useState, useEffect, FormEvent } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { input, btnPrimary, muted, errorText, fmtDateTime } from './shared';
import type { ToExam, Profile } from '../../types';

export default function ToTokenGate() {
  const { examId } = useParams<{ examId: string }>();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const base = profile?.role === 'teacher' ? '/teacher/to' : '/student/to';

  const [exam, setExam] = useState<ToExam | null>(null);
  const [teacher, setTeacher] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!examId) return;
    supabase.from('to_exams').select('*').eq('id', examId).single().then(async ({ data }) => {
      setExam(data as ToExam);
      if (data?.teacher_id) {
        const { data: t } = await supabase.from('profiles').select('*').eq('id', data.teacher_id).single();
        setTeacher(t as Profile);
      }
      setLoading(false);
    });
  }, [examId]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!token.trim() || !examId) return;
    setSubmitting(true);
    const { data, error: err } = await supabase.rpc('start_to_attempt', { p_exam_id: examId, p_token: token.trim() });
    setSubmitting(false);
    if (err) { setError(err.message.replace(/^.*: /, '')); return; }
    navigate(`${base}/ujian/${data.id}`);
  }

  if (loading) return <p style={muted}>Memuat...</p>;
  if (!exam) return <p style={muted}>Ujian tidak ditemukan.</p>;

  const start = new Date(exam.tanggal_mulai).getTime();
  const end = new Date(exam.tanggal_selesai).getTime();
  const belumWaktu = now < start;
  const waktuHabis = now >= end;
  const terlambat = new Date(end - exam.durasi_menit * 60_000);

  function countdown(target: number): string {
    const diff = Math.max(0, target - now);
    const d = Math.floor(diff / 86_400_000);
    const h = Math.floor((diff % 86_400_000) / 3_600_000);
    const m = Math.floor((diff % 3_600_000) / 60_000);
    const s = Math.floor((diff % 60_000) / 1000);
    return `${d} Hari, ${String(h).padStart(2, '0')} Jam, ${String(m).padStart(2, '0')} Menit, ${String(s).padStart(2, '0')} Detik`;
  }

  return (
    <div style={{ maxWidth: '560px', margin: '0 auto' }}>
      <Link to={base} style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: '#0D5C3A', textDecoration: 'none' }}>&larr; Kembali</Link>

      <div style={{ background: '#fff', border: '1px solid #E2E1DC', borderRadius: '12px', padding: '24px', marginTop: '14px' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', margin: '0 0 4px', color: '#0D0D0D' }}>{exam.nama_ujian}</h1>
        <p style={{ ...muted, marginBottom: '20px' }}>{exam.mata_pelajaran}</p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px', marginBottom: '20px', fontFamily: 'var(--font-body)', fontSize: '0.85rem' }}>
          <InfoRow label="Nama" value={profile?.display_name ?? '-'} />
          <InfoRow label="Guru" value={teacher?.display_name ?? '-'} />
          <InfoRow label="Kelas/Jurusan" value={`${profile?.tingkat_kelas ?? '-'} / ${profile?.jurusan ?? '-'}`} />
          <InfoRow label="Jumlah Soal" value={String(exam.jumlah_soal_target)} />
          <InfoRow label="Waktu" value={`${exam.durasi_menit} Menit`} />
          <InfoRow label="Terlambat" value={fmtDateTime(terlambat.toISOString())} />
        </div>

        {belumWaktu ? (
          <div style={{ background: '#FEF9C3', border: '1px solid #FDE68A', borderRadius: '8px', padding: '14px', fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#92400E' }}>
            <strong>Belum Waktu TO</strong>
            <p style={{ margin: '6px 0 0' }}>Ujian dimulai dalam {countdown(start)}.</p>
          </div>
        ) : waktuHabis ? (
          <div style={{ background: '#FEE2E2', border: '1px solid #FCA5A5', borderRadius: '8px', padding: '14px', fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#991B1B' }}>
            Waktu untuk mengikuti ujian ini sudah berakhir.
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', fontWeight: 600, color: '#2E2E2E' }}>Masukkan Token</label>
            <input
              style={{ ...input, textAlign: 'center', fontFamily: 'var(--font-display)', fontSize: '1.2rem', letterSpacing: '0.15em', textTransform: 'uppercase' }}
              value={token}
              onChange={e => setToken(e.target.value.toUpperCase())}
              autoComplete="off"
              maxLength={5}
              required
            />
            {error && <p style={errorText}>{error}</p>}
            <button type="submit" disabled={submitting} style={btnPrimary}>{submitting ? 'Memeriksa...' : 'Mulai'}</button>
          </form>
        )}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ color: '#888', fontSize: '0.72rem' }}>{label}</div>
      <div style={{ color: '#0D0D0D', fontWeight: 600 }}>{value}</div>
    </div>
  );
}
