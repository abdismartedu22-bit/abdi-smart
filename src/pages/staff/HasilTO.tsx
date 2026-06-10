import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

/* ── Types ─────────────────────────────────────────────────── */
type TOResult = {
  id: string;
  student_id: string;
  type: string;
  nama_to: string;
  kode_to: string | null;
  tanggal_to: string;
  scores: Record<string, number | string>;
  total_score: number;
  student: { id: string; display_name: string } | null;
};

type TryoutGroup = {
  type: string;
  kode_to: string;
  tanggal_to: string;
  rows: TOResult[];
};

type ParsedRow = {
  tryout_id: string;
  tanggal_to: string;
  student_id: string;
  nama: string;
  scores: Record<string, number>;
  total_score: number;
};

/* ── Field definitions ──────────────────────────────────────── */
const SNBT_KEYS = ['pu', 'pk', 'ppu', 'pbm', 'lbi', 'lba', 'pm'];
const SNBT_LABELS: Record<string, string> = { pu: 'PU', pk: 'PK', ppu: 'PPU', pbm: 'PBM', lbi: 'LBI', lba: 'LBA', pm: 'PM' };
const TKA_KEYS = ['ind', 'matwa', 'ing', 'fis', 'kim', 'bio', 'matlan', 'eko', 'sos', 'sej', 'geo', 'indlan', 'inglan'];
const TKA_LABELS: Record<string, string> = {
  ind: 'B.Indonesia', matwa: 'Mat.Wajib', ing: 'B.Inggris', fis: 'Fisika',
  kim: 'Kimia', bio: 'Biologi', matlan: 'Mat.Lanjut', eko: 'Ekonomi',
  sos: 'Sosiologi', sej: 'Sejarah', geo: 'Geografi', indlan: 'B.Ind.Lanjut', inglan: 'B.Ing.Lanjut',
};

const TYPE_BG: Record<string, { bg: string; color: string }> = {
  SNBT: { bg: '#EFF6FF', color: '#1D4ED8' },
  TKA:  { bg: '#F0FDF4', color: '#15803D' },
};

/* ── File parsing ──────────────────────────────────────────── */
function parseScore(val: unknown): number | null {
  if (val === null || val === undefined || val === '-' || val === '') return null;
  const n = Number(typeof val === 'string' ? val.replace(',', '.') : val);
  return isNaN(n) ? null : n;
}

function serializeDate(val: unknown): string {
  if (val instanceof Date) {
    return `${val.getFullYear()}-${String(val.getMonth() + 1).padStart(2, '0')}-${String(val.getDate()).padStart(2, '0')}`;
  }
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}/.test(val)) return val.slice(0, 10);
  if (typeof val === 'number') {
    // Excel serial date fallback
    try {
      const d = new Date(Math.round((val - 25569) * 86400 * 1000));
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
    } catch { return ''; }
  }
  return String(val ?? '').slice(0, 10);
}

async function parseFile(
  file: File,
  type: 'SNBT' | 'TKA',
): Promise<{ rows: ParsedRow[]; skipped: number }> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null }) as unknown[][];

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const keys = type === 'SNBT' ? SNBT_KEYS : TKA_KEYS;
  const rows: ParsedRow[] = [];
  let skipped = 0;

  for (const row of raw) {
    const studentId = String(row[2] ?? '').trim();
    if (!UUID_RE.test(studentId)) { skipped++; continue; }

    const tanggal = serializeDate(row[0]);
    const tryoutId = String(row[1] ?? '').trim();
    const nama = String(row[3] ?? '').trim();

    if (!tryoutId || !tanggal) { skipped++; continue; }

    const scores: Record<string, number> = {};
    keys.forEach((key, i) => {
      const base = 4 + i * 4;
      const b = parseScore(row[base]);
      const s = parseScore(row[base + 1]);
      const k = parseScore(row[base + 2]);
      const main = parseScore(row[base + 3]);
      if (b !== null) scores[`${key}_b`] = b;
      if (s !== null) scores[`${key}_s`] = s;
      if (k !== null) scores[`${key}_k`] = k;
      if (main !== null) scores[key] = main;
    });

    const mainVals = keys.map(k => scores[k]).filter((v): v is number => v !== undefined);
    const total = mainVals.length > 0 ? mainVals.reduce((a, b) => a + b, 0) / mainVals.length : 0;

    rows.push({
      tryout_id: tryoutId,
      tanggal_to: tanggal,
      student_id: studentId,
      nama,
      scores,
      total_score: parseFloat(total.toFixed(4)),
    });
  }

  return { rows, skipped };
}

/* ── Upload Modal ──────────────────────────────────────────── */
function UploadModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [type, setType] = useState<'SNBT' | 'TKA'>('SNBT');
  const [parsed, setParsed] = useState<{ rows: ParsedRow[]; skipped: number } | null>(null);
  const [parsing, setParsing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [fileName, setFileName] = useState('');

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name);
    setParsed(null);
    setError('');
    setParsing(true);
    try {
      const result = await parseFile(f, type);
      setParsed(result);
    } catch (err: unknown) {
      setError(`Gagal membaca file: ${err instanceof Error ? err.message : String(err)}`);
    }
    setParsing(false);
  }

  function handleTypeChange(t: 'SNBT' | 'TKA') {
    setType(t);
    setParsed(null);
    setFileName('');
    setError('');
    if (fileRef.current) fileRef.current.value = '';
  }

  async function handleUpload() {
    if (!parsed || parsed.rows.length === 0) return;
    setUploading(true);
    setError('');

    const uniqueIds = [...new Set(parsed.rows.map(r => r.tryout_id))];

    for (const id of uniqueIds) {
      const { error: delErr } = await supabase
        .from('tryout_results')
        .delete()
        .eq('type', type)
        .eq('kode_to', id);
      if (delErr) { setError(delErr.message); setUploading(false); return; }
    }

    const payload = parsed.rows.map(r => ({
      type,
      nama_to: r.tryout_id,
      kode_to: r.tryout_id,
      tanggal_to: r.tanggal_to,
      student_id: r.student_id,
      scores: r.scores,
      total_score: r.total_score,
      entered_by: user?.id,
    }));

    const BATCH = 200;
    for (let i = 0; i < payload.length; i += BATCH) {
      const { error: insErr } = await supabase.from('tryout_results').insert(payload.slice(i, i + BATCH));
      if (insErr) { setError(insErr.message); setUploading(false); return; }
    }

    setUploading(false);
    onSaved();
  }

  const tryoutIds = parsed ? [...new Set(parsed.rows.map(r => r.tryout_id))] : [];
  const sampleDate = parsed?.rows[0]?.tanggal_to ?? '';
  const preview = parsed?.rows.slice(0, 5) ?? [];

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '16px', overflowY: 'auto' }}>
      <div style={{ background: '#fff', borderRadius: '14px', padding: '28px', width: '100%', maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', margin: '0 0 20px' }}>Upload Hasil TO</h2>

        {/* Type */}
        <div style={{ marginBottom: '16px' }}>
          <p style={labelStyle}>Jenis TO</p>
          <div style={{ display: 'flex', gap: '8px' }}>
            {(['SNBT', 'TKA'] as const).map(k => (
              <button key={k} type="button" onClick={() => handleTypeChange(k)} style={{
                padding: '7px 20px', borderRadius: '20px', border: 'none', cursor: 'pointer',
                fontFamily: 'var(--font-body)', fontSize: '0.85rem', fontWeight: 700,
                background: type === k ? '#0D5C3A' : '#F3F2EE',
                color: type === k ? '#fff' : '#555',
              }}>{k}</button>
            ))}
          </div>
        </div>

        {/* Format hint */}
        <div style={{ background: '#F0F9F4', border: '1px solid #BBF7D0', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px' }}>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: '#166534', margin: 0, lineHeight: 1.6 }}>
            <strong>Format kolom {type}:</strong><br />
            {type === 'SNBT'
              ? 'Date | Tryout ID | Student ID | Nama | PU (B,S,K,SKOR) | PK | PPU | PBM | LBI | LBA | PM'
              : 'Date | Tryout ID | Student ID | Nama | IND (B,S,K,N) | MatWa | Ing | Fis | Kim | Bio | MatLan | Eko | Sos | Sej | Geo | IndLan | IngLan'}
            <br /><span style={{ color: '#888' }}>Nilai "-" = tidak mengambil mapel, akan dilewati.</span>
          </p>
        </div>

        {/* File input */}
        <div style={{ marginBottom: '16px' }}>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            style={{
              width: '100%', padding: '14px', border: '2px dashed #E2E1DC', borderRadius: '10px',
              background: fileName ? '#F0F9F4' : '#FAFAF9', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
              fontFamily: 'var(--font-body)', fontSize: '0.88rem', fontWeight: 600,
              color: fileName ? '#0D5C3A' : '#666',
              borderColor: fileName ? '#BBF7D0' : '#E2E1DC',
              transition: 'all 0.15s',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            {fileName ? fileName : 'Pilih File CSV / XLSX'}
          </button>
        </div>

        {/* Parse status */}
        {parsing && <p style={{ ...muted, marginBottom: '12px' }}>Membaca file...</p>}

        {/* Preview */}
        {parsed && parsed.rows.length === 0 && (
          <div style={{ background: '#FFF0F1', border: '1px solid #FECACA', borderRadius: '8px', padding: '12px', marginBottom: '16px' }}>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#DC0A1E', margin: 0 }}>
              Tidak ada baris valid. Pastikan kolom Student ID berisi UUID siswa.
            </p>
          </div>
        )}

        {parsed && parsed.rows.length > 0 && (
          <div style={{ background: '#F9F9F7', border: '1px solid #E2E1DC', borderRadius: '10px', padding: '14px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', gap: '16px', marginBottom: '10px', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', color: '#0D5C3A', lineHeight: 1 }}>{parsed.rows.length}</div>
                <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.72rem', color: '#666' }}>siswa valid</div>
              </div>
              {parsed.skipped > 0 && (
                <div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', color: '#A16207', lineHeight: 1 }}>{parsed.skipped}</div>
                  <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.72rem', color: '#666' }}>baris dilewati</div>
                </div>
              )}
            </div>

            <div style={{ marginBottom: '8px' }}>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: '#555', fontWeight: 600 }}>Tryout ID: </span>
              {tryoutIds.map(id => (
                <span key={id} style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', background: '#0D5C3A', color: '#fff', padding: '1px 8px', borderRadius: '4px', marginRight: '4px' }}>{id}</span>
              ))}
              {sampleDate && (
                <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: '#888', marginLeft: '4px' }}>
                  {new Date(sampleDate + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
              )}
            </div>

            <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: '#555', marginBottom: '8px' }}>
              {preview.map(r => r.nama || r.student_id.slice(0, 8)).join(', ')}
              {parsed.rows.length > 5 && ` dan ${parsed.rows.length - 5} lainnya`}
            </div>

            <div style={{ background: '#FFF0F1', border: '1px solid #FECACA', borderRadius: '6px', padding: '8px 10px' }}>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: '#DC0A1E', margin: 0 }}>
                Semua data {type} dengan Tryout ID <strong>{tryoutIds.join(', ')}</strong> akan dihapus dan diganti.
              </p>
            </div>
          </div>
        )}

        {error && <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.83rem', color: '#DC0A1E', margin: '0 0 12px' }}>{error}</p>}

        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={onClose} style={btnSecondary}>Batal</button>
          <button
            onClick={handleUpload}
            disabled={uploading || !parsed || parsed.rows.length === 0}
            style={{ ...btnPrimary, opacity: (!parsed || parsed.rows.length === 0) ? 0.5 : 1 }}
          >
            {uploading ? 'Mengupload...' : 'Upload dan Ganti Data'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main ──────────────────────────────────────────────────── */
export default function StaffHasilTO() {
  const [results, setResults] = useState<TOResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TryoutGroup | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('tryout_results')
      .select('id, student_id, type, nama_to, kode_to, tanggal_to, scores, total_score, student:profiles!student_id(id, display_name)')
      .order('tanggal_to', { ascending: false });
    setResults((data ?? []) as unknown as TOResult[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const grouped = useMemo<TryoutGroup[]>(() => {
    const map = new Map<string, TryoutGroup>();
    for (const r of results) {
      if (filterType && r.type !== filterType) continue;
      const key = `${r.type}__${r.kode_to ?? r.nama_to}`;
      if (!map.has(key)) {
        map.set(key, { type: r.type, kode_to: r.kode_to ?? r.nama_to, tanggal_to: r.tanggal_to, rows: [] });
      }
      map.get(key)!.rows.push(r);
    }
    return Array.from(map.values()).sort((a, b) => b.tanggal_to.localeCompare(a.tanggal_to));
  }, [results, filterType]);

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    await supabase
      .from('tryout_results')
      .delete()
      .eq('type', deleteTarget.type)
      .eq('kode_to', deleteTarget.kode_to);
    setDeleting(false);
    setDeleteTarget(null);
    load();
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', margin: 0, color: '#0D0D0D' }}>Hasil Tryout</h1>
        <button onClick={() => setShowModal(true)} style={btnPrimary}>+ Upload TO</button>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} style={selectStyle}>
          <option value="">Semua Jenis</option>
          <option value="SNBT">SNBT</option>
          <option value="TKA">TKA</option>
        </select>
      </div>

      {loading ? (
        <p style={muted}>Memuat...</p>
      ) : grouped.length === 0 ? (
        <div style={emptyCard}><p style={{ fontFamily: 'var(--font-body)', color: '#666', margin: 0 }}>Belum ada data hasil TO.</p></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {grouped.map(g => {
            const key = `${g.type}__${g.kode_to}`;
            const typeInfo = TYPE_BG[g.type] ?? { bg: '#F3F2EE', color: '#666' };
            const dateLabel = g.tanggal_to
              ? new Date(g.tanggal_to + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
              : '-';
            const avg = g.rows.reduce((sum, r) => sum + (r.total_score ?? 0), 0) / g.rows.length;
            const isOpen = expanded[key] ?? false;

            return (
              <div key={key} style={card}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.95rem', color: '#0D0D0D', flex: 1 }}>
                    {g.kode_to}
                  </span>
                  <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 700, background: typeInfo.bg, color: typeInfo.color, flexShrink: 0 }}>
                    {g.type}
                  </span>
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: '#666', flexShrink: 0 }}>{dateLabel}</span>
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: '#0D5C3A', fontWeight: 600, flexShrink: 0 }}>
                    {g.rows.length} siswa
                  </span>
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: '#888', flexShrink: 0 }}>
                    avg {avg.toFixed(2)}
                  </span>
                  <button
                    onClick={() => setExpanded(ex => ({ ...ex, [key]: !isOpen }))}
                    style={{ ...editBtn, flexShrink: 0 }}
                  >
                    {isOpen ? 'Tutup' : 'Detail'}
                  </button>
                  <button
                    onClick={() => setDeleteTarget(g)}
                    style={{ ...editBtn, color: '#DC0A1E', background: '#FFF0F1', borderColor: '#FECACA', flexShrink: 0 }}
                  >
                    Hapus
                  </button>
                </div>

                {isOpen && (
                  <div style={{ marginTop: '12px', borderTop: '1px solid #E2E1DC', paddingTop: '12px' }}>
                    <StudentScoreTable rows={g.rows} type={g.type} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <UploadModal onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); load(); }} />
      )}

      {deleteTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px' }}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '28px 32px', maxWidth: '380px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', margin: '0 0 10px' }}>Hapus Data TO?</h2>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.88rem', color: '#666', margin: '0 0 20px' }}>
              Semua hasil <strong>{deleteTarget.type}</strong> Tryout ID <strong>{deleteTarget.kode_to}</strong> ({deleteTarget.rows.length} siswa) akan dihapus permanen.
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setDeleteTarget(null)} style={btnSecondary}>Batal</button>
              <button onClick={confirmDelete} disabled={deleting} style={{ ...btnPrimary, background: '#DC0A1E' }}>
                {deleting ? 'Menghapus...' : 'Hapus Semua'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Student score table (inside expanded group) ───────────── */
function StudentScoreTable({ rows, type }: { rows: TOResult[]; type: string }) {
  const keys = type === 'SNBT' ? SNBT_KEYS : TKA_KEYS;
  const labels = type === 'SNBT' ? SNBT_LABELS : TKA_LABELS;

  // Only show subjects that at least one student has a score for
  const activeKeys = keys.filter(k => rows.some(r => {
    const v = r.scores?.[k];
    return v !== null && v !== undefined && v !== '-' && !isNaN(Number(v));
  }));

  const sorted = [...rows].sort((a, b) => (b.total_score ?? 0) - (a.total_score ?? 0));

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: `${(activeKeys.length + 2) * 72}px` }}>
        <thead>
          <tr>
            <th style={thStyle('#555')}>Siswa</th>
            {activeKeys.map(k => (
              <th key={k} style={thStyle('#0D5C3A')}>{labels[k]}</th>
            ))}
            <th style={thStyle('#1D4ED8')}>Rata-rata</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r, i) => (
            <tr key={r.id} style={{ background: i % 2 === 0 ? '#fff' : '#F9FAFB' }}>
              <td style={{ ...tdStyle, textAlign: 'left', fontWeight: 600, whiteSpace: 'nowrap' }}>
                {r.student?.display_name ?? r.student_id.slice(0, 8)}
              </td>
              {activeKeys.map(k => {
                const v = r.scores?.[k];
                const n = v !== null && v !== undefined && v !== '-' ? Number(v) : null;
                return (
                  <td key={k} style={tdStyle}>
                    {n !== null && !isNaN(n) ? n.toFixed(2) : <span style={{ color: '#ddd' }}>-</span>}
                  </td>
                );
              })}
              <td style={{ ...tdStyle, fontWeight: 700, color: '#1D4ED8' }}>
                {typeof r.total_score === 'number' ? r.total_score.toFixed(2) : '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Styles ────────────────────────────────────────────────── */
const muted: React.CSSProperties = { fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#666', margin: 0 };
const emptyCard: React.CSSProperties = { background: '#fff', border: '1px solid #E2E1DC', borderRadius: '10px', padding: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const card: React.CSSProperties = { background: '#fff', border: '1px solid #E2E1DC', borderRadius: '10px', padding: '16px' };
const selectStyle: React.CSSProperties = { padding: '9px 12px', border: '1.5px solid #E2E1DC', borderRadius: '8px', fontFamily: 'var(--font-body)', fontSize: '0.85rem', background: '#fff', color: '#0D0D0D', outline: 'none', cursor: 'pointer' };
const labelStyle: React.CSSProperties = { fontFamily: 'var(--font-body)', fontSize: '0.82rem', fontWeight: 600, color: '#2E2E2E', margin: '0 0 6px' };
const btnPrimary: React.CSSProperties = { flex: 1, padding: '10px 16px', background: '#0D5C3A', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.88rem' };
const btnSecondary: React.CSSProperties = { flex: 1, padding: '10px', background: '#F3F2EE', color: '#2E2E2E', border: 'none', borderRadius: '8px', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.88rem' };
const editBtn: React.CSSProperties = { padding: '5px 12px', background: '#F3F2EE', color: '#0D0D0D', border: '1px solid #E2E1DC', borderRadius: '6px', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.78rem' };
function thStyle(color: string): React.CSSProperties {
  return { background: color, color: '#fff', padding: '7px 10px', fontFamily: 'var(--font-body)', fontSize: '0.72rem', fontWeight: 700, textAlign: 'center', whiteSpace: 'nowrap' };
}
const tdStyle: React.CSSProperties = { padding: '7px 10px', border: '1px solid #F3F2EE', fontFamily: 'var(--font-body)', fontSize: '0.82rem', textAlign: 'center', color: '#0D0D0D' };
