import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { supabase } from '../../lib/supabase';
import { muted, btnGhost, fmtDateTime } from './shared';
import type { ToExam, Profile } from '../../types';

type StudentRow = {
  student_id: string;
  display_name: string;
  tingkat_kelas: string | null;
  jurusan: string | null;
  jumlah_benar: number;
  jumlah_salah: number;
  jumlah_kosong: number;
};

export default function ToStatistik() {
  const { examId } = useParams<{ examId: string }>();
  const navigate = useNavigate();
  const [exam, setExam] = useState<ToExam | null>(null);
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!examId) return;
    (async () => {
      setLoading(true);
      const { data: e } = await supabase.from('to_exams').select('*').eq('id', examId).single();
      setExam(e as ToExam);

      const { data: attempts } = await supabase.from('to_attempts')
        .select('student_id, jumlah_benar, jumlah_salah, jumlah_kosong')
        .eq('exam_id', examId).eq('status', 'submitted');

      const studentIds = Array.from(new Set((attempts ?? []).map((a: { student_id: string }) => a.student_id)));
      let profiles: Profile[] = [];
      if (studentIds.length > 0) {
        const { data } = await supabase.from('profiles').select('*').in('id', studentIds);
        profiles = (data ?? []) as Profile[];
      }
      const pMap: Record<string, Profile> = {};
      profiles.forEach(p => { pMap[p.id] = p; });

      setRows((attempts ?? []).map((a: { student_id: string; jumlah_benar: number | null; jumlah_salah: number | null; jumlah_kosong: number | null }) => ({
        student_id: a.student_id,
        display_name: pMap[a.student_id]?.display_name ?? '-',
        tingkat_kelas: pMap[a.student_id]?.tingkat_kelas ?? null,
        jurusan: pMap[a.student_id]?.jurusan ?? null,
        jumlah_benar: a.jumlah_benar ?? 0,
        jumlah_salah: a.jumlah_salah ?? 0,
        jumlah_kosong: a.jumlah_kosong ?? 0,
      })).sort((a, b) => b.jumlah_benar - a.jumlah_benar));
      setLoading(false);
    })();
  }, [examId]);

  function exportExcel() {
    if (!exam) return;
    const header = ['Nama', 'Kelas', 'Jurusan', 'Jumlah Benar', 'Jumlah Salah', 'Jumlah Kosong'];
    const data = rows.map(r => [r.display_name, r.tingkat_kelas ?? '', r.jurusan ?? '', r.jumlah_benar, r.jumlah_salah, r.jumlah_kosong]);
    const ws = XLSX.utils.aoa_to_sheet([header, ...data]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Hasil TO');
    XLSX.writeFile(wb, `HasilTO_${exam.nama_ujian.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`);
  }

  function copyTable() {
    const header = ['Nama', 'Kelas', 'Jurusan', 'Benar', 'Salah', 'Kosong'].join('\t');
    const body = rows.map(r => [r.display_name, r.tingkat_kelas ?? '', r.jurusan ?? '', r.jumlah_benar, r.jumlah_salah, r.jumlah_kosong].join('\t')).join('\n');
    navigator.clipboard.writeText(`${header}\n${body}`);
  }

  if (loading) return <p style={muted}>Memuat...</p>;
  if (!exam) return <p style={muted}>Ujian tidak ditemukan.</p>;

  const avgBenar = rows.length > 0 ? (rows.reduce((s, r) => s + r.jumlah_benar, 0) / rows.length).toFixed(1) : '0';

  return (
    <div>
      <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: '#0D5C3A', padding: 0, marginBottom: '14px' }}>&larr; Kembali</button>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', margin: 0, color: '#0D0D0D' }}>{exam.nama_ujian}</h1>
          <p style={{ ...muted, marginTop: '4px' }}>{exam.mata_pelajaran} &middot; {fmtDateTime(exam.tanggal_mulai)} &mdash; {fmtDateTime(exam.tanggal_selesai)}</p>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button onClick={copyTable} style={btnGhost}>Copy</button>
          <button onClick={() => window.print()} style={btnGhost}>Print</button>
          <button onClick={exportExcel} style={btnGhost}>Excel</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
        <Stat label="Peserta" value={rows.length} />
        <Stat label="Rata-rata Jumlah Benar" value={avgBenar} />
      </div>

      {rows.length === 0 ? (
        <p style={muted}>Belum ada siswa yang menyelesaikan ujian ini.</p>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #E2E1DC', borderRadius: '10px', overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr', gap: '0', background: '#F9F9F7', borderBottom: '1px solid #E2E1DC', padding: '10px 16px' }}>
            {['Nama', 'Kelas', 'Jurusan', 'Benar', 'Salah', 'Kosong'].map((h, i) => (
              <span key={i} style={{ fontFamily: 'var(--font-body)', fontSize: '0.7rem', fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</span>
            ))}
          </div>
          {rows.map((r, i) => (
            <div key={r.student_id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr', gap: '0', padding: '10px 16px', borderBottom: i < rows.length - 1 ? '1px solid #F3F2EE' : 'none', alignItems: 'center', fontFamily: 'var(--font-body)', fontSize: '0.85rem' }}>
              <span style={{ fontWeight: 600, color: '#0D0D0D' }}>{r.display_name}</span>
              <span style={{ color: '#666' }}>{r.tingkat_kelas ?? '-'}</span>
              <span style={{ color: '#666' }}>{r.jurusan ?? '-'}</span>
              <span style={{ color: '#15803D', fontWeight: 700 }}>{r.jumlah_benar}</span>
              <span style={{ color: '#DC0A1E', fontWeight: 700 }}>{r.jumlah_salah}</span>
              <span style={{ color: '#92400E', fontWeight: 700 }}>{r.jumlah_kosong}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E2E1DC', borderRadius: '10px', padding: '14px 20px' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', fontWeight: 800, color: '#0D5C3A' }}>{value}</div>
      <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: '#888' }}>{label}</div>
    </div>
  );
}
