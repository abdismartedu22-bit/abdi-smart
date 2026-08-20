import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { muted, btnGhost, fmtDateTime } from './shared';
import type { ToExam, ToPackage } from '../../types';

type Row = ToExam & { package: Pick<ToPackage, 'nama'> | null; attemptCount: number };

export default function ToHasilRekap() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const base = location.pathname.startsWith('/staff') ? '/staff/to' : '/admin/to';

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: exams } = await supabase
        .from('to_exams')
        .select('*, package:to_packages!package_id(nama)')
        .order('created_at', { ascending: false });
      const list = (exams ?? []) as unknown as (ToExam & { package: Pick<ToPackage, 'nama'> | null })[];

      const { data: attempts } = await supabase.from('to_attempts').select('exam_id').eq('status', 'submitted');
      const counts: Record<string, number> = {};
      (attempts ?? []).forEach((a: { exam_id: string }) => { counts[a.exam_id] = (counts[a.exam_id] ?? 0) + 1; });

      setRows(list.map(e => ({ ...e, attemptCount: counts[e.id] ?? 0 })));
      setLoading(false);
    })();
  }, []);

  return (
    <div>
      {loading ? (
        <p style={muted}>Memuat...</p>
      ) : rows.length === 0 ? (
        <p style={muted}>Belum ada ujian.</p>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #E2E1DC', borderRadius: '10px', overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '0', background: '#F9F9F7', borderBottom: '1px solid #E2E1DC', padding: '10px 16px' }}>
            {['Ujian', 'Paket', 'Peserta', ''].map((h, i) => (
              <span key={i} style={{ fontFamily: 'var(--font-body)', fontSize: '0.7rem', fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</span>
            ))}
          </div>
          {rows.map((r, i) => (
            <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '0', padding: '12px 16px', borderBottom: i < rows.length - 1 ? '1px solid #F3F2EE' : 'none', alignItems: 'center' }}>
              <div>
                <div style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.85rem', color: '#0D0D0D' }}>{r.nama_ujian}</div>
                <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.72rem', color: '#888' }}>{r.mata_pelajaran} &middot; {fmtDateTime(r.tanggal_mulai)}</div>
              </div>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: '#666' }}>{r.package?.nama ?? '-'}</span>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: '#666' }}>{r.attemptCount}</span>
              <button onClick={() => navigate(`${base}/hasil/${r.id}`)} style={btnGhost}>Lihat Hasil</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
