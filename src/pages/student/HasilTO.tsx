import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

type TOResult = {
  id: string;
  type: string;
  nama_to: string;
  tanggal_to: string;
  scores: Record<string, number>;
  total_score: number;
};

const TYPE_LABELS: Record<string, string> = {
  SNBT: 'SNBT',
  'TKA-Saintek': 'TKA Saintek',
  'TKA-Soshum': 'TKA Soshum',
};

const TYPE_FIELDS: Record<string, Array<{ key: string; label: string }>> = {
  SNBT: [
    { key: 'pu', label: 'PU' },
    { key: 'ppu', label: 'PPU' },
    { key: 'pbm', label: 'PBM' },
    { key: 'pk', label: 'PK' },
    { key: 'lbi', label: 'LBI' },
    { key: 'lbe', label: 'LBE' },
    { key: 'pm', label: 'PM' },
  ],
  'TKA-Saintek': [
    { key: 'mat', label: 'Mat' },
    { key: 'fis', label: 'Fis' },
    { key: 'kim', label: 'Kim' },
    { key: 'bio', label: 'Bio' },
  ],
  'TKA-Soshum': [
    { key: 'geo', label: 'Geo' },
    { key: 'sej', label: 'Sej' },
    { key: 'sos', label: 'Sos' },
    { key: 'eko', label: 'Eko' },
  ],
};

const TYPE_STYLE: Record<string, { bg: string; color: string }> = {
  SNBT: { bg: '#EFF6FF', color: '#1D4ED8' },
  'TKA-Saintek': { bg: '#F0FDF4', color: '#15803D' },
  'TKA-Soshum': { bg: '#FFF7ED', color: '#C2410C' },
};

export default function StudentHasilTO() {
  const { user } = useAuth();
  const [results, setResults] = useState<TOResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('');

  useEffect(() => {
    if (!user) return;
    supabase
      .from('tryout_results')
      .select('id, type, nama_to, tanggal_to, scores, total_score')
      .eq('student_id', user.id)
      .order('tanggal_to', { ascending: false })
      .then(({ data }) => {
        setResults((data ?? []) as TOResult[]);
        setLoading(false);
      });
  }, [user]);

  const displayed = filterType ? results.filter(r => r.type === filterType) : results;

  return (
    <div>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', margin: '0 0 20px', color: '#0D0D0D' }}>
        Hasil Tryout Saya
      </h1>

      <div style={{ marginBottom: '20px' }}>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} style={selectStyle}>
          <option value="">Semua Jenis</option>
          {Object.entries(TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <p style={muted}>Memuat...</p>
      ) : displayed.length === 0 ? (
        <div style={emptyCard}>
          <p style={{ fontFamily: 'var(--font-body)', color: '#666', margin: 0 }}>
            {filterType ? 'Tidak ada hasil TO untuk jenis ini.' : 'Belum ada hasil TO.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {displayed.map(r => {
            const typeStyle = TYPE_STYLE[r.type] ?? { bg: '#F3F2EE', color: '#666' };
            const fields = TYPE_FIELDS[r.type] ?? [];
            const dateLabel = new Date(r.tanggal_to + 'T00:00:00').toLocaleDateString('id-ID', {
              day: 'numeric', month: 'long', year: 'numeric',
            });

            return (
              <div key={r.id} style={card}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                      <span style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.95rem', color: '#0D0D0D' }}>
                        {r.nama_to}
                      </span>
                      <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 700, background: typeStyle.bg, color: typeStyle.color }}>
                        {TYPE_LABELS[r.type] ?? r.type}
                      </span>
                    </div>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: '#666', margin: '0 0 10px' }}>{dateLabel}</p>

                    <div style={{ borderTop: '1px solid #F3F2EE', paddingTop: '10px' }}>
                      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                        {fields.map(f => (
                          <div key={f.key} style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem' }}>
                            <span style={{ color: '#888', marginRight: '4px' }}>{f.label}</span>
                            <span style={{ color: '#0D0D0D', fontWeight: 600 }}>{r.scores?.[f.key] ?? '-'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', color: '#0F1F6B', lineHeight: 1 }}>
                      {typeof r.total_score === 'number' ? r.total_score.toFixed(2) : '-'}
                    </div>
                    <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.72rem', color: '#888', marginTop: '2px' }}>total</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const muted: React.CSSProperties = { fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#666', margin: 0 };
const emptyCard: React.CSSProperties = {
  background: '#fff', border: '1px solid #E2E1DC', borderRadius: '10px', padding: '40px',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
const card: React.CSSProperties = {
  background: '#fff', border: '1px solid #E2E1DC', borderRadius: '10px', padding: '16px',
};
const selectStyle: React.CSSProperties = {
  padding: '9px 12px', border: '1.5px solid #E2E1DC', borderRadius: '8px',
  fontFamily: 'var(--font-body)', fontSize: '0.85rem', background: '#fff', color: '#0D0D0D',
  outline: 'none', cursor: 'pointer',
};
