import { useState, useEffect, useMemo } from 'react';
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

type LeaderboardEntry = {
  student_id: string;
  display_name: string;
  total_score: number;
  rank: number;
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

const RANK_STYLE: Record<number, { bg: string; color: string }> = {
  1: { bg: '#FEF3C7', color: '#92400E' },
  2: { bg: '#F1F5F9', color: '#475569' },
  3: { bg: '#FFF4ED', color: '#9A3412' },
};

function ScoreChart({ results }: { results: TOResult[] }) {
  const sorted = [...results].sort((a, b) => a.tanggal_to.localeCompare(b.tanggal_to));
  if (sorted.length < 2) return null;

  const W = 280, H = 80, PAD = 10;
  const scores = sorted.map(r => r.total_score);
  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);
  const range = maxScore - minScore || 1;

  const pts = sorted.map((r, i) => ({
    x: PAD + (i / (sorted.length - 1)) * (W - PAD * 2),
    y: PAD + ((maxScore - r.total_score) / range) * (H - PAD * 2),
    r,
  }));

  const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const areaD = `${pathD} L ${pts[pts.length - 1].x.toFixed(1)} ${H - PAD} L ${pts[0].x.toFixed(1)} ${H - PAD} Z`;

  return (
    <div>
      <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.7rem', color: '#aaa', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        Tren Skor
      </p>
      <svg width={W} height={H} style={{ overflow: 'visible', maxWidth: '100%', display: 'block' }}>
        <defs>
          <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0F1F6B" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#0F1F6B" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaD} fill="url(#chartGrad)" />
        <path d={pathD} fill="none" stroke="#0F1F6B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={4} fill="#fff" stroke="#0F1F6B" strokeWidth="2" />
            <text x={p.x} y={p.y - 9} textAnchor="middle" fontSize="9" fill="#0F1F6B" fontFamily="var(--font-body)" fontWeight="700">
              {typeof p.r.total_score === 'number' ? p.r.total_score.toFixed(0) : '-'}
            </text>
          </g>
        ))}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: PAD, paddingRight: PAD, marginTop: '4px' }}>
        {pts.map((p, i) => (
          <span key={i} style={{ fontFamily: 'var(--font-body)', fontSize: '0.62rem', color: '#bbb', maxWidth: '60px', textAlign: 'center' }}>
            {p.r.nama_to.split(' ').pop()}
          </span>
        ))}
      </div>
    </div>
  );
}

function TypeChips({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
      {Object.entries(TYPE_LABELS).map(([k, v]) => (
        <button key={k} onClick={() => onChange(k)} style={{
          padding: '6px 14px', borderRadius: '20px', border: 'none', cursor: 'pointer',
          fontFamily: 'var(--font-body)', fontSize: '0.82rem', fontWeight: 600,
          background: value === k ? '#0F1F6B' : '#F3F2EE',
          color: value === k ? '#fff' : '#555',
        }}>
          {v}
        </button>
      ))}
    </div>
  );
}

function LeaderboardTab({ results, userId }: { results: TOResult[]; userId: string }) {
  const [filterType, setFilterType] = useState('SNBT');
  const [namaTOIndex, setNamaTOIndex] = useState(0);
  const [board, setBoard] = useState<LeaderboardEntry[]>([]);
  const [loadingBoard, setLoadingBoard] = useState(false);

  const availableTO = useMemo(() => {
    const forType = results.filter(r => r.type === filterType);
    return Array.from(new Set(forType.map(r => r.nama_to))).sort((a, b) => b.localeCompare(a));
  }, [results, filterType]);

  const selectedNamaTO = availableTO[namaTOIndex] ?? null;

  useEffect(() => { setNamaTOIndex(0); }, [filterType]);

  useEffect(() => {
    if (!selectedNamaTO) { setBoard([]); return; }
    setLoadingBoard(true);
    supabase
      .rpc('get_to_leaderboard', { p_type: filterType, p_nama_to: selectedNamaTO })
      .then(({ data }) => {
        setBoard((data ?? []) as LeaderboardEntry[]);
        setLoadingBoard(false);
      });
  }, [selectedNamaTO, filterType]);

  return (
    <div>
      <TypeChips value={filterType} onChange={v => setFilterType(v)} />

      {availableTO.length === 0 ? (
        <div style={emptyCard}>
          <p style={{ fontFamily: 'var(--font-body)', color: '#888', margin: 0, fontSize: '0.9rem' }}>
            Kamu belum punya hasil TO {TYPE_LABELS[filterType]}.
          </p>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '16px' }}>
            {availableTO.map((nama, i) => (
              <button key={nama} onClick={() => setNamaTOIndex(i)} style={{
                padding: '5px 12px', borderRadius: '8px', cursor: 'pointer',
                border: `1.5px solid ${namaTOIndex === i ? '#0F1F6B' : '#E2E1DC'}`,
                background: namaTOIndex === i ? '#EFF6FF' : '#fff',
                color: namaTOIndex === i ? '#0F1F6B' : '#666',
                fontFamily: 'var(--font-body)', fontSize: '0.8rem', fontWeight: 600,
              }}>
                {nama}
              </button>
            ))}
          </div>

          {loadingBoard ? (
            <p style={muted}>Memuat leaderboard...</p>
          ) : board.length === 0 ? (
            <p style={muted}>Tidak ada data leaderboard.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {board.map(entry => {
                const isMe = entry.student_id === userId;
                const rankNum = Number(entry.rank);
                const rankStyle = RANK_STYLE[rankNum] ?? null;
                return (
                  <div key={entry.student_id} style={{
                    display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px',
                    borderRadius: '14px',
                    border: isMe ? '2px solid #FFE500' : '1px solid #E2E1DC',
                    background: isMe ? '#FFFDE7' : '#fff',
                    boxShadow: isMe ? '0 2px 8px rgba(255,229,0,0.18)' : '0 1px 4px rgba(0,0,0,0.04)',
                  }}>
                    <div style={{ width: '32px', textAlign: 'center', flexShrink: 0 }}>
                      {rankStyle ? (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          width: '26px', height: '26px', borderRadius: '50%',
                          background: rankStyle.bg, color: rankStyle.color,
                          fontFamily: 'var(--font-display)', fontSize: '0.85rem', fontWeight: 700,
                        }}>
                          {rankNum}
                        </span>
                      ) : (
                        <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.95rem', fontWeight: 700, color: '#aaa' }}>
                          {rankNum}
                        </span>
                      )}
                    </div>
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.88rem', fontWeight: isMe ? 700 : 500, color: '#0D0D0D', flex: 1 }}>
                      {entry.display_name}
                      {isMe && (
                        <span style={{ marginLeft: '7px', fontSize: '0.65rem', color: '#A16207', fontWeight: 700, letterSpacing: '0.04em' }}>
                          KAMU
                        </span>
                      )}
                    </span>
                    <span style={{
                      fontFamily: 'var(--font-display)', fontSize: '1.1rem',
                      color: rankNum === 1 ? '#DC0A1E' : '#0F1F6B',
                    }}>
                      {typeof entry.total_score === 'number' ? entry.total_score.toFixed(2) : '-'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function StudentHasilTO() {
  const { user } = useAuth();
  const [results, setResults] = useState<TOResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'riwayat' | 'leaderboard'>('riwayat');
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
  const chartResults = (filterType ? results.filter(r => r.type === filterType) : results)
    .slice()
    .sort((a, b) => a.tanggal_to.localeCompare(b.tanggal_to));

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', margin: 0, color: '#0D0D0D' }}>
          Tryout
        </h1>
        <a
          href="https://abdismart.web.id/toAS/"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            padding: '8px 16px', borderRadius: '8px',
            background: '#0F1F6B', color: '#FFE500',
            fontFamily: 'var(--font-body)', fontSize: '0.85rem', fontWeight: 700,
            textDecoration: 'none',
          }}
        >
          Buka TO
        </a>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '2px solid #E2E1DC', marginBottom: '20px' }}>
        {(['riwayat', 'leaderboard'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: '10px 20px', border: 'none', background: 'none', cursor: 'pointer',
            fontFamily: 'var(--font-body)', fontSize: '0.88rem', fontWeight: 700,
            color: activeTab === tab ? '#0F1F6B' : '#aaa',
            borderBottom: activeTab === tab ? '2px solid #0F1F6B' : '2px solid transparent',
            marginBottom: '-2px',
          }}>
            {tab === 'riwayat' ? 'Riwayat' : 'Leaderboard'}
          </button>
        ))}
      </div>

      {loading ? (
        <p style={muted}>Memuat...</p>
      ) : activeTab === 'leaderboard' ? (
        <LeaderboardTab results={results} userId={user!.id} />
      ) : (
        <>
          {/* Type filter chips */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
            {[['', 'Semua'], ['SNBT', 'SNBT'], ['TKA-Saintek', 'TKA Saintek'], ['TKA-Soshum', 'TKA Soshum']].map(([k, v]) => (
              <button key={k || 'all'} onClick={() => setFilterType(k)} style={{
                padding: '6px 14px', borderRadius: '20px', border: 'none', cursor: 'pointer',
                fontFamily: 'var(--font-body)', fontSize: '0.82rem', fontWeight: 600,
                background: filterType === k ? '#0F1F6B' : '#F3F2EE',
                color: filterType === k ? '#fff' : '#555',
              }}>
                {v}
              </button>
            ))}
          </div>

          {/* Trend chart (only when a type is selected and 2+ results) */}
          {filterType && chartResults.length >= 2 && (
            <div style={{ background: '#fff', borderRadius: '14px', padding: '16px 18px', marginBottom: '16px', border: '1px solid #E2E1DC', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
              <ScoreChart results={chartResults} />
            </div>
          )}

          {displayed.length === 0 ? (
            <div style={emptyCard}>
              <p style={{ fontFamily: 'var(--font-body)', color: '#888', margin: 0, fontSize: '0.9rem' }}>
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
                          <span style={{ padding: '2px 9px', borderRadius: '20px', fontSize: '0.68rem', fontWeight: 700, background: typeStyle.bg, color: typeStyle.color }}>
                            {TYPE_LABELS[r.type] ?? r.type}
                          </span>
                        </div>
                        <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: '#aaa', margin: '0 0 12px' }}>
                          {dateLabel}
                        </p>
                        <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                          {fields.map(f => (
                            <div key={f.key} style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem' }}>
                              <span style={{ color: '#bbb', marginRight: '3px' }}>{f.label}</span>
                              <span style={{ color: '#0D0D0D', fontWeight: 700 }}>{r.scores?.[f.key] ?? '-'}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', color: '#0F1F6B', lineHeight: 1 }}>
                          {typeof r.total_score === 'number' ? r.total_score.toFixed(2) : '-'}
                        </div>
                        <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.65rem', color: '#bbb', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          total
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

const muted: React.CSSProperties = { fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#888', margin: 0 };
const emptyCard: React.CSSProperties = {
  background: '#fff', border: '1px solid #E2E1DC', borderRadius: '14px', padding: '40px',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
const card: React.CSSProperties = {
  background: '#fff', border: '1px solid #E2E1DC', borderRadius: '14px', padding: '16px',
  boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
};
