import { useState, useEffect, FormEvent } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { HARI, getWeekStart, getWeekDays, toISODate, formatDayLabel, fmtTime } from '../../lib/dates';
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
  week_start: string;
  groups: { id: string; nama: string; kode: string; warna: string; warna_text: string };
  teacher: { id: string; display_name: string };
};

type Teacher = { id: string; display_name: string };

const LOKASI = ['Badak Agung', 'Trijata', 'Mahendradata'];

const defaultForm = {
  group_id: '',
  teacher_id: '',
  hari: 'Senin',
  jam_mulai: '15:30',
  jam_selesai: '17:00',
  materi: '',
  lokasi: 'Badak Agung',
};

export default function InputJadwal() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';

  const [weekStart, setWeekStart] = useState<Date>(() => getWeekStart());
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<ScheduleRow | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const weekDays = getWeekDays(weekStart);

  useEffect(() => { load(); }, [weekStart]); // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true);
    const ws = toISODate(weekStart);
    const [{ data: sched }, { data: grp }, { data: teach }] = await Promise.all([
      supabase
        .from('schedules')
        .select('id, group_id, teacher_id, hari, jam_mulai, jam_selesai, materi, lokasi, week_start, groups!group_id(id,nama,kode,warna,warna_text), teacher:profiles!teacher_id(id,display_name)')
        .eq('week_start', ws)
        .order('jam_mulai'),
      supabase.from('groups').select('*').eq('active', true).order('nama'),
      supabase.from('profiles').select('id, display_name').eq('role', 'teacher').order('display_name'),
    ]);
    setSchedules((sched ?? []) as ScheduleRow[]);
    setGroups(grp ?? []);
    setTeachers((teach ?? []) as Teacher[]);
    setLoading(false);
  }

  function openAdd() {
    setEditing(null);
    setForm({ ...defaultForm, group_id: groups[0]?.id ?? '', teacher_id: teachers[0]?.id ?? '' });
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

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', margin: 0, color: '#0D0D0D' }}>
            Jadwal Bimbel
          </h1>
          <WeekPicker weekStart={weekStart} onChange={setWeekStart} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
          <button onClick={openAdd} style={btnPrimary}>+ Tambah Sesi</button>
          {(groups.length === 0 || teachers.length === 0) && (
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: '#DC0A1E', margin: 0 }}>
              {groups.length === 0 && teachers.length === 0
                ? 'Belum ada grup dan pengajar. Buat di /admin/users.'
                : groups.length === 0
                ? 'Belum ada grup aktif. Buat di /admin/users > Grup.'
                : 'Belum ada akun pengajar. Buat di /admin/users.'}
            </p>
          )}
        </div>
      </div>

      {/* Schedule grid */}
      {loading ? (
        <p style={mutedText}>Memuat...</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {HARI.map((hari, idx) => {
            const daySessions = schedules.filter(s => s.hari === hari);
            const dayDate = weekDays[idx];
            return (
              <div key={hari}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '8px' }}>
                  <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', margin: 0, color: '#0D0D0D' }}>
                    {hari}
                  </h2>
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: '#666' }}>
                    {formatDayLabel(dayDate)}
                  </span>
                </div>

                {daySessions.length === 0 ? (
                  <p style={{ ...mutedText, marginLeft: '2px' }}>Tidak ada sesi</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {daySessions.map(s => (
                      <div key={s.id} style={sessionCard}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, flexWrap: 'wrap', minWidth: 0 }}>
                          <GrupBadge kode={s.groups.kode} warna={s.groups.warna} warna_text={s.groups.warna_text} />
                          <span style={timeText}>{fmtTime(s.jam_mulai)} – {fmtTime(s.jam_selesai)}</span>
                          <span style={mainText}>{s.materi ?? '–'}</span>
                          <span style={mutedText}>{s.teacher.display_name}</span>
                          {s.lokasi && <span style={mutedText}>@ {s.lokasi}</span>}
                        </div>
                        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                          <button onClick={() => openEdit(s)} style={btnEdit}>Edit</button>
                          {isAdmin && (
                            <button onClick={() => setDeleteId(s.id)} style={btnDelete}>Hapus</button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div style={overlay}>
          <div style={modal}>
            <h2 style={modalTitle}>{editing ? 'Edit Sesi' : 'Tambah Sesi'}</h2>
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

              <Field label="Grup">
                <select value={form.group_id} onChange={e => setForm(f => ({ ...f, group_id: e.target.value }))} required style={select}>
                  <option value="">Pilih grup</option>
                  {groups.map(g => <option key={g.id} value={g.id}>[{g.kode}] {g.nama}</option>)}
                </select>
              </Field>

              <Field label="Pengajar">
                <select value={form.teacher_id} onChange={e => setForm(f => ({ ...f, teacher_id: e.target.value }))} required style={select}>
                  <option value="">Pilih pengajar</option>
                  {teachers.map(t => <option key={t.id} value={t.id}>{t.display_name}</option>)}
                </select>
              </Field>

              <Field label="Hari">
                <select value={form.hari} onChange={e => setForm(f => ({ ...f, hari: e.target.value }))} style={select}>
                  {HARI.map(h => <option key={h} value={h}>{h}</option>)}
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

              <Field label="Lokasi">
                <select value={form.lokasi} onChange={e => setForm(f => ({ ...f, lokasi: e.target.value }))} style={select}>
                  {LOKASI.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
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

      {/* Delete Confirm Modal */}
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

function Field({ label, children, style }: { label: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', ...style }}>
      <label style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', fontWeight: 600, color: '#2E2E2E' }}>{label}</label>
      {children}
    </div>
  );
}

const sessionCard: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #E2E1DC',
  borderRadius: '8px',
  padding: '12px 14px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '12px',
};

const mutedText: React.CSSProperties = {
  fontFamily: 'var(--font-body)',
  fontSize: '0.82rem',
  color: '#666',
  margin: 0,
};

const mainText: React.CSSProperties = {
  fontFamily: 'var(--font-body)',
  fontSize: '0.88rem',
  color: '#0D0D0D',
  fontWeight: 500,
};

const timeText: React.CSSProperties = {
  fontFamily: 'var(--font-body)',
  fontSize: '0.85rem',
  color: '#0D0D0D',
  fontWeight: 700,
  whiteSpace: 'nowrap',
};

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 100, padding: '20px',
};

const modal: React.CSSProperties = {
  background: '#fff', borderRadius: '12px', padding: '28px 32px',
  width: '100%', maxWidth: '480px',
  boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
  maxHeight: '90vh', overflowY: 'auto',
};

const modalTitle: React.CSSProperties = {
  fontFamily: 'var(--font-display)', fontSize: '1.2rem',
  margin: '0 0 20px', color: '#0D0D0D',
};

const input: React.CSSProperties = {
  padding: '9px 11px', border: '1.5px solid #E2E1DC', borderRadius: '7px',
  fontFamily: 'var(--font-body)', fontSize: '0.88rem', outline: 'none',
  color: '#0D0D0D', background: '#fff', width: '100%', boxSizing: 'border-box',
};

const select: React.CSSProperties = { ...input };

const btnPrimary: React.CSSProperties = {
  flex: 1, padding: '10px 16px', background: '#0F1F6B', color: '#fff',
  border: 'none', borderRadius: '8px', cursor: 'pointer',
  fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.88rem',
};

const btnSecondary: React.CSSProperties = {
  flex: 1, padding: '10px 16px', background: '#F3F2EE', color: '#2E2E2E',
  border: 'none', borderRadius: '8px', cursor: 'pointer',
  fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.88rem',
};

const btnEdit: React.CSSProperties = {
  padding: '5px 12px', background: '#E6EAF8', color: '#0F1F6B',
  border: 'none', borderRadius: '6px', cursor: 'pointer',
  fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.78rem',
};

const btnDelete: React.CSSProperties = {
  padding: '5px 12px', background: '#FFF0F1', color: '#DC0A1E',
  border: 'none', borderRadius: '6px', cursor: 'pointer',
  fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.78rem',
};
