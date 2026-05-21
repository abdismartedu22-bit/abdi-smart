import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { getWeekStart, toISODate, fmtTime } from '../../lib/dates';
import { addDays } from 'date-fns';
import WeekPicker from '../../components/shared/WeekPicker';
import GrupBadge from '../../components/shared/GrupBadge';

type Group = { id: string; nama: string; kode: string; warna: string; warna_text: string };

type RealisasiRow = {
  id: string;
  session_date: string;
  status: string | null;
  sesi_status: string | null;
  note: string | null;
  catatan_admin: string | null;
  locked_at: string | null;
  checkin_at: string | null;
  schedule: {
    id: string;
    hari: string;
    jam_mulai: string;
    jam_selesai: string;
    materi: string | null;
    groups: Group;
    teacher: { id: string; display_name: string };
  };
};

const SESI_STATUS_LABELS: Record<string, { label: string; bg: string; color: string }> = {
  terlaksana: { label: 'TERLAKSANA', bg: '#DCFCE7', color: '#15803D' },
  tidak:      { label: 'TIDAK',      bg: '#FEE2E2', color: '#DC0A1E' },
  ditunda:    { label: 'DITUNDA',    bg: '#FEF9C3', color: '#A16207' },
};

export default function AdminRealisasi() {
  const [weekStart, setWeekStart] = useState<Date>(() => getWeekStart());
  const [rows, setRows] = useState<RealisasiRow[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterGroup, setFilterGroup] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [editing, setEditing] = useState<RealisasiRow | null>(null);

  const weekEnd = addDays(weekStart, 6);

  const load = useCallback(async () => {
    setLoading(true);
    const startISO = toISODate(weekStart);
    const endISO = toISODate(weekEnd);

    const { data } = await supabase
      .from('attendance')
      .select(`
        id, session_date, status, sesi_status, note, catatan_admin, locked_at, checkin_at,
        schedule:schedules!schedule_id(
          id, hari, jam_mulai, jam_selesai, materi,
          groups!group_id(id, nama, kode, warna, warna_text),
          teacher:profiles!teacher_id(id, display_name)
        )
      `)
      .eq('person_role', 'teacher')
      .gte('session_date', startISO)
      .lte('session_date', endISO)
      .order('session_date');

    setRows((data ?? []) as unknown as RealisasiRow[]);
    setLoading(false);
  }, [weekStart]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    supabase.from('groups').select('id, nama, kode, warna, warna_text').order('nama').then(({ data }) => {
      setGroups((data ?? []) as Group[]);
    });
  }, []);

  const displayed = rows.filter(r => {
    if (filterGroup && r.schedule?.groups?.id !== filterGroup) return false;
    if (filterStatus === 'belum' && r.sesi_status) return false;
    if (filterStatus && filterStatus !== 'belum' && r.sesi_status !== filterStatus) return false;
    return true;
  });

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', margin: 0, color: '#0D0D0D' }}>
          Realisasi Sesi
        </h1>
        <WeekPicker weekStart={weekStart} onChange={setWeekStart} />
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <select
          value={filterGroup}
          onChange={e => setFilterGroup(e.target.value)}
          style={selectStyle}
        >
          <option value="">Semua Grup</option>
          {groups.map(g => (
            <option key={g.id} value={g.id}>[{g.kode}] {g.nama}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          style={selectStyle}
        >
          <option value="">Semua Status</option>
          <option value="terlaksana">Terlaksana</option>
          <option value="tidak">Tidak</option>
          <option value="ditunda">Ditunda</option>
          <option value="belum">Belum diisi</option>
        </select>
      </div>

      {loading ? (
        <p style={muted}>Memuat...</p>
      ) : displayed.length === 0 ? (
        <div style={emptyCard}>
          <p style={{ fontFamily: 'var(--font-body)', color: '#666', margin: 0 }}>
            Tidak ada data realisasi untuk filter ini.
          </p>
        </div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #E2E1DC', borderRadius: '10px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-body)', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: '#F9F9F7', borderBottom: '1px solid #E2E1DC' }}>
                <th style={th}>Tanggal</th>
                <th style={th}>Grup</th>
                <th style={th}>Materi</th>
                <th style={th}>Pengajar</th>
                <th style={th}>Status Sesi</th>
                <th style={th}>Catatan</th>
                <th style={th}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {displayed.map((r, i) => {
                const sched = r.schedule;
                const statusInfo = r.sesi_status ? SESI_STATUS_LABELS[r.sesi_status] : null;
                const dateObj = new Date(r.session_date + 'T00:00:00');
                const dateLabel = dateObj.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' });

                return (
                  <tr key={r.id} style={{ borderBottom: i < displayed.length - 1 ? '1px solid #F3F2EE' : 'none' }}>
                    <td style={td}><span style={{ color: '#0D0D0D', fontWeight: 500 }}>{dateLabel}</span></td>
                    <td style={td}>
                      {sched?.groups && (
                        <GrupBadge kode={sched.groups.kode} warna={sched.groups.warna} warna_text={sched.groups.warna_text} />
                      )}
                    </td>
                    <td style={td}>
                      <div style={{ color: '#0D0D0D' }}>{sched?.materi ?? '-'}</div>
                      <div style={{ color: '#888', fontSize: '0.78rem' }}>{sched ? `${fmtTime(sched.jam_mulai)}-${fmtTime(sched.jam_selesai)}` : ''}</div>
                    </td>
                    <td style={td}><span style={{ color: '#0D0D0D' }}>{sched?.teacher?.display_name ?? '-'}</span></td>
                    <td style={td}>
                      {statusInfo ? (
                        <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 700, background: statusInfo.bg, color: statusInfo.color }}>
                          {statusInfo.label}
                        </span>
                      ) : (
                        <span style={{ color: '#999', fontSize: '0.8rem' }}>--</span>
                      )}
                    </td>
                    <td style={td}>
                      <div style={{ color: '#555', maxWidth: '160px' }}>
                        {r.catatan_admin && <div style={{ color: '#0F1F6B', fontSize: '0.78rem', marginBottom: '2px' }}>Admin: {r.catatan_admin}</div>}
                        {r.note && <div style={{ color: '#666', fontSize: '0.78rem' }}>Pengajar: {r.note}</div>}
                        {!r.catatan_admin && !r.note && <span style={{ color: '#999' }}>-</span>}
                      </div>
                    </td>
                    <td style={td}>
                      <button onClick={() => setEditing(r)} style={editBtn}>Edit</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <EditModal
          row={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

function EditModal({ row, onClose, onSaved }: { row: RealisasiRow; onClose: () => void; onSaved: () => void }) {
  const sched = row.schedule;
  const dateObj = new Date(row.session_date + 'T00:00:00');
  const dateLabel = dateObj.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' });

  const [sesiStatus, setSesiStatus] = useState<string>(row.sesi_status ?? 'terlaksana');
  const [catatanAdmin, setCatatanAdmin] = useState(row.catatan_admin ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    setSaving(true);
    setError('');
    const { error: err } = await supabase
      .from('attendance')
      .update({ sesi_status: sesiStatus, catatan_admin: catatanAdmin || null })
      .eq('id', row.id);
    setSaving(false);
    if (err) { setError(err.message); return; }
    onSaved();
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div style={{ background: '#fff', borderRadius: '12px', padding: '28px', width: '100%', maxWidth: '440px', margin: '16px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', margin: '0 0 4px' }}>Edit Realisasi</h2>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.83rem', color: '#666', margin: '0 0 20px' }}>
          {dateLabel} &mdash; {sched?.groups?.nama} &mdash; {sched?.materi ?? 'tanpa materi'}
        </p>

        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>Status Sesi</label>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '6px' }}>
            {(['terlaksana', 'tidak', 'ditunda'] as const).map(s => (
              <label key={s} style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '0.88rem' }}>
                <input type="radio" name="sesi_status" value={s} checked={sesiStatus === s} onChange={() => setSesiStatus(s)} />
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </label>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={labelStyle}>Catatan Admin</label>
          <textarea
            value={catatanAdmin}
            onChange={e => setCatatanAdmin(e.target.value)}
            placeholder="Catatan override admin (opsional)"
            rows={3}
            style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', resize: 'vertical' }}
          />
          {row.note && (
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: '#666', margin: '4px 0 0' }}>
              Catatan pengajar: {row.note}
            </p>
          )}
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
const th: React.CSSProperties = {
  padding: '10px 14px', textAlign: 'left', fontFamily: 'var(--font-body)',
  fontSize: '0.75rem', fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '0.04em',
};
const td: React.CSSProperties = { padding: '12px 14px', verticalAlign: 'middle' };
const selectStyle: React.CSSProperties = {
  padding: '8px 12px', border: '1.5px solid #E2E1DC', borderRadius: '8px',
  fontFamily: 'var(--font-body)', fontSize: '0.85rem', background: '#fff', color: '#0D0D0D', outline: 'none', cursor: 'pointer',
};
const editBtn: React.CSSProperties = {
  padding: '5px 12px', background: '#0F1F6B', color: '#fff',
  border: 'none', borderRadius: '6px', cursor: 'pointer',
  fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.8rem',
};
const labelStyle: React.CSSProperties = {
  fontFamily: 'var(--font-body)', fontSize: '0.82rem', fontWeight: 600, color: '#2E2E2E',
  display: 'block', marginBottom: '4px',
};
const inputStyle: React.CSSProperties = {
  padding: '9px 11px', border: '1.5px solid #E2E1DC', borderRadius: '8px',
  fontFamily: 'var(--font-body)', fontSize: '0.88rem', outline: 'none',
  color: '#0D0D0D', background: '#fff',
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
