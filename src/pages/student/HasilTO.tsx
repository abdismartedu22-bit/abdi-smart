import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

type TOResult = {
  id: string;
  type: string;
  nama_to: string;
  kode_to: string | null;
  tanggal_to: string;
  scores: Record<string, number | null>;
  total_score: number;
};

type LeaderboardEntry = { student_id: string; display_name: string; total_score: number; rank: number };

/* ─── Field definitions ─── */
const SNBT_FIELDS = [
  { key: 'pu',  label: 'PU',  color: '#1E3A5F' },
  { key: 'pk',  label: 'PK',  color: '#E67E22' },
  { key: 'ppu', label: 'PPU', color: '#7F8C8D' },
  { key: 'pbm', label: 'PBM', color: '#D4A017' },
  { key: 'lbi', label: 'LBI', color: '#2980B9' },
  { key: 'lba', label: 'LBA', color: '#27AE60' },
  { key: 'pm',  label: 'PM',  color: '#8E44AD' },
];
const TKA_FIELDS = [
  { key: 'ind',    label: 'IND',      color: '#1E3A5F' },
  { key: 'matwa',  label: 'Mat.Wa',   color: '#E67E22' },
  { key: 'ing',    label: 'ING',      color: '#7F8C8D' },
  { key: 'fis',    label: 'FIS',      color: '#D4A017' },
  { key: 'kim',    label: 'KIM',      color: '#2980B9' },
  { key: 'bio',    label: 'BIO',      color: '#27AE60' },
  { key: 'matlan', label: 'Mat.Lan',  color: '#8E44AD' },
  { key: 'eko',    label: 'EKO',      color: '#C0392B' },
  { key: 'sos',    label: 'SOS',      color: '#16A085' },
  { key: 'sej',    label: 'SEJ',      color: '#F39C12' },
  { key: 'geo',    label: 'GEO',      color: '#2ECC71' },
  { key: 'indlan', label: 'IND.Lan',  color: '#9B59B6' },
  { key: 'inglan', label: 'ING.Lan',  color: '#E74C3C' },
];
const ALL_FIELDS: Record<string, typeof SNBT_FIELDS> = { SNBT: SNBT_FIELDS, TKA: TKA_FIELDS };

function numVal(v: number | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

/* ─── RADAR CHART ─── */
function RadarChart({ fields, values, maxVal }: {
  fields: { key: string; label: string; color: string }[];
  values: number[];
  maxVal: number;
}) {
  const n = fields.length;
  const cx = 200, cy = 195, R = 148;

  function angle(i: number) { return (i * 2 * Math.PI / n) - Math.PI / 2; }
  function pt(i: number, r: number) {
    const a = angle(i);
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  }
  function ta(i: number) {
    const a = angle(i);
    const cos = Math.cos(a);
    if (cos < -0.3) return 'end';
    if (cos > 0.3) return 'start';
    return 'middle';
  }
  function db(i: number) {
    const sin = Math.sin(angle(i));
    if (sin < -0.4) return 'auto';
    if (sin > 0.4) return 'hanging';
    return 'middle';
  }

  const gridRings = [0.2, 0.4, 0.6, 0.8, 1.0];
  const gridPoints = gridRings.map(s =>
    Array.from({ length: n }, (_, i) => pt(i, R * s)).map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  );

  const dataPoints = values.map((v, i) => pt(i, R * Math.min(1, Math.max(0, v / maxVal))));
  const dataPath = dataPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ') + ' Z';

  return (
    <svg viewBox="0 0 400 400" style={{ width: '100%', maxWidth: '300px', display: 'block', margin: '0 auto' }}>
      {/* Grid rings */}
      {gridPoints.map((pts, k) => (
        <polygon key={k} points={pts} fill="none" stroke="#E2E1DC" strokeWidth={k === 4 ? 1.5 : 1} />
      ))}
      {/* Grid values */}
      {gridRings.map((s, k) => {
        const p = pt(0, R * s);
        return (
          <text key={k} x={p.x + 4} y={p.y} fontSize="9" fill="#ccc" fontFamily="var(--font-body)">{Math.round(maxVal * s)}</text>
        );
      })}
      {/* Axes */}
      {Array.from({ length: n }, (_, i) => {
        const p = pt(i, R);
        return <line key={i} x1={cx} y1={cy} x2={p.x.toFixed(1)} y2={p.y.toFixed(1)} stroke="#E2E1DC" strokeWidth="1" />;
      })}
      {/* Data area */}
      <path d={dataPath} fill="rgba(230,100,30,0.15)" stroke="#E6641E" strokeWidth="2.5" strokeLinejoin="round" />
      {dataPoints.map((p, i) => (
        <circle key={i} cx={p.x.toFixed(1)} cy={p.y.toFixed(1)} r="4" fill="#E6641E" />
      ))}
      {/* Labels */}
      {Array.from({ length: n }, (_, i) => {
        const p = pt(i, R + 24);
        return (
          <text key={i} x={p.x.toFixed(1)} y={p.y.toFixed(1)} textAnchor={ta(i)} dominantBaseline={db(i)}
            fontSize="13" fontFamily="var(--font-body)" fontWeight="700" fill="#0D0D0D">
            {fields[i].label}
          </text>
        );
      })}
    </svg>
  );
}

/* ─── BAR CHART (single subject) ─── */
function BarChart({ values, xLabels }: { values: number[]; xLabels: string[] }) {
  const W = 500, H = 170, PT = 28, PR = 8, PB = 28, PL = 8;
  const cW = W - PL - PR, cH = H - PT - PB;
  const n = values.length;
  if (n === 0) return null;
  const maxV = Math.max(...values, 1);
  const bW = Math.min(40, (cW / n) * 0.65);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block' }}>
      {values.map((v, i) => {
        const bH = (v / maxV) * cH;
        const x = PL + (i + 0.5) * (cW / n) - bW / 2;
        const y = PT + cH - bH;
        return (
          <g key={i}>
            <rect x={x.toFixed(1)} y={y.toFixed(1)} width={bW} height={bH.toFixed(1)} fill="#1E3A5F" rx="2" />
            <text x={(x + bW / 2).toFixed(1)} y={(y - 5).toFixed(1)} textAnchor="middle" fontSize="9" fill="#1E3A5F" fontFamily="var(--font-body)" fontWeight="700">
              {v % 1 === 0 ? v : v.toFixed(2)}
            </text>
            <text x={(x + bW / 2).toFixed(1)} y={(H - PB + 14).toFixed(1)} textAnchor="middle" fontSize="11" fill="#666" fontFamily="var(--font-body)">
              {xLabels[i]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* ─── MULTI LINE CHART (all subjects) ─── */
function MultiLineChart({ series, xLabels, maxVal }: {
  series: { key: string; label: string; color: string; values: (number | null)[] }[];
  xLabels: string[];
  maxVal: number;
}) {
  const W = 520, H = 230, PT = 16, PR = 20, PB = 36, PL = 44;
  const cW = W - PL - PR, cH = H - PT - PB;
  const n = xLabels.length;
  if (n < 1) return null;

  const ticks = maxVal <= 100
    ? [0, 20, 40, 60, 80, 100]
    : [0, 200, 400, 600, 800, 1000];

  function px(i: number) { return PL + (n > 1 ? (i / (n - 1)) * cW : cW / 2); }
  function py(v: number) { return PT + cH - (v / maxVal) * cH; }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block' }}>
      {/* Grid */}
      {ticks.map(t => (
        <g key={t}>
          <line x1={PL} y1={py(t).toFixed(1)} x2={PL + cW} y2={py(t).toFixed(1)} stroke="#F3F2EE" strokeWidth="1" />
          <text x={PL - 4} y={py(t).toFixed(1)} textAnchor="end" dominantBaseline="middle" fontSize="9" fill="#aaa" fontFamily="var(--font-body)">{t}</text>
        </g>
      ))}
      {/* X labels */}
      {xLabels.map((lbl, i) => (
        <text key={i} x={px(i).toFixed(1)} y={H - PB + 16} textAnchor="middle" fontSize="11" fill="#666" fontFamily="var(--font-body)">{lbl}</text>
      ))}
      {/* Lines */}
      {series.map(s => {
        let d = '';
        s.values.forEach((v, i) => {
          if (v !== null) {
            const prev = i > 0 ? s.values[i - 1] : null;
            d += `${prev === null || d === '' ? 'M' : 'L'} ${px(i).toFixed(1)} ${py(v).toFixed(1)} `;
          }
        });
        return (
          <g key={s.key}>
            {d && <path d={d.trim()} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />}
            {s.values.map((v, i) => v !== null && (
              <circle key={i} cx={px(i).toFixed(1)} cy={py(v).toFixed(1)} r="3.5" fill={s.color} />
            ))}
          </g>
        );
      })}
    </svg>
  );
}

/* ─── LEADERBOARD ─── */
const RANK_STYLE: Record<number, { bg: string; color: string }> = {
  1: { bg: '#FEF3C7', color: '#92400E' },
  2: { bg: '#F1F5F9', color: '#475569' },
  3: { bg: '#FFF4ED', color: '#9A3412' },
};

function LeaderboardTab({ results, userId }: { results: TOResult[]; userId: string }) {
  const [filterType, setFilterType] = useState<'SNBT' | 'TKA'>('SNBT');
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
    supabase.rpc('get_to_leaderboard', { p_type: filterType, p_nama_to: selectedNamaTO })
      .then(({ data }) => { setBoard((data ?? []) as LeaderboardEntry[]); setLoadingBoard(false); });
  }, [selectedNamaTO, filterType]);

  return (
    <div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        {(['SNBT', 'TKA'] as const).map(k => (
          <button key={k} onClick={() => setFilterType(k)} style={{
            padding: '6px 14px', borderRadius: '20px', border: 'none', cursor: 'pointer',
            fontFamily: 'var(--font-body)', fontSize: '0.82rem', fontWeight: 600,
            background: filterType === k ? '#0D5C3A' : '#F3F2EE',
            color: filterType === k ? '#fff' : '#555',
          }}>{k}</button>
        ))}
      </div>
      {availableTO.length === 0 ? (
        <div style={emptyCard}><p style={{ fontFamily: 'var(--font-body)', color: '#888', margin: 0 }}>Belum ada TO {filterType}.</p></div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '16px' }}>
            {availableTO.map((nama, i) => (
              <button key={nama} onClick={() => setNamaTOIndex(i)} style={{
                padding: '5px 12px', borderRadius: '8px', cursor: 'pointer',
                border: `1.5px solid ${namaTOIndex === i ? '#0D5C3A' : '#E2E1DC'}`,
                background: namaTOIndex === i ? '#EFF6FF' : '#fff',
                color: namaTOIndex === i ? '#0D5C3A' : '#666',
                fontFamily: 'var(--font-body)', fontSize: '0.8rem', fontWeight: 600,
              }}>{nama}</button>
            ))}
          </div>
          {loadingBoard ? <p style={muted}>Memuat...</p> : board.length === 0 ? (
            <p style={muted}>Tidak ada data leaderboard.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {board.map(entry => {
                const isMe = entry.student_id === userId;
                const rn = Number(entry.rank);
                const rs = RANK_STYLE[rn] ?? null;
                return (
                  <div key={entry.student_id} style={{
                    display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px',
                    borderRadius: '14px', border: isMe ? '2px solid #FFE500' : '1px solid #E2E1DC',
                    background: isMe ? '#FFFDE7' : '#fff', boxShadow: isMe ? '0 2px 8px rgba(255,229,0,0.18)' : '0 1px 4px rgba(0,0,0,0.04)',
                  }}>
                    <div style={{ width: '32px', textAlign: 'center', flexShrink: 0 }}>
                      {rs ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '26px', height: '26px', borderRadius: '50%', background: rs.bg, color: rs.color, fontFamily: 'var(--font-display)', fontSize: '0.85rem', fontWeight: 700 }}>{rn}</span>
                      ) : (
                        <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.95rem', fontWeight: 700, color: '#aaa' }}>{rn}</span>
                      )}
                    </div>
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.88rem', fontWeight: isMe ? 700 : 500, color: '#0D0D0D', flex: 1 }}>
                      {entry.display_name}
                      {isMe && <span style={{ marginLeft: '7px', fontSize: '0.65rem', color: '#A16207', fontWeight: 700, letterSpacing: '0.04em' }}>KAMU</span>}
                    </span>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: rn === 1 ? '#DC0A1E' : '#0D5C3A' }}>
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

/* ─── MAIN ─── */
export default function StudentHasilTO() {
  const { user, profile } = useAuth();
  const [results, setResults] = useState<TOResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'riwayat' | 'leaderboard'>('riwayat');
  const [filterType, setFilterType] = useState<'SNBT' | 'TKA'>('SNBT');
  const [selectedMapel, setSelectedMapel] = useState<string>('ALL');

  useEffect(() => {
    if (!user) return;
    supabase.from('tryout_results')
      .select('id, type, nama_to, kode_to, tanggal_to, scores, total_score')
      .eq('student_id', user.id)
      .order('tanggal_to', { ascending: true })
      .then(({ data }) => { setResults((data ?? []) as TOResult[]); setLoading(false); });
  }, [user]);

  /* ── Derived data for riwayat ── */
  const sorted = useMemo(() =>
    results.filter(r => r.type === filterType).sort((a, b) => a.tanggal_to.localeCompare(b.tanggal_to)),
    [results, filterType]
  );

  const allFields = ALL_FIELDS[filterType] ?? SNBT_FIELDS;
  const maxVal = filterType === 'SNBT' ? 1000 : 100;

  const activeFields = useMemo(() =>
    allFields.filter(f => sorted.some(r => numVal(r.scores?.[f.key]) !== null)),
    [allFields, sorted]
  );

  const averages = useMemo(() => {
    const out: Record<string, number> = {};
    activeFields.forEach(f => {
      const vals = sorted.map(r => numVal(r.scores?.[f.key])).filter((v): v is number => v !== null && v > 0);
      out[f.key] = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    });
    return out;
  }, [activeFields, sorted]);

  const bestIdx = useMemo(() =>
    sorted.reduce((best, _, i) => (sorted[i].total_score ?? 0) > (sorted[best]?.total_score ?? 0) ? i : best, 0),
    [sorted]
  );

  const xLabels = sorted.map((_, i) => String(i + 1));

  const chartSeries = activeFields.map(f => ({
    ...f,
    values: sorted.map(r => numVal(r.scores?.[f.key])),
  }));

  const singleSeries = chartSeries.find(s => s.key === selectedMapel);

  /* Reset mapel selection when type changes */
  useEffect(() => { setSelectedMapel('ALL'); }, [filterType]);

  return (
    <div>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', margin: 0, color: '#0D0D0D' }}>Tryout</h1>
        <a href="https://abdismart.web.id/toAS/" target="_blank" rel="noopener noreferrer"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', background: '#0D5C3A', color: '#FFE500', fontFamily: 'var(--font-body)', fontSize: '0.85rem', fontWeight: 700, textDecoration: 'none' }}>
          Buka TO
        </a>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '2px solid #E2E1DC', marginBottom: '20px' }}>
        {(['riwayat', 'leaderboard'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: '10px 20px', border: 'none', background: 'none', cursor: 'pointer',
            fontFamily: 'var(--font-body)', fontSize: '0.88rem', fontWeight: 700,
            color: activeTab === tab ? '#0D5C3A' : '#aaa',
            borderBottom: activeTab === tab ? '2px solid #0D5C3A' : '2px solid transparent',
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
          {/* Type filter */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
            {(['SNBT', 'TKA'] as const).map(k => (
              <button key={k} onClick={() => setFilterType(k)} style={{
                padding: '7px 18px', borderRadius: '20px', border: 'none', cursor: 'pointer',
                fontFamily: 'var(--font-body)', fontSize: '0.85rem', fontWeight: 700,
                background: filterType === k ? '#0D5C3A' : '#F3F2EE',
                color: filterType === k ? '#fff' : '#555',
              }}>{k}</button>
            ))}
          </div>

          {sorted.length === 0 ? (
            <div style={emptyCard}>
              <p style={{ fontFamily: 'var(--font-body)', color: '#888', margin: 0 }}>Belum ada hasil TO {filterType}.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* ── Info card ── */}
              <div style={{ background: '#fff', border: '1px solid #E2E1DC', borderRadius: '12px', overflow: 'hidden' }}>
                <div style={{ background: '#0D5C3A', padding: '10px 16px', textAlign: 'center' }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.8rem', color: '#FFE500', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                    Resume Progres TO {filterType}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0' }}>
                  {[
                    { label: 'Nama', value: profile?.display_name ?? '-' },
                    { label: 'Jumlah TO', value: `${sorted.length} kali` },
                    { label: 'Sekolah', value: profile?.sekolah ?? '-' },
                    { label: 'TO Terbaik', value: sorted[bestIdx] ? `#${bestIdx + 1}${sorted[bestIdx].kode_to ? ` (${sorted[bestIdx].kode_to})` : ''} — ${sorted[bestIdx].total_score?.toFixed(2)}` : '-' },
                  ].map((item, i) => (
                    <div key={i} style={{ padding: '10px 16px', background: i % 2 === 0 ? '#F9FAFB' : '#fff', borderTop: i >= 2 ? '1px solid #E2E1DC' : 'none', borderRight: i % 2 === 0 ? '1px solid #E2E1DC' : 'none' }}>
                      <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.68rem', fontWeight: 700, color: '#0D5C3A', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '2px' }}>{item.label}</div>
                      <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.88rem', fontWeight: 600, color: '#0D0D0D' }}>{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Radar chart ── */}
              {activeFields.length >= 3 && (
                <div style={{ ...card, padding: '20px 16px' }}>
                  <p style={sectionLabel}>Rata-rata Semua TO</p>
                  <RadarChart
                    fields={activeFields}
                    values={activeFields.map(f => averages[f.key] ?? 0)}
                    maxVal={maxVal}
                  />
                </div>
              )}

              {/* ── Averages table ── */}
              {activeFields.length > 0 && (
                <div style={card}>
                  <p style={sectionLabel}>Rata-rata per Mapel</p>
                  <div style={{ overflowX: 'auto', marginTop: '8px' }}>
                    <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: `${activeFields.length * 72}px` }}>
                      <thead>
                        <tr>
                          {activeFields.map(f => (
                            <th key={f.key} style={{ background: f.color, color: '#fff', padding: '7px 10px', fontFamily: 'var(--font-body)', fontSize: '0.75rem', fontWeight: 700, textAlign: 'center', whiteSpace: 'nowrap' }}>
                              {f.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          {activeFields.map(f => (
                            <td key={f.key} style={{ background: '#FFFDE7', border: '1px solid #E2E1DC', padding: '8px 10px', fontFamily: 'var(--font-body)', fontSize: '0.85rem', fontWeight: 700, textAlign: 'center', color: '#0D0D0D' }}>
                              {(averages[f.key] ?? 0).toFixed(2)}
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ── Progress chart ── */}
              {sorted.length >= 1 && activeFields.length > 0 && (
                <div style={card}>
                  {/* MAPEL picker */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.72rem', fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Mapel</span>
                    <button onClick={() => setSelectedMapel('ALL')} style={mapelBtn(selectedMapel === 'ALL', '#0D5C3A')}>ALL</button>
                    {activeFields.map(f => (
                      <button key={f.key} onClick={() => setSelectedMapel(f.key)} style={mapelBtn(selectedMapel === f.key, f.color)}>
                        {f.label}
                      </button>
                    ))}
                  </div>

                  {selectedMapel === 'ALL' ? (
                    <MultiLineChart series={chartSeries} xLabels={xLabels} maxVal={maxVal} />
                  ) : singleSeries ? (
                    <BarChart values={singleSeries.values.map(v => v ?? 0)} xLabels={xLabels} />
                  ) : null}

                  {/* Data table */}
                  <div style={{ overflowX: 'auto', marginTop: '16px' }}>
                    <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: `${(activeFields.length + 2) * 72}px` }}>
                      <thead>
                        <tr>
                          <th style={thStyle('#555')}>#</th>
                          {activeFields.map(f => (
                            <th key={f.key} style={thStyle(f.color)}>{f.label}</th>
                          ))}
                          <th style={thStyle('#0D5C3A')}>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sorted.map((r, i) => (
                          <tr key={r.id} style={{ background: i % 2 === 0 ? '#fff' : '#F9FAFB' }}>
                            <td style={tdStyle}>{i + 1}{r.kode_to ? <span style={{ color: '#888', fontSize: '0.7rem' }}> ({r.kode_to})</span> : ''}</td>
                            {activeFields.map(f => {
                              const v = numVal(r.scores?.[f.key]);
                              return (
                                <td key={f.key} style={tdStyle}>
                                  {v !== null ? v.toFixed(2) : <span style={{ color: '#ddd' }}>-</span>}
                                </td>
                              );
                            })}
                            <td style={{ ...tdStyle, fontWeight: 700, color: '#0D5C3A' }}>
                              {typeof r.total_score === 'number' ? r.total_score.toFixed(2) : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Legend for multi-line */}
                  {selectedMapel === 'ALL' && (
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '12px' }}>
                      {activeFields.map(f => (
                        <div key={f.key} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <div style={{ width: '14px', height: '3px', background: f.color, borderRadius: '2px' }} />
                          <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.72rem', color: '#666' }}>{f.label}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

            </div>
          )}
        </>
      )}
    </div>
  );
}

function mapelBtn(active: boolean, color: string): React.CSSProperties {
  return {
    padding: '4px 12px', borderRadius: '20px', border: 'none', cursor: 'pointer',
    fontFamily: 'var(--font-body)', fontSize: '0.76rem', fontWeight: 700,
    background: active ? color : '#F3F2EE',
    color: active ? '#fff' : '#555',
    transition: 'all 0.12s',
  };
}

function thStyle(color: string): React.CSSProperties {
  return { background: color, color: '#fff', padding: '7px 10px', fontFamily: 'var(--font-body)', fontSize: '0.72rem', fontWeight: 700, textAlign: 'center', whiteSpace: 'nowrap' };
}

const tdStyle: React.CSSProperties = {
  padding: '7px 10px', border: '1px solid #F3F2EE',
  fontFamily: 'var(--font-body)', fontSize: '0.82rem', textAlign: 'center', color: '#0D0D0D',
};

const muted: React.CSSProperties = { fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#888', margin: 0 };
const emptyCard: React.CSSProperties = { background: '#fff', border: '1px solid #E2E1DC', borderRadius: '14px', padding: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const card: React.CSSProperties = { background: '#fff', border: '1px solid #E2E1DC', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' };
const sectionLabel: React.CSSProperties = { fontFamily: 'var(--font-body)', fontSize: '0.7rem', fontWeight: 700, color: '#aaa', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.08em' };
