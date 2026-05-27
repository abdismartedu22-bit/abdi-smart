import { useState, useEffect, useCallback, FormEvent } from 'react';
import { supabase } from '../../lib/supabase';
import { getWeekStart, toISODate, fmtTime, fmtTimestampWITA, nowWITAMinutes } from '../../lib/dates';
import { addDays } from 'date-fns';
import WeekPicker from '../../components/shared/WeekPicker';
import GrupBadge from '../../components/shared/GrupBadge';

type Group = { id: string; nama: string; kode: string; warna: string; warna_text: string };

/* ---- Realisasi Sesi types ---- */

type ScheduleRow = {
  id: string;
  hari: string;
  jam_mulai: string;
  jam_selesai: string;
  materi: string | null;
  lokasi: string | null;
  week_start: string;
  groups: Group;
  teacher: { id: string; display_name: string };
};

type TeacherAttRow = {
  id: string;
  schedule_id: string;
  session_date: string;
  sesi_status: string | null;
  note: string | null;
  catatan_admin: string | null;
  locked_at: string | null;
  checkin_at: string | null;
};

type MergedRow = {
  schedule: ScheduleRow;
  att: TeacherAttRow | null;
  session_date: string;
};

/* ---- Absensi Siswa types ---- */

type StudentAttRow = {
  id: string;
  session_date: string;
  status: string | null;
  note: string | null;
  catatan_admin: string | null;
  checkin_at: string | null;
  locked_at: string | null;
  person: { id: string; display_name: string };
  schedule: {
    hari: string;
    jam_mulai: string;
    jam_selesai: string;
    materi: string | null;
    groups: Group;
  };
};

/* ---- Helpers ---- */

const HARI_IDX: Record<string, number> = {
  Senin: 0, Selasa: 1, Rabu: 2, Kamis: 3, Jumat: 4, Sabtu: 5, Minggu: 6,
};

function getSessionDate(weekStartISO: string, hari: string): string {
  const [y, mo, d] = weekStartISO.split('-').map(Number);
  const date = new Date(y, mo - 1, d + (HARI_IDX[hari] ?? 0));
  return toISODate(date);
}

function todayWITA(): string {
  const now = new Date();
  return new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function hasPassed(sessionDateISO: string, jamSelesai: string): boolean {
  const today = todayWITA();
  if (sessionDateISO < today) return true;
  if (sessionDateISO > today) return false;
  const [h, m] = jamSelesai.split(':').map(Number);
  return nowWITAMinutes() > h * 60 + m;
}

const SESI_STATUS_LABELS: Record<string, { label: string; bg: string; color: string }> = {
  terlaksana: { label: 'TERLAKSANA', bg: '#DCFCE7', color: '#15803D' },
  tidak:      { label: 'TIDAK',      bg: '#FEE2E2', color: '#DC0A1E' },
  ditunda:    { label: 'DITUNDA',    bg: '#FEF9C3', color: '#A16207' },
};

const STATUS_LABELS: Record<string, { label: string; bg: string; color: string }> = {
  hadir: { label: 'HADIR', bg: '#DCFCE7', color: '#15803D' },
  absen: { label: 'ABSEN', bg: '#FEE2E2', color: '#DC0A1E' },
  izin:  { label: 'IZIN',  bg: '#FEF9C3', color: '#A16207' },
};

type Tab = 'realisasi' | 'siswa';

export default function AdminRealisasi() {
  const [tab, setTab] = useState<Tab>('realisasi');

  return (
    <div>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', margin: '0 0 20px', color: '#0D0D0D' }}>
        Realisasi &amp; Absensi
      </h1>

      <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', borderBottom: '2px solid #E2E1DC' }}>
        {(['realisasi', 'siswa'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '8px 20px',
              fontFamily: 'var(--font-body)',
              fontWeight: 600,
              fontSize: '0.88rem',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              color: tab === t ? '#0F1F6B' : '#666',
              borderBottom: tab === t ? '2px solid #0F1F6B' : '2px solid transparent',
              marginBottom: '-2px',
            }}
          >
            {t === 'realisasi' ? 'Realisasi Sesi' : 'Absensi Siswa'}
          </button>
        ))}
      </div>

      {tab === 'realisasi' ? <RealisasiSesiTab /> : <AbsensiSiswaTab />}
    </div>
  );
}

/* ===================== REALISASI SESI TAB ===================== */

function getWeekStartForDate(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return toISODate(d);
}

function getHariForDate(date: Date): string {
  return ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][date.getDay()];
}

function RealisasiSesiTab() {
  const todayISO = toISODate(new Date());
  const [dateFilter, setDateFilter] = useState(todayISO);
  const [rows, setRows] = useState<MergedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [editing, setEditing] = useState<MergedRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const selectedDate = new Date(dateFilter + 'T00:00:00');
    const weekStartISO = getWeekStartForDate(selectedDate);
    const hariTarget = getHariForDate(selectedDate);

    const [{ data: schedData }, { data: attData }] = await Promise.all([
      supabase
        .from('schedules')
        .select('id, hari, jam_mulai, jam_selesai, materi, lokasi, week_start, groups!group_id(id,nama,kode,warna,warna_text), teacher:profiles!teacher_id(id,display_name)')
        .eq('week_start', weekStartISO)
        .eq('hari', hariTarget)
        .order('jam_mulai'),
      supabase
        .from('attendance')
        .select('id, schedule_id, session_date, sesi_status, note, catatan_admin, locked_at, checkin_at')
        .eq('person_role', 'teacher')
        .eq('session_date', dateFilter),
    ]);

    const attMap: Record<string, TeacherAttRow> = {};
    (attData ?? []).forEach((r: any) => { attMap[r.schedule_id] = r as TeacherAttRow; });

    const schedules = (schedData ?? []) as unknown as ScheduleRow[];
    const merged: MergedRow[] = schedules
      .filter(s => hasPassed(dateFilter, s.jam_selesai))
      .map(s => ({ schedule: s, att: attMap[s.id] ?? null, session_date: dateFilter }));

    merged.sort((a, b) => a.schedule.jam_mulai < b.schedule.jam_mulai ? -1 : 1);
    setRows(merged);
    setLoading(false);
  }, [dateFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const displayed = rows.filter(r => {
    const isBelum = r.att === null || r.att.sesi_status === null;
    if (filterStatus === 'belum' && !isBelum) return false;
    if (filterStatus && filterStatus !== 'belum' && r.att?.sesi_status !== filterStatus) return false;
    return true;
  });

  const belumCount = rows.filter(r => r.att === null || r.att.sesi_status === null).length;
  const dateObj = new Date(dateFilter + 'T00:00:00');
  const dateLabel = dateObj.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', fontWeight: 600, color: '#2E2E2E' }}>Tanggal</label>
          <input
            type="date"
            value={dateFilter}
            onChange={e => setDateFilter(e.target.value)}
            style={selectStyle}
          />
        </div>
        <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#666' }}>{dateLabel}</span>
        {!loading && belumCount > 0 && (
          <span style={{ padding: '3px 10px', borderRadius: '6px', fontFamily: 'var(--font-body)', fontSize: '0.78rem', fontWeight: 700, background: '#FEF9C3', color: '#A16207' }}>
            {belumCount} belum diisi
          </span>
        )}
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={selectStyle}>
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
            {rows.length === 0 ? 'Tidak ada sesi yang sudah selesai minggu ini.' : 'Tidak ada data untuk filter ini.'}
          </p>
        </div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #E2E1DC', borderRadius: '10px', overflow: 'auto' }}>
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
                const s = r.schedule;
                const isBelum = r.att === null || r.att.sesi_status === null;
                const statusInfo = r.att?.sesi_status ? SESI_STATUS_LABELS[r.att.sesi_status] : null;
                const dateObj = new Date(r.session_date + 'T00:00:00');
                const dateLabel = dateObj.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' });

                return (
                  <tr key={`${s.id}-${r.session_date}`} style={{ borderBottom: i < displayed.length - 1 ? '1px solid #F3F2EE' : 'none' }}>
                    <td style={td}><span style={{ color: '#0D0D0D', fontWeight: 500, whiteSpace: 'nowrap' }}>{dateLabel}</span></td>
                    <td style={td}>
                      {s.groups && <GrupBadge kode={s.groups.kode} warna={s.groups.warna} warna_text={s.groups.warna_text} />}
                    </td>
                    <td style={td}>
                      <div style={{ color: '#0D0D0D' }}>{s.materi ?? '-'}</div>
                      <div style={{ color: '#888', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                        {fmtTime(s.jam_mulai)}-{fmtTime(s.jam_selesai)} WITA
                      </div>
                    </td>
                    <td style={td}><span style={{ color: '#0D0D0D' }}>{s.teacher?.display_name ?? '-'}</span></td>
                    <td style={td}>
                      {isBelum ? (
                        <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 700, background: '#FEF9C3', color: '#A16207' }}>
                          BELUM DIISI
                        </span>
                      ) : statusInfo ? (
                        <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 700, background: statusInfo.bg, color: statusInfo.color }}>
                          {statusInfo.label}
                        </span>
                      ) : null}
                    </td>
                    <td style={td}>
                      <div style={{ color: '#555', maxWidth: '160px' }}>
                        {r.att?.catatan_admin && <div style={{ color: '#0F1F6B', fontSize: '0.78rem', marginBottom: '2px' }}>Admin: {r.att.catatan_admin}</div>}
                        {r.att?.note && <div style={{ color: '#666', fontSize: '0.78rem' }}>Pengajar: {r.att.note}</div>}
                        {!r.att?.catatan_admin && !r.att?.note && <span style={{ color: '#999' }}>-</span>}
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
        <RealisasiEditModal
          row={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

function RealisasiEditModal({ row, onClose, onSaved }: { row: MergedRow; onClose: () => void; onSaved: () => void }) {
  const s = row.schedule;
  const dateObj = new Date(row.session_date + 'T00:00:00');
  const dateLabel = dateObj.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' });

  const [sesiStatus, setSesiStatus] = useState<string>(row.att?.sesi_status ?? 'terlaksana');
  const [catatanAdmin, setCatatanAdmin] = useState(row.att?.catatan_admin ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    setSaving(true);
    setError('');

    let err;
    if (row.att) {
      // Update existing teacher row
      ({ error: err } = await supabase
        .from('attendance')
        .update({ sesi_status: sesiStatus, catatan_admin: catatanAdmin || null })
        .eq('id', row.att.id));
    } else {
      // No teacher row yet -- admin creates one on behalf
      ({ error: err } = await supabase
        .from('attendance')
        .insert({
          schedule_id: s.id,
          session_date: row.session_date,
          person_id: s.teacher.id,
          person_role: 'teacher',
          sesi_status: sesiStatus,
          catatan_admin: catatanAdmin || null,
        }));
    }

    setSaving(false);
    if (err) { setError(err.message); return; }
    onSaved();
  }

  return (
    <Overlay>
      <div style={modalStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', margin: 0 }}>Edit Realisasi</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', color: '#666' }}>&#x2715;</button>
        </div>

        <div style={{ background: '#F9F9F7', borderRadius: '8px', padding: '10px 14px', marginBottom: '20px' }}>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#0D0D0D', fontWeight: 600 }}>
            {s.groups?.nama} &mdash; {s.materi ?? 'tanpa materi'}
          </div>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: '#666' }}>
            {dateLabel} &mdash; {fmtTime(s.jam_mulai)}&ndash;{fmtTime(s.jam_selesai)} WITA
          </div>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: '#666' }}>
            Pengajar: {s.teacher?.display_name}
          </div>
          {row.att?.checkin_at && (
            <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: '#047857', marginTop: '4px' }}>
              Pengajar hadir: {fmtTimestampWITA(row.att.checkin_at, 'time')}
            </div>
          )}
        </div>

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
          {row.att?.note && (
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: '#666', margin: '4px 0 0' }}>
              Catatan pengajar: {row.att.note}
            </p>
          )}
        </div>

        {error && <p style={{ fontFamily: 'var(--font-body)', color: '#DC0A1E', fontSize: '0.85rem', margin: '0 0 12px' }}>{error}</p>}

        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={onClose} style={btnSecondary}>Batal</button>
          <button onClick={handleSave} disabled={saving} style={btnPrimary}>{saving ? 'Menyimpan...' : 'Simpan'}</button>
        </div>
      </div>
    </Overlay>
  );
}

/* ===================== ABSENSI SISWA TAB ===================== */

function AbsensiSiswaTab() {
  const [weekStart, setWeekStart] = useState<Date>(() => getWeekStart());
  const [rows, setRows] = useState<StudentAttRow[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterGroup, setFilterGroup] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<StudentAttRow | null>(null);

  const weekEnd = addDays(weekStart, 6);

  const load = useCallback(async () => {
    setLoading(true);
    const startISO = toISODate(weekStart);
    const endISO = toISODate(weekEnd);

    const { data } = await supabase
      .from('attendance')
      .select(`
        id, session_date, status, note, catatan_admin, checkin_at, locked_at,
        person:profiles!person_id(id, display_name),
        schedule:schedules!schedule_id(
          hari, jam_mulai, jam_selesai, materi,
          groups!group_id(id, nama, kode, warna, warna_text)
        )
      `)
      .eq('person_role', 'student')
      .gte('session_date', startISO)
      .lte('session_date', endISO)
      .order('session_date');

    setRows((data ?? []) as unknown as StudentAttRow[]);
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
    if (filterStatus === 'belum' && r.status) return false;
    if (filterStatus && filterStatus !== 'belum' && r.status !== filterStatus) return false;
    if (search && !r.person?.display_name?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const summary = {
    hadir: displayed.filter(r => r.status === 'hadir').length,
    absen: displayed.filter(r => r.status === 'absen').length,
    izin:  displayed.filter(r => r.status === 'izin').length,
    belum: displayed.filter(r => !r.status).length,
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <WeekPicker weekStart={weekStart} onChange={setWeekStart} />
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Cari nama siswa..."
          style={{ ...selectStyle, minWidth: '180px' }}
        />
        <select value={filterGroup} onChange={e => setFilterGroup(e.target.value)} style={selectStyle}>
          <option value="">Semua Grup</option>
          {groups.map(g => <option key={g.id} value={g.id}>[{g.kode}] {g.nama}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={selectStyle}>
          <option value="">Semua Status</option>
          <option value="hadir">Hadir</option>
          <option value="absen">Absen</option>
          <option value="izin">Izin</option>
          <option value="belum">Belum dikunci</option>
        </select>
      </div>

      {!loading && displayed.length > 0 && (
        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
          {[
            { label: 'hadir', val: summary.hadir, color: '#15803D', bg: '#DCFCE7' },
            { label: 'absen', val: summary.absen, color: '#DC0A1E', bg: '#FEE2E2' },
            { label: 'izin',  val: summary.izin,  color: '#A16207', bg: '#FEF9C3' },
            { label: 'belum dikunci', val: summary.belum, color: '#666', bg: '#F3F2EE' },
          ].map(c => (
            <span key={c.label} style={{ padding: '3px 10px', borderRadius: '6px', fontFamily: 'var(--font-body)', fontSize: '0.78rem', fontWeight: 700, background: c.bg, color: c.color }}>
              {c.val} {c.label}
            </span>
          ))}
        </div>
      )}

      {loading ? (
        <p style={muted}>Memuat...</p>
      ) : displayed.length === 0 ? (
        <div style={emptyCard}>
          <p style={{ fontFamily: 'var(--font-body)', color: '#666', margin: 0 }}>Tidak ada data absensi untuk filter ini.</p>
        </div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #E2E1DC', borderRadius: '10px', overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-body)', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: '#F9F9F7', borderBottom: '1px solid #E2E1DC' }}>
                <th style={th}>Tanggal</th>
                <th style={th}>Siswa</th>
                <th style={th}>Grup</th>
                <th style={th}>Sesi</th>
                <th style={th}>Check-in</th>
                <th style={th}>Status</th>
                <th style={th}>Catatan</th>
                <th style={th}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {displayed.map((r, i) => {
                const si = r.status ? STATUS_LABELS[r.status] : null;
                const dateObj = new Date(r.session_date + 'T00:00:00');
                const dateLabel = dateObj.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' });

                return (
                  <tr key={r.id} style={{ borderBottom: i < displayed.length - 1 ? '1px solid #F3F2EE' : 'none' }}>
                    <td style={td}>
                      <span style={{ color: '#0D0D0D', fontWeight: 500, whiteSpace: 'nowrap' }}>{dateLabel}</span>
                    </td>
                    <td style={td}>
                      <span style={{ color: '#0D0D0D', fontWeight: 600 }}>{r.person?.display_name ?? '-'}</span>
                    </td>
                    <td style={td}>
                      {r.schedule?.groups && (
                        <GrupBadge kode={r.schedule.groups.kode} warna={r.schedule.groups.warna} warna_text={r.schedule.groups.warna_text} />
                      )}
                    </td>
                    <td style={td}>
                      <div style={{ color: '#0D0D0D' }}>{r.schedule?.materi ?? '-'}</div>
                      <div style={{ color: '#888', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                        {r.schedule ? `${fmtTime(r.schedule.jam_mulai)}-${fmtTime(r.schedule.jam_selesai)} WITA` : ''}
                      </div>
                    </td>
                    <td style={td}>
                      {r.checkin_at ? (
                        <span style={{ color: '#047857', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                          {fmtTimestampWITA(r.checkin_at, 'time')}
                        </span>
                      ) : (
                        <span style={{ color: '#999', fontSize: '0.82rem' }}>-</span>
                      )}
                    </td>
                    <td style={td}>
                      {si ? (
                        <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 700, background: si.bg, color: si.color, whiteSpace: 'nowrap' }}>
                          {si.label}
                        </span>
                      ) : (
                        <span style={{ color: '#999', fontSize: '0.8rem' }}>
                          {r.locked_at ? 'terkunci' : '--'}
                        </span>
                      )}
                    </td>
                    <td style={td}>
                      <div style={{ maxWidth: '140px' }}>
                        {r.catatan_admin && <div style={{ color: '#0F1F6B', fontSize: '0.75rem', marginBottom: '1px' }}>Admin: {r.catatan_admin}</div>}
                        {r.note && <div style={{ color: '#666', fontSize: '0.75rem' }}>{r.note}</div>}
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
        <StudentAttEditModal
          row={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

function StudentAttEditModal({ row, onClose, onSaved }: { row: StudentAttRow; onClose: () => void; onSaved: () => void }) {
  const dateObj = new Date(row.session_date + 'T00:00:00');
  const dateLabel = dateObj.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const [status, setStatus] = useState<string>(row.status ?? 'absen');
  const [note, setNote] = useState(row.note ?? '');
  const [catatanAdmin, setCatatanAdmin] = useState(row.catatan_admin ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    const { error: err } = await supabase
      .from('attendance')
      .update({ status, note: note || null, catatan_admin: catatanAdmin || null })
      .eq('id', row.id);
    setSaving(false);
    if (err) { setError(err.message); return; }
    onSaved();
  }

  return (
    <Overlay>
      <div style={modalStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', margin: 0 }}>Edit Absensi Siswa</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', color: '#666' }}>&#x2715;</button>
        </div>

        <div style={{ background: '#F9F9F7', borderRadius: '8px', padding: '12px 14px', marginBottom: '20px' }}>
          <div style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.9rem', color: '#0D0D0D', marginBottom: '2px' }}>
            {row.person?.display_name}
          </div>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: '#666' }}>{dateLabel}</div>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: '#666' }}>
            {row.schedule?.groups?.nama} &mdash; {row.schedule?.materi ?? 'tanpa materi'}
          </div>
          {row.checkin_at && (
            <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: '#047857', marginTop: '4px' }}>
              Check-in: {fmtTimestampWITA(row.checkin_at, 'full')}
            </div>
          )}
          {row.locked_at && (
            <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: '#888', marginTop: '2px' }}>
              Dikunci: {fmtTimestampWITA(row.locked_at, 'full')}
            </div>
          )}
        </div>

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={labelStyle}>Status Kehadiran</label>
            <div style={{ display: 'flex', gap: '14px', marginTop: '6px', flexWrap: 'wrap' }}>
              {(['hadir', 'absen', 'izin'] as const).map(s => {
                const si = STATUS_LABELS[s];
                return (
                  <label key={s} style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '0.88rem' }}>
                    <input type="radio" name="status" value={s} checked={status === s} onChange={() => setStatus(s)} />
                    <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 700, background: status === s ? si.bg : '#F3F2EE', color: status === s ? si.color : '#888' }}>
                      {si.label}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          <div>
            <label style={labelStyle}>Catatan Siswa / Alasan</label>
            <input
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="misal: sakit, izin keluarga..."
              style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={labelStyle}>Catatan Admin (override)</label>
            <textarea
              value={catatanAdmin}
              onChange={e => setCatatanAdmin(e.target.value)}
              placeholder="Catatan tambahan dari admin (opsional)"
              rows={2}
              style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', resize: 'vertical' }}
            />
          </div>

          {error && <p style={{ fontFamily: 'var(--font-body)', color: '#DC0A1E', fontSize: '0.85rem', margin: 0 }}>{error}</p>}

          <div style={{ display: 'flex', gap: '10px' }}>
            <button type="button" onClick={onClose} style={btnSecondary}>Batal</button>
            <button type="submit" disabled={saving} style={btnPrimary}>{saving ? 'Menyimpan...' : 'Simpan'}</button>
          </div>
        </form>
      </div>
    </Overlay>
  );
}

/* ===================== SHARED UI ===================== */

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px' }}>
      {children}
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
  whiteSpace: 'nowrap',
};
const td: React.CSSProperties = { padding: '11px 14px', verticalAlign: 'middle' };
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
const modalStyle: React.CSSProperties = {
  background: '#fff', borderRadius: '12px', padding: '28px 32px',
  width: '100%', maxWidth: '480px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
  maxHeight: '90vh', overflowY: 'auto',
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
