import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

type Student = { id: string; display_name: string; nama: string };

type TOResult = {
  id: string;
  student_id: string;
  type: string;
  nama_to: string;
  tanggal_to: string;
  scores: Record<string, number>;
  total_score: number;
  student: { id: string; display_name: string };
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

const TYPE_BG: Record<string, { bg: string; color: string }> = {
  SNBT: { bg: '#EFF6FF', color: '#1D4ED8' },
  'TKA-Saintek': { bg: '#F0FDF4', color: '#15803D' },
  'TKA-Soshum': { bg: '#FFF7ED', color: '#C2410C' },
};

export default function StaffHasilTO() {
  const [results, setResults] = useState<TOResult[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('');
  const [filterSearch, setFilterSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<TOResult | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('tryout_results')
      .select('id, student_id, type, nama_to, tanggal_to, scores, total_score, student:profiles!student_id(id, display_name)')
      .order('tanggal_to', { ascending: false });
    setResults((data ?? []) as unknown as TOResult[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    supabase
      .from('profiles')
      .select('id, display_name, nama')
      .eq('role', 'student')
      .order('display_name')
      .then(({ data }) => setStudents((data ?? []) as Student[]));
  }, []);

  const displayed = results.filter(r => {
    if (filterType && r.type !== filterType) return false;
    if (filterSearch && !r.student?.display_name?.toLowerCase().includes(filterSearch.toLowerCase()) &&
        !r.nama_to.toLowerCase().includes(filterSearch.toLowerCase())) return false;
    return true;
  });

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', margin: 0, color: '#0D0D0D' }}>
          Hasil Tryout
        </h1>
        <button onClick={() => { setEditing(null); setShowModal(true); }} style={btnPrimary}>
          + Input TO
        </button>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <input
          value={filterSearch}
          onChange={e => setFilterSearch(e.target.value)}
          placeholder="Cari siswa atau nama TO..."
          style={{ ...inputStyle, minWidth: '200px', flex: 1 }}
        />
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
          <p style={{ fontFamily: 'var(--font-body)', color: '#666', margin: 0 }}>Belum ada data hasil TO.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {displayed.map(r => {
            const typeInfo = TYPE_BG[r.type] ?? { bg: '#F3F2EE', color: '#666' };
            const fields = TYPE_FIELDS[r.type] ?? [];
            const dateLabel = new Date(r.tanggal_to + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

            return (
              <div key={r.id} style={card}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                      <span style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.9rem', color: '#0D0D0D' }}>{r.nama_to}</span>
                      <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 700, background: typeInfo.bg, color: typeInfo.color }}>
                        {TYPE_LABELS[r.type] ?? r.type}
                      </span>
                    </div>
                    <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: '#666' }}>
                      {r.student?.display_name ?? '-'} &mdash; {dateLabel}
                    </div>
                    <div style={{ marginTop: '8px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                      {fields.map(f => (
                        <div key={f.key} style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: '#444' }}>
                          <span style={{ color: '#888' }}>{f.label}</span> {r.scores?.[f.key] ?? '-'}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', color: '#0F1F6B', lineHeight: 1 }}>
                      {typeof r.total_score === 'number' ? r.total_score.toFixed(2) : '-'}
                    </div>
                    <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.72rem', color: '#888' }}>total</div>
                    <button
                      onClick={() => { setEditing(r); setShowModal(true); }}
                      style={{ ...editBtn, marginTop: '8px' }}
                    >
                      Edit
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <TOModal
          students={students}
          editing={editing}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load(); }}
        />
      )}
    </div>
  );
}

function TOModal({
  students, editing, onClose, onSaved,
}: {
  students: Student[];
  editing: TOResult | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [type, setType] = useState<string>(editing?.type ?? 'SNBT');
  const [namaTO, setNamaTO] = useState(editing?.nama_to ?? '');
  const [tanggalTO, setTanggalTO] = useState(editing?.tanggal_to ?? new Date().toISOString().substring(0, 10));
  const [studentId, setStudentId] = useState(editing?.student_id ?? '');
  const [scores, setScores] = useState<Record<string, string>>(() => {
    if (editing?.scores) {
      return Object.fromEntries(Object.entries(editing.scores).map(([k, v]) => [k, String(v)]));
    }
    return {};
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [studentOpen, setStudentOpen] = useState(false);

  const fields = TYPE_FIELDS[type] ?? [];
  const selectedStudent = students.find(s => s.id === studentId);
  const filteredStudents = students.filter(s =>
    s.display_name.toLowerCase().includes(studentSearch.toLowerCase()) ||
    s.nama?.toLowerCase().includes(studentSearch.toLowerCase())
  );

  function calcTotal(): number {
    const vals = fields.map(f => parseFloat(scores[f.key] || '0')).filter(n => !isNaN(n));
    if (vals.length === 0) return 0;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }

  async function handleSave() {
    setError('');
    if (!studentId) { setError('Pilih siswa terlebih dahulu'); return; }
    if (!namaTO.trim()) { setError('Nama TO harus diisi'); return; }
    if (!tanggalTO) { setError('Tanggal TO harus diisi'); return; }

    const scoresObj: Record<string, number> = {};
    for (const f of fields) {
      const val = parseFloat(scores[f.key] || '0');
      scoresObj[f.key] = isNaN(val) ? 0 : val;
    }
    const total = calcTotal();

    setSaving(true);
    let err;
    if (editing) {
      const res = await supabase.from('tryout_results').update({
        type, nama_to: namaTO.trim(), tanggal_to: tanggalTO,
        student_id: studentId, scores: scoresObj, total_score: total,
      }).eq('id', editing.id);
      err = res.error;
    } else {
      const res = await supabase.from('tryout_results').insert({
        type, nama_to: namaTO.trim(), tanggal_to: tanggalTO,
        student_id: studentId, scores: scoresObj, total_score: total,
        entered_by: user?.id,
      });
      err = res.error;
    }
    setSaving(false);
    if (err) { setError(err.message); return; }
    onSaved();
  }

  const total = calcTotal();

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, overflowY: 'auto', padding: '16px' }}>
      <div style={{ background: '#fff', borderRadius: '12px', padding: '28px', width: '100%', maxWidth: '520px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', margin: '0 0 20px' }}>
          {editing ? 'Edit' : 'Input'} Hasil TO
        </h2>

        {/* Type */}
        <div style={{ marginBottom: '14px' }}>
          <label style={labelStyle}>Jenis TO</label>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {Object.entries(TYPE_LABELS).map(([k, v]) => (
              <label key={k} style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '0.88rem' }}>
                <input type="radio" name="type" value={k} checked={type === k} onChange={() => { setType(k); setScores({}); }} />
                {v}
              </label>
            ))}
          </div>
        </div>

        {/* Nama TO */}
        <div style={{ marginBottom: '14px' }}>
          <label style={labelStyle}>Nama TO</label>
          <input value={namaTO} onChange={e => setNamaTO(e.target.value)} placeholder="cth. TO UTBK 5 - Mei 2026" style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />
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
                <div
                  key={s.id}
                  onMouseDown={() => { setStudentId(s.id); setStudentOpen(false); }}
                  style={{ padding: '9px 12px', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#0D0D0D', background: studentId === s.id ? '#F0F4FF' : 'transparent' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#F3F2EE')}
                  onMouseLeave={e => (e.currentTarget.style.background = studentId === s.id ? '#F0F4FF' : 'transparent')}
                >
                  {s.display_name}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Scores */}
        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>Skor {TYPE_LABELS[type]}</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '8px', marginTop: '6px' }}>
            {fields.map(f => (
              <div key={f.key}>
                <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: '#666', marginBottom: '3px' }}>{f.label}</div>
                <input
                  type="number"
                  value={scores[f.key] ?? ''}
                  onChange={e => setScores(prev => ({ ...prev, [f.key]: e.target.value }))}
                  placeholder="0"
                  style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }}
                />
              </div>
            ))}
          </div>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#0F1F6B', fontWeight: 600, marginTop: '8px' }}>
            Total (rata-rata): {total.toFixed(2)}
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
const emptyCard: React.CSSProperties = {
  background: '#fff', border: '1px solid #E2E1DC', borderRadius: '10px', padding: '40px',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
const card: React.CSSProperties = {
  background: '#fff', border: '1px solid #E2E1DC', borderRadius: '10px', padding: '16px',
};
const inputStyle: React.CSSProperties = {
  padding: '9px 11px', border: '1.5px solid #E2E1DC', borderRadius: '8px',
  fontFamily: 'var(--font-body)', fontSize: '0.88rem', outline: 'none',
  color: '#0D0D0D', background: '#fff',
};
const selectStyle: React.CSSProperties = {
  padding: '9px 12px', border: '1.5px solid #E2E1DC', borderRadius: '8px',
  fontFamily: 'var(--font-body)', fontSize: '0.85rem', background: '#fff', color: '#0D0D0D', outline: 'none', cursor: 'pointer',
};
const labelStyle: React.CSSProperties = {
  fontFamily: 'var(--font-body)', fontSize: '0.82rem', fontWeight: 600, color: '#2E2E2E',
  display: 'block', marginBottom: '4px',
};
const btnPrimary: React.CSSProperties = {
  flex: 1, padding: '10px', background: '#0F1F6B', color: '#fff',
  border: 'none', borderRadius: '8px', cursor: 'pointer',
  fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.88rem',
};
const btnSecondary: React.CSSProperties = {
  flex: 1, padding: '10px', background: '#F3F2EE', color: '#2E2E2E',
  border: 'none', borderRadius: '8px', cursor: 'pointer',
  fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.88rem',
};
const editBtn: React.CSSProperties = {
  padding: '5px 14px', background: '#F3F2EE', color: '#0D0D0D',
  border: '1px solid #E2E1DC', borderRadius: '6px', cursor: 'pointer',
  fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.8rem',
};
