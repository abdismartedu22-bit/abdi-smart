import { useState, useEffect, FormEvent } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { HARI, getWeekStart, getWeekDays, toISODate, formatDayLabel, getDateForHari, fmtTime } from '../../lib/dates';
import WeekPicker from '../../components/shared/WeekPicker';
import GrupBadge from '../../components/shared/GrupBadge';
import type { Group } from '../../types';

type ScheduleRow = {
  id: string;
  group_id: string;
  teacher_id: string;
  hari: string;
  jam_mulai: string;
  jam_selesai: string;
  materi: string | null;
  lokasi: string | null;
  ruangan: string | null;
  pertemuan_ke: number | null;
  week_start: string;
  created_at: string;
  groups: { id: string; nama: string; kode: string; warna: string; warna_text: string };
  teacher: { id: string; display_name: string };
};

type Teacher = { id: string; display_name: string };
type GedungRoom = { id: string; nama: string; ruangan: string; kapasitas: number | null };

const LOKASI = ['Badak Agung', 'Trijata', 'Mahendradata'];

const defaultForm = {
  group_id: '',
  teacher_id: '',
  hari: 'Senin',
  jam_mulai: '15:30',
  jam_selesai: '17:00',
  materi: '',
  lokasi: 'Badak Agung',
  ruangan: '',
  pertemuan_ke: '',
};

function getTodayHari(): string {
  return ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][new Date().getDay()];
}

function getYesterdayHari(): string {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][yesterday.getDay()];
}

export default function InputJadwal() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';

  const [weekStart, setWeekStart] = useState<Date>(() => getWeekStart());
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [gedungRooms, setGedungRooms] = useState<GedungRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<ScheduleRow | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const weekDays = getWeekDays(weekStart);
  const todayHari = getTodayHari();
  const yesterdayHari = getYesterdayHari();

  useEffect(() => { load(); }, [weekStart]); // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true);
    const ws = toISODate(weekStart);
    const [{ data: sched }, { data: grp }, { data: teach }, { data: gedung }] = await Promise.all([
      supabase
        .from('schedules')
        .select('id, group_id, teacher_id, hari, jam_mulai, jam_selesai, materi, lokasi, ruangan, pertemuan_ke, week_start, created_at, groups!group_id(id,nama,kode,warna,warna_text), teacher:profiles!teacher_id(id,display_name)')
        .eq('week_start', ws)
        .order('created_at', { ascending: false }), // most recently added first
      supabase.from('groups').select('*').eq('active', true).order('nama'),
      supabase.from('profiles').select('id, display_name').eq('role', 'teacher').order('display_name'),
      supabase.from('gedung').select('id, nama, ruangan, kapasitas').eq('status', 'aktif').order('nama').order('ruangan'),
    ]);
    setSchedules((sched ?? []) as unknown as ScheduleRow[]);
    setGroups(grp ?? []);
    setTeachers((teach ?? []) as Teacher[]);
    setGedungRooms((gedung ?? []) as GedungRoom[]);
    setLoading(false);
  }

  function openAdd() {
    setEditing(null);
    setForm({ ...defaultForm, group_id: '', teacher_id: '' });
    const missing = [];
    if (groups.length === 0) missing.push('grup');
    if (teachers.length === 0) missing.push('pengajar');
    setFormError(missing.length > 0 ? `Belum ada ${missing.join(' dan ')}. Tambahkan di /admin/users terlebih dahulu.` : '');
    setShowModal(true);
  }

  function openEdit(s: ScheduleRow) {
    setEditing(s);
    setForm({
      group_id: s.group_id,
      teacher_id: s.teacher_id,
      hari: s.hari,
      jam_mulai: fmtTime(s.jam_mulai),
      jam_selesai: fmtTime(s.jam_selesai),
      materi: s.materi ?? '',
      lokasi: s.lokasi ?? 'Badak Agung',
      ruangan: s.ruangan ?? '',
      pertemuan_ke: s.pertemuan_ke?.toString() ?? '',
    });
    setFormError('');
    setShowModal(true);
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setFormError('');
    if (!form.group_id || !form.teacher_id) { setFormError('Grup dan pengajar wajib diisi'); return; }
    if (form.jam_mulai >= form.jam_selesai) { setFormError('Jam selesai harus setelah jam mulai'); return; }

    setSubmitting(true);
    const payload = {
      group_id: form.group_id,
      teacher_id: form.teacher_id,
      hari: form.hari,
      jam_mulai: form.jam_mulai,
      jam_selesai: form.jam_selesai,
      materi: form.materi || null,
      lokasi: form.lokasi || null,
      ruangan: form.ruangan || null,
      pertemuan_ke: form.pertemuan_ke ? parseInt(form.pertemuan_ke) : null,
      week_start: toISODate(weekStart),
      created_by: profile?.id,
    };

    const { error } = editing
      ? await supabase.from('schedules').update(payload).eq('id', editing.id)
      : await supabase.from('schedules').insert(payload);

    setSubmitting(false);
    if (error) { setFormError(error.message); return; }
    setShowModal(false);
    load();
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    await supabase.from('schedules').delete().eq('id', deleteId);
    setDeleting(false);
    setDeleteId(null);
    load();
  }

  // Filter to H and H-1 when not showing all
  const displayed = showAll
    ? schedules
    : schedules.filter(s => s.hari === todayHari || s.hari === yesterdayHari);

  // For "show all" mode: group by day in HARI order
  const byDay = HARI.map((hari, idx) => ({
    hari,
    dayDate: weekDays[idx],
    sessions: schedules.filter(s => s.hari === hari),
  }));

  // Rooms for the selected lokasi in the form
  const roomsForLokasi = gedungRooms.filter(r => r.nama === form.lokasi);

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', margin: 0, color: '#0D0D0D' }}>
            Jadwal Bimbel
          </h1>
          <WeekPicker weekStart={weekStart} onChange={setWeekStart} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
          <button onClick={openAdd} style={btnPrimary}>+ Tambah Sesi</button>
        </div>
      </div>

      {/* View toggle */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          onClick={() => setShowAll(false)}
          style={{
            padding: '6px 14px', borderRadius: '6px', cursor: 'pointer',
            fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.82rem',
            background: !showAll ? '#0D5C3A' : '#F3F2EE',
            color: !showAll ? '#fff' : '#444',
            border: 'none',
          }}
        >
          Hari Ini &amp; Kemarin
        </button>
        <button
          onClick={() => setShowAll(true)}
          style={{
            padding: '6px 14px', borderRadius: '6px', cursor: 'pointer',
            fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.82rem',
            background: showAll ? '#0D5C3A' : '#F3F2EE',
            color: showAll ? '#fff' : '#444',
            border: 'none',
          }}
        >
          Semua Hari
        </button>
        <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: '#888' }}>
          {displayed.length} sesi
        </span>
      </div>

      {/* Schedule list */}
      {loading ? (
        <p style={mutedText}>Memuat...</p>
      ) : !showAll ? (
        /* H-1 + H flat list sorted by created_at desc */
        <div>
          {displayed.length === 0 ? (
            <p style={mutedText}>Tidak ada sesi untuk kemarin dan hari ini.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {displayed.map(s => (
                <SessionCard key={s.id} s={s} isAdmin={isAdmin} onEdit={() => openEdit(s)} onDelete={() => setDeleteId(s.id)} />
              ))}
            </div>
          )}
        </div>
      ) : (
        /* All week, grouped by day */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {byDay.map(({ hari, dayDate, sessions }) => (
            <div key={hari}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '8px' }}>
                <h2 style={{
                  fontFamily: 'var(--font-display)', fontSize: '1rem', margin: 0,
                  color: hari === todayHari ? '#DC0A1E' : '#0D0D0D',
                }}>
                  {hari}{hari === todayHari ? ' (hari ini)' : hari === yesterdayHari ? ' (kemarin)' : ''}
                </h2>
                <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: '#666' }}>
                  {formatDayLabel(dayDate)}
                </span>
              </div>
              {sessions.length === 0 ? (
                <p style={{ ...mutedText, marginLeft: '2px' }}>Tidak ada sesi</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {sessions.map(s => (
                    <SessionCard key={s.id} s={s} isAdmin={isAdmin} onEdit={() => openEdit(s)} onDelete={() => setDeleteId(s.id)} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div style={overlay}>
          <div style={modal}>
            <h2 style={modalTitle}>{editing ? 'Edit Sesi' : 'Tambah Sesi'}</h2>
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

              <Field label="Grup">
                <SearchSelect
                  items={groups.map(g => ({ id: g.id, label: g.nama, badge: g.kode, badgeBg: g.warna, badgeColor: g.warna_text }))}
                  value={form.group_id}
                  onChange={id => setForm(f => ({ ...f, group_id: id }))}
                  placeholder="Cari grup..."
                />
              </Field>

              <Field label="Pengajar">
                <SearchSelect
                  items={teachers.map(t => ({ id: t.id, label: t.display_name }))}
                  value={form.teacher_id}
                  onChange={id => setForm(f => ({ ...f, teacher_id: id }))}
                  placeholder="Cari pengajar..."
                />
              </Field>

              <Field label="Hari">
                <select value={form.hari} onChange={e => setForm(f => ({ ...f, hari: e.target.value }))} style={select}>
                  {HARI.map((h, i) => (
                    <option key={h} value={h}>{h}, {formatDayLabel(weekDays[i])}</option>
                  ))}
                </select>
              </Field>

              <div style={{ display: 'flex', gap: '10px' }}>
                <Field label="Jam Mulai" style={{ flex: 1 }}>
                  <input type="time" value={form.jam_mulai} onChange={e => setForm(f => ({ ...f, jam_mulai: e.target.value }))} required style={input} />
                </Field>
                <Field label="Jam Selesai" style={{ flex: 1 }}>
                  <input type="time" value={form.jam_selesai} onChange={e => setForm(f => ({ ...f, jam_selesai: e.target.value }))} required style={input} />
                </Field>
              </div>

              <Field label="Materi">
                <input type="text" value={form.materi} onChange={e => setForm(f => ({ ...f, materi: e.target.value }))} placeholder="cth. TPS – Penalaran Umum" style={input} />
              </Field>

              <div style={{ display: 'flex', gap: '10px' }}>
                <Field label="Lokasi" style={{ flex: 1 }}>
                  <select value={form.lokasi} onChange={e => setForm(f => ({ ...f, lokasi: e.target.value, ruangan: '' }))} style={select}>
                    {LOKASI.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </Field>
                <Field label="Ruangan" style={{ flex: 1 }}>
                  {roomsForLokasi.length > 0 ? (
                    <select value={form.ruangan} onChange={e => setForm(f => ({ ...f, ruangan: e.target.value }))} style={select}>
                      <option value="">-- pilih --</option>
                      {roomsForLokasi.map(r => (
                        <option key={r.id} value={r.ruangan}>{r.ruangan}{r.kapasitas ? ` (maks ${r.kapasitas})` : ''}</option>
                      ))}
                    </select>
                  ) : (
                    <input type="text" value={form.ruangan} onChange={e => setForm(f => ({ ...f, ruangan: e.target.value }))} placeholder="cth. A" style={input} />
                  )}
                </Field>
              </div>

              <Field label="Pertemuan ke-">
                <input type="number" min="1" value={form.pertemuan_ke} onChange={e => setForm(f => ({ ...f, pertemuan_ke: e.target.value }))} placeholder="cth. 5" style={input} />
              </Field>

              {formError && <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.83rem', color: '#DC0A1E', margin: 0 }}>{formError}</p>}

              <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                <button type="button" onClick={() => setShowModal(false)} style={btnSecondary}>Batal</button>
                <button type="submit" disabled={submitting} style={btnPrimary}>{submitting ? 'Menyimpan...' : 'Simpan'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteId && (
        <div style={overlay}>
          <div style={{ ...modal, maxWidth: '360px' }}>
            <h2 style={modalTitle}>Hapus Sesi?</h2>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.88rem', color: '#666', margin: '0 0 20px' }}>
              Sesi ini akan dihapus permanen beserta data absensinya.
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setDeleteId(null)} style={btnSecondary}>Batal</button>
              <button onClick={handleDelete} disabled={deleting} style={{ ...btnPrimary, background: '#DC0A1E' }}>
                {deleting ? 'Menghapus...' : 'Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---- Session Card ---- */
function SessionCard({ s, isAdmin, onEdit, onDelete }: { s: ScheduleRow; isAdmin: boolean; onEdit: () => void; onDelete: () => void }) {
  return (
    <div style={sessionCard}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, flexWrap: 'wrap', minWidth: 0 }}>
        <GrupBadge kode={s.groups.kode} warna={s.groups.warna} warna_text={s.groups.warna_text} />
        <span style={timeText}>{fmtTime(s.jam_mulai)} – {fmtTime(s.jam_selesai)}</span>
        <span style={mainText}>{s.materi ?? '–'}</span>
        <span style={mutedText}>{s.teacher.display_name}</span>
        {s.lokasi && (
          <span style={mutedText}>
            @ {s.lokasi}{s.ruangan ? ` / ${s.ruangan}` : ''}
          </span>
        )}
        {s.pertemuan_ke != null && (
          <span style={{ ...mutedText, color: '#0D5C3A', fontWeight: 600 }}>Sesi ke-{s.pertemuan_ke}</span>
        )}
        <span style={{ ...mutedText, color: '#bbb', fontSize: '0.75rem', marginLeft: 'auto' }}>
          {s.hari}, {formatDayLabel(getDateForHari(new Date(s.week_start + 'T00:00:00'), s.hari))}
        </span>
      </div>
      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
        <button onClick={onEdit} style={btnEdit}>Edit</button>
        {isAdmin && (
          <button onClick={onDelete} style={btnDelete}>Hapus</button>
        )}
      </div>
    </div>
  );
}

/* ---- Searchable Select ---- */
type SelectItem = { id: string; label: string; badge?: string; badgeBg?: string; badgeColor?: string };

function SearchSelect({ items, value, onChange, placeholder }: {
  items: SelectItem[];
  value: string;
  onChange: (id: string) => void;
  placeholder: string;
}) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const selected = items.find(i => i.id === value);
  const filtered = items.filter(i => i.label.toLowerCase().includes(search.toLowerCase()));

  return (
    <div style={{ position: 'relative' }}>
      <input
        value={open ? search : (selected ? selected.label : '')}
        onChange={e => setSearch(e.target.value)}
        onFocus={() => { setOpen(true); setSearch(''); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        style={input}
      />
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 2px)', left: 0, right: 0,
          background: '#fff', border: '1px solid #E2E1DC', borderRadius: '7px',
          zIndex: 20, maxHeight: '200px', overflowY: 'auto',
          boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
        }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '10px 12px', fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#666' }}>Tidak ditemukan</div>
          ) : filtered.map(item => (
            <div
              key={item.id}
              onMouseDown={() => onChange(item.id)}
              style={{
                padding: '9px 12px', cursor: 'pointer', display: 'flex', gap: '8px', alignItems: 'center',
                background: value === item.id ? '#F0F3FF' : 'transparent',
                fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#0D0D0D',
              }}
            >
              {item.badge && (
                <span style={{ background: item.badgeBg, color: item.badgeColor, padding: '1px 6px', borderRadius: '3px', fontSize: '0.68rem', fontWeight: 700, flexShrink: 0 }}>
                  {item.badge}
                </span>
              )}
              {item.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({ label, children, style }: { label: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', ...style }}>
      <label style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', fontWeight: 600, color: '#2E2E2E' }}>{label}</label>
      {children}
    </div>
  );
}

const sessionCard: React.CSSProperties = { background: '#fff', border: '1px solid #E2E1DC', borderRadius: '8px', padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' };
const mutedText: React.CSSProperties = { fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: '#666', margin: 0 };
const mainText: React.CSSProperties = { fontFamily: 'var(--font-body)', fontSize: '0.88rem', color: '#0D0D0D', fontWeight: 500 };
const timeText: React.CSSProperties = { fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#0D0D0D', fontWeight: 700, whiteSpace: 'nowrap' };
const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px' };
const modal: React.CSSProperties = { background: '#fff', borderRadius: '12px', padding: '28px 32px', width: '100%', maxWidth: '480px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto' };
const modalTitle: React.CSSProperties = { fontFamily: 'var(--font-display)', fontSize: '1.2rem', margin: '0 0 20px', color: '#0D0D0D' };
const input: React.CSSProperties = { padding: '9px 11px', border: '1.5px solid #E2E1DC', borderRadius: '7px', fontFamily: 'var(--font-body)', fontSize: '0.88rem', outline: 'none', color: '#0D0D0D', background: '#fff', width: '100%', boxSizing: 'border-box' };
const select: React.CSSProperties = { ...input };
const btnPrimary: React.CSSProperties = { flex: 1, padding: '10px 16px', background: '#0D5C3A', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.88rem' };
const btnSecondary: React.CSSProperties = { flex: 1, padding: '10px 16px', background: '#F3F2EE', color: '#2E2E2E', border: 'none', borderRadius: '8px', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.88rem' };
const btnEdit: React.CSSProperties = { padding: '5px 12px', background: '#E6EAF8', color: '#0D5C3A', border: 'none', borderRadius: '6px', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.78rem' };
const btnDelete: React.CSSProperties = { padding: '5px 12px', background: '#FFF0F1', color: '#DC0A1E', border: 'none', borderRadius: '6px', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.78rem' };
