import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

type Student = { id: string; display_name: string; nama: string };

type TOResult = {
  id: string;
  student_id: string;
  type: string;
  nama_to: string;
  kode_to: string | null;
  tanggal_to: string;
  scores: Record<string, number | string>;
  total_score: number;
  student: { id: string; display_name: string };
};

const SNBT_FIELDS = [
  { key: 'pu',  label: 'PU' },
  { key: 'pk',  label: 'PK' },
  { key: 'ppu', label: 'PPU' },
  { key: 'pbm', label: 'PBM' },
  { key: 'lbi', label: 'LBI' },
  { key: 'lba', label: 'LBA' },
  { key: 'pm',  label: 'PM' },
];

const TKA_FIELDS = [
  { key: 'ind',    label: 'B. Indonesia' },
  { key: 'matwa',  label: 'Mat. Wajib' },
  { key: 'ing',    label: 'B. Inggris' },
  { key: 'fis',    label: 'Fisika' },
  { key: 'kim',    label: 'Kimia' },
  { key: 'bio',    label: 'Biologi' },
  { key: 'matlan', label: 'Mat. Lanjut' },
  { key: 'eko',    label: 'Ekonomi' },
  { key: 'sos',    label: 'Sosiologi' },
  { key: 'sej',    label: 'Sejarah' },
  { key: 'geo',    label: 'Geografi' },
  { key: 'indlan', label: 'B. Ind. Lanjut' },
  { key: 'inglan', label: 'B. Ing. Lanjut' },
];

const TYPE_FIELDS: Record<string, typeof SNBT_FIELDS> = {
  SNBT: SNBT_FIELDS,
  TKA:  TKA_FIELDS,
};

const TYPE_BG: Record<string, { bg: string; color: string }> = {
  SNBT: { bg: '#EFF6FF', color: '#1D4ED8' },
  TKA:  { bg: '#F0FDF4', color: '#15803D' },
};

function presentScores(scores: Record<string, number | string> | null, fields: typeof SNBT_FIELDS) {
  if (!scores) return [];
  return fields.filter(f => {
    const v = scores[f.key];
    return v !== undefined && v !== null && v !== '' && v !== '-' && !isNaN(Number(v));
  });
}

export default function StaffHasilTO() {
  const [results, setResults] = useState<TOResult[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('');
  const [filterSearch, setFilterSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<TOResult | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TOResult | null>(null);
  const [deleting, setDeleting] = useState(false);

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

  useEffect(() => {
    supabase.from('profiles').select('id, display_name, nama').eq('role', 'student').order('display_name')
      .then(({ data }) => setStudents((data ?? []) as Student[]));
  }, []);

  const displayed = results.filter(r => {
    if (filterType && r.type !== filterType) return false;
    if (filterSearch && !r.student?.display_name?.toLowerCase().includes(filterSearch.toLowerCase()) &&
        !r.nama_to.toLowerCase().includes(filterSearch.toLowerCase()) &&
        !(r.kode_to ?? '').toLowerCase().includes(filterSearch.toLowerCase())) return false;
    return true;
  });

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    await supabase.from('tryout_results').delete().eq('id', deleteTarget.id);
    setDeleting(false);
    setDeleteTarget(null);
    load();
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', margin: 0, color: '#0D0D0D' }}>Hasil Tryout</h1>
        <button onClick={() => { setEditing(null); setShowModal(true); }} style={btnPrimary}>+ Input TO</button>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <input
          value={filterSearch}
          onChange={e => setFilterSearch(e.target.value)}
          placeholder="Cari siswa, nama TO, atau kode..."
          style={{ ...inputStyle, minWidth: '200px', flex: 1 }}
        />
        <select value={filterType} onChange={e => setFilterType(e.target.value)} style={selectStyle}>
          <option value="">Semua Jenis</option>
          <option value="SNBT">SNBT</option>
          <option value="TKA">TKA</option>
        </select>
      </div>

      {loading ? (
        <p style={muted}>Memuat...</p>
      ) : displayed.length === 0 ? (
        <div style={emptyCard}><p style={{ fontFamily: 'var(--font-body)', color: '#666', margin: 0 }}>Belum ada data hasil TO.</p></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {displayed.map(r => {
            const typeInfo = TYPE_BG[r.type] ?? { bg: '#F3F2EE', color: '#666' };
            const fields = TYPE_FIELDS[r.type] ?? [];
            const present = presentScores(r.scores, fields);
            const dateLabel = r.tanggal_to
              ? new Date(r.tanggal_to + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
              : '-';

            return (
              <div key={r.id} style={card}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '3px' }}>
                      <span style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.9rem', color: '#0D0D0D' }}>{r.nama_to}</span>
                      {r.kode_to && (
                        <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.72rem', color: '#666', background: '#F3F2EE', padding: '1px 6px', borderRadius: '4px' }}>
                          #{r.kode_to}
                        </span>
                      )}
                      <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 700, background: typeInfo.bg, color: typeInfo.color }}>
                        {r.type}
                      </span>
                    </div>
                    <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: '#666', marginBottom: '6px' }}>
                      {r.student?.display_name ?? '-'} &mdash; {dateLabel}
                    </div>
                    {present.length > 0 && (
                      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        {present.map(f => (
                          <div key={f.key} style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: '#444' }}>
                            <span style={{ color: '#888' }}>{f.label}</span>{' '}
                            <span style={{ fontWeight: 700 }}>{Number(r.scores?.[f.key] ?? 0).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', color: '#0D5C3A', lineHeight: 1 }}>
                      {typeof r.total_score === 'number' ? r.total_score.toFixed(2) : '-'}
                    </div>
                    <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.72rem', color: '#888' }}>rata-rata</div>
                    <div style={{ display: 'flex', gap: '6px', marginTop: '8px', justifyContent: 'flex-end' }}>
                      <button onClick={() => { setEditing(r); setShowModal(true); }} style={editBtn}>Edit</button>
                      <button onClick={() => setDeleteTarget(r)} style={{ ...editBtn, color: '#DC0A1E', background: '#FFF0F1', borderColor: '#FECACA' }}>Hapus</button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <TOModal students={students} editing={editing} onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); load(); }} />
      )}

      {deleteTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px' }}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '28px 32px', maxWidth: '380px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', margin: '0 0 10px' }}>Hapus Hasil TO?</h2>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.88rem', color: '#666', margin: '0 0 20px' }}>
              Data TO <strong>{deleteTarget.nama_to}</strong> milik <strong>{deleteTarget.student?.display_name}</strong> akan dihapus permanen.
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setDeleteTarget(null)} style={btnSecondary}>Batal</button>
              <button onClick={confirmDelete} disabled={deleting} style={{ ...btnPrimary, background: '#DC0A1E' }}>
                {deleting ? 'Menghapus...' : 'Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TOModal({ students, editing, onClose, onSaved }: {
  students: Student[];
  editing: TOResult | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [type, setType] = useState<'SNBT' | 'TKA'>(
    editing?.type === 'TKA' ? 'TKA' : 'SNBT'
  );
  const [namaTO, setNamaTO] = useState(editing?.nama_to ?? '');
  const [kodeTO, setKodeTO] = useState(editing?.kode_to ?? '');
  const [tanggalTO, setTanggalTO] = useState(editing?.tanggal_to ?? new Date().toISOString().substring(0, 10));
  const [studentId, setStudentId] = useState(editing?.student_id ?? '');
  const [scores, setScores] = useState<Record<string, string>>(() => {
    if (editing?.scores) {
      return Object.fromEntries(
        Object.entries(editing.scores)
          .filter(([, v]) => v !== '-' && v !== null && v !== undefined)
          .map(([k, v]) => [k, String(v)])
      );
    }
    return {};
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [studentOpen, setStudentOpen] = useState(false);

  const fields = TYPE_FIELDS[type];
  const selectedStudent = students.find(s => s.id === studentId);
  const filteredStudents = students.filter(s =>
    s.display_name.toLowerCase().includes(studentSearch.toLowerCase()) ||
    (s.nama ?? '').toLowerCase().includes(studentSearch.toLowerCase())
  );

  function calcTotal(): number {
    const vals = fields.map(f => parseFloat(scores[f.key] ?? '')).filter(v => !isNaN(v) && v >= 0);
    if (vals.length === 0) return 0;
    return parseFloat((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(4));
  }

  async function handleSave() {
    setError('');
    if (!studentId) { setError('Pilih siswa terlebih dahulu'); return; }
    if (!namaTO.trim()) { setError('Nama TO harus diisi'); return; }
    if (!tanggalTO) { setError('Tanggal TO harus diisi'); return; }

    const scoresObj: Record<string, number> = {};
    for (const f of fields) {
      const val = parseFloat(scores[f.key] ?? '');
      if (!isNaN(val)) scoresObj[f.key] = val;
    }
    const total = calcTotal();

    setSaving(true);
    const payload = {
      type,
      nama_to: namaTO.trim(),
      kode_to: kodeTO.trim() || null,
      tanggal_to: tanggalTO,
      student_id: studentId,
      scores: scoresObj,
      total_score: total,
    };

    let err;
    if (editing) {
      const res = await supabase.from('tryout_results').update(payload).eq('id', editing.id);
      err = res.error;
    } else {
      const res = await supabase.from('tryout_results').insert({ ...payload, entered_by: user?.id });
      err = res.error;
    }
    setSaving(false);
    if (err) { setError(err.message); return; }
    onSaved();
  }

  const total = calcTotal();
  const presentCount = fields.filter(f => !isNaN(parseFloat(scores[f.key] ?? ''))).length;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, overflowY: 'auto', padding: '16px' }}>
      <div style={{ background: '#fff', borderRadius: '12px', padding: '28px', width: '100%', maxWidth: '560px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', maxHeight: '92vh', overflowY: 'auto' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', margin: '0 0 20px' }}>
          {editing ? 'Edit' : 'Input'} Hasil TO
        </h2>

        {/* Type */}
        <div style={{ marginBottom: '14px' }}>
          <label style={labelStyle}>Jenis TO</label>
          <div style={{ display: 'flex', gap: '10px' }}>
            {(['SNBT', 'TKA'] as const).map(k => (
              <label key={k} style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '0.88rem' }}>
                <input type="radio" name="type" value={k} checked={type === k} onChange={() => { setType(k); setScores({}); }} />
                {k}
              </label>
            ))}
          </div>
        </div>

        {/* Nama TO */}
        <div style={{ marginBottom: '14px' }}>
          <label style={labelStyle}>Nama TO</label>
          <input value={namaTO} onChange={e => setNamaTO(e.target.value)} placeholder="cth. TO UTBK 5 - Mei 2026" style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />
        </div>

        {/* Kode TO */}
        <div style={{ marginBottom: '14px' }}>
          <label style={labelStyle}>Kode TO <span style={{ fontWeight: 400, color: '#888' }}>(opsional, cth: 168)</span></label>
          <input value={kodeTO} onChange={e => setKodeTO(e.target.value)} placeholder="cth. 168" style={{ ...inputStyle, width: '180px', boxSizing: 'border-box' }} />
        </div>

        {/* Tanggal */}
        <div style={{ marginBottom: '14px' }}>
          <label style={labelStyle}>Tanggal TO</label>
          <input type="date" value={tanggalTO} onChange={e => setTanggalTO(e.target.value)} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />
        </div>

        {/* Siswa */}
        <div style={{ marginBottom: '14px', position: 'relative' }}>
          <label style={labelStyle}>Siswa</label>
          <input
            value={studentOpen ? studentSearch : (selectedStudent ? selectedStudent.display_name : '')}
            onChange={e => setStudentSearch(e.target.value)}
            onFocus={() => { setStudentOpen(true); setStudentSearch(''); }}
            onBlur={() => setTimeout(() => setStudentOpen(false), 150)}
            placeholder="Cari dan pilih siswa..."
            style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }}
          />
          {studentOpen && (
            <div style={{ position: 'absolute', top: 'calc(100% + 2px)', left: 0, right: 0, background: '#fff', border: '1.5px solid #E2E1DC', borderRadius: '8px', maxHeight: '180px', overflowY: 'auto', zIndex: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }}>
              {filteredStudents.length === 0 ? (
                <div style={{ padding: '10px 12px', fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#888' }}>Tidak ditemukan</div>
              ) : filteredStudents.map(s => (
                <div key={s.id} onMouseDown={() => { setStudentId(s.id); setStudentOpen(false); }}
                  style={{ padding: '9px 12px', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#0D0D0D', background: studentId === s.id ? '#F0F4FF' : 'transparent' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#F3F2EE')}
                  onMouseLeave={e => (e.currentTarget.style.background = studentId === s.id ? '#F0F4FF' : 'transparent')}>
                  {s.display_name}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Scores */}
        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>
            Skor {type}
            {type === 'TKA' && (
              <span style={{ fontWeight: 400, color: '#888', fontSize: '0.75rem', marginLeft: '6px' }}>
                (isi mapel yang diambil saja, kosongkan yang tidak)
              </span>
            )}
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '8px', marginTop: '6px' }}>
            {fields.map(f => (
              <div key={f.key}>
                <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.72rem', color: '#666', marginBottom: '3px' }}>{f.label}</div>
                <input
                  type="number"
                  value={scores[f.key] ?? ''}
                  onChange={e => setScores(prev => ({ ...prev, [f.key]: e.target.value }))}
                  placeholder={type === 'TKA' ? '-' : '0'}
                  style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }}
                />
              </div>
            ))}
          </div>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#0D5C3A', fontWeight: 600, marginTop: '8px' }}>
            Rata-rata ({presentCount} mapel): {total.toFixed(2)}
          </div>
        </div>

        {error && <p style={{ fontFamily: 'var(--font-body)', color: '#DC0A1E', fontSize: '0.85rem', margin: '0 0 12px' }}>{error}</p>}

        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={onClose} style={btnSecondary}>Batal</button>
          <button onClick={handleSave} disabled={saving} style={btnPrimary}>{saving ? 'Menyimpan...' : 'Simpan'}</button>
        </div>
      </div>
    </div>
  );
}

const muted: React.CSSProperties = { fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#666', margin: 0 };
const emptyCard: React.CSSProperties = { background: '#fff', border: '1px solid #E2E1DC', borderRadius: '10px', padding: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const card: React.CSSProperties = { background: '#fff', border: '1px solid #E2E1DC', borderRadius: '10px', padding: '16px' };
const inputStyle: React.CSSProperties = { padding: '9px 11px', border: '1.5px solid #E2E1DC', borderRadius: '8px', fontFamily: 'var(--font-body)', fontSize: '0.88rem', outline: 'none', color: '#0D0D0D', background: '#fff' };
const selectStyle: React.CSSProperties = { padding: '9px 12px', border: '1.5px solid #E2E1DC', borderRadius: '8px', fontFamily: 'var(--font-body)', fontSize: '0.85rem', background: '#fff', color: '#0D0D0D', outline: 'none', cursor: 'pointer' };
const labelStyle: React.CSSProperties = { fontFamily: 'var(--font-body)', fontSize: '0.82rem', fontWeight: 600, color: '#2E2E2E', display: 'block', marginBottom: '4px' };
const btnPrimary: React.CSSProperties = { flex: 1, padding: '10px', background: '#0D5C3A', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.88rem' };
const btnSecondary: React.CSSProperties = { flex: 1, padding: '10px', background: '#F3F2EE', color: '#2E2E2E', border: 'none', borderRadius: '8px', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.88rem' };
const editBtn: React.CSSProperties = { padding: '5px 12px', background: '#F3F2EE', color: '#0D0D0D', border: '1px solid #E2E1DC', borderRadius: '6px', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.78rem' };
