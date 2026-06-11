import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { toISODate, fmtTime, fmtTimestampWITA } from '../../lib/dates';
import GrupBadge from '../../components/shared/GrupBadge';

/* ---- Riwayat types ---- */

type RiwayatRow = {
  id: string;
  hari: string;
  jam_mulai: string;
  jam_selesai: string;
  materi: string | null;
  lokasi: string | null;
  ruangan: string | null;
  week_start: string;
  groups: { id: string; nama: string; kode: string; warna: string; warna_text: string };
};

type RiwayatAtt = {
  schedule_id: string;
  sesi_status: string | null;
  note: string | null;
  catatan_admin: string | null;
  locked_at: string | null;
};

const SESI_STATUS_LABELS: Record<string, { label: string; bg: string; color: string }> = {
  terlaksana: { label: 'TEREALISASI', bg: '#DCFCE7', color: '#15803D' },
  tidak:      { label: 'TIDAK',       bg: '#FEE2E2', color: '#DC0A1E' },
  ditunda:    { label: 'DITUNDA',     bg: '#FEF9C3', color: '#A16207' },
  dibatalkan: { label: 'DIBATALKAN',  bg: '#FEE2E2', color: '#7F1D1D' },
};

const SESI_STATUS_DISPLAY: Record<string, string> = {
  terlaksana: 'Terealisasi',
  tidak: 'Tidak',
  ditunda: 'Ditunda',
  dibatalkan: 'Dibatalkan',
};

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

/* ---- Riwayat Tab ---- */

function RiwayatTab({ teacherId }: { teacherId: string }) {
  const todayISO = toISODate(new Date());
  const [dateFilter, setDateFilter] = useState(todayISO);
  const [filterStatus, setFilterStatus] = useState('');
  const [rows, setRows] = useState<{ sched: RiwayatRow; att: RiwayatAtt | null }[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const selectedDate = new Date(dateFilter + 'T00:00:00');
    const weekStartISO = getWeekStartForDate(selectedDate);
    const hariTarget = getHariForDate(selectedDate);

    const [{ data: schedData }, { data: attData }] = await Promise.all([
      supabase
        .from('schedules')
        .select('id, hari, jam_mulai, jam_selesai, materi, lokasi, ruangan, week_start, groups!group_id(id,nama,kode,warna,warna_text)')
        .eq('teacher_id', teacherId)
        .eq('week_start', weekStartISO)
        .eq('hari', hariTarget)
        .order('jam_mulai'),
      supabase
        .from('attendance')
        .select('schedule_id, sesi_status, note, catatan_admin, locked_at')
        .eq('person_id', teacherId)
        .eq('person_role', 'teacher')
        .eq('session_date', dateFilter),
    ]);

    const attMap: Record<string, RiwayatAtt> = {};
    (attData ?? []).forEach((r: any) => { attMap[r.schedule_id] = r as RiwayatAtt; });

    const merged = (schedData ?? [] as unknown as RiwayatRow[]).map((s: any) => ({
      sched: s as RiwayatRow,
      att: attMap[s.id] ?? null,
    }));

    setRows(merged);
    setLoading(false);
  }, [teacherId, dateFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const displayed = rows.filter(({ att }) => {
    const isBelum = att === null || att.sesi_status === null;
    if (filterStatus === 'belum' && !isBelum) return false;
    if (filterStatus && filterStatus !== 'belum' && att?.sesi_status !== filterStatus) return false;
    return true;
  });

  const dateObj = new Date(dateFilter + 'T00:00:00');
  const dateLabel = dateObj.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div>
      {/* Filters */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', fontWeight: 600, color: '#2E2E2E' }}>Tanggal</label>
          <input
            type="date"
            value={dateFilter}
            max={todayISO}
            onChange={e => setDateFilter(e.target.value)}
            style={filterInput}
          />
        </div>
        <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: '#888' }}>{dateLabel}</span>
      </div>
      <div style={{ marginBottom: '18px' }}>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={filterInput}>
          <option value="">Semua Status</option>
          <option value="terlaksana">Terealisasi</option>
          <option value="dibatalkan">Dibatalkan</option>
          <option value="belum">Dijadwalkan</option>
        </select>
      </div>

      {loading ? (
        <p style={mutedStyle}>Memuat...</p>
      ) : displayed.length === 0 ? (
        <div style={emptyCard}>
          <p style={{ fontFamily: 'var(--font-body)', color: '#666', margin: 0, fontSize: '0.9rem' }}>
            {rows.length === 0 ? 'Tidak ada sesi untuk tanggal ini.' : 'Tidak ada data untuk filter ini.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {displayed.map(({ sched, att }) => {
            const isBelum = att === null || att.sesi_status === null;
            const statusInfo = att?.sesi_status ? SESI_STATUS_LABELS[att.sesi_status] : null;
            return (
              <div key={sched.id} style={{ background: '#fff', border: '1px solid #E2E1DC', borderRadius: '10px', padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
                  <GrupBadge nama={sched.groups.nama} warna={sched.groups.warna} warna_text={sched.groups.warna_text} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '2px', flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.9rem', color: '#0D0D0D' }}>
                        {fmtTime(sched.jam_mulai)} s/d {fmtTime(sched.jam_selesai)}
                      </span>
                      <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: '#aaa' }}>WITA</span>
                    </div>
                    {sched.materi && (
                      <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#0D0D0D', margin: '0 0 4px' }}>
                        {sched.materi}
                      </p>
                    )}
                    {(sched.lokasi || sched.ruangan) && (
                      <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: '#888', margin: '0 0 6px' }}>
                        {[sched.lokasi, sched.ruangan].filter(Boolean).join(' / ')}
                      </p>
                    )}
                    {(att?.note || att?.catatan_admin) && (
                      <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {att.note && (
                          <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: '#666' }}>
                            Catatan: {att.note}
                          </span>
                        )}
                        {att.catatan_admin && (
                          <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: '#0D5C3A', fontWeight: 600 }}>
                            Admin: {att.catatan_admin}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div style={{ flexShrink: 0, textAlign: 'right' }}>
                    {isBelum ? (
                      <span style={{ padding: '3px 10px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700, background: '#EFF6FF', color: '#1D4ED8' }}>
                        DIJADWALKAN
                      </span>
                    ) : statusInfo ? (
                      <span style={{ padding: '3px 10px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700, background: statusInfo.bg, color: statusInfo.color }}>
                        {statusInfo.label}
                      </span>
                    ) : null}
                    {att?.locked_at && (
                      <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.68rem', color: '#bbb', marginTop: '4px' }}>TERKUNCI</div>
                    )}
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

const filterInput: React.CSSProperties = {
  padding: '7px 10px', border: '1.5px solid #E2E1DC', borderRadius: '7px',
  fontFamily: 'var(--font-body)', fontSize: '0.83rem', background: '#fff', color: '#0D0D0D',
  outline: 'none', cursor: 'pointer',
};

type SessionToday = {
  id: string;
  hari: string;
  jam_mulai: string;
  jam_selesai: string;
  materi: string | null;
  lokasi: string | null;
  groups: { id: string; nama: string; kode: string; warna: string; warna_text: string };
};

type StudentInGroup = {
  student_id: string;
  profiles: { id: string; display_name: string };
};

type AttRow = {
  id: string;
  schedule_id: string;
  person_id: string;
  person_role: 'student' | 'teacher';
  status: string | null;
  checkin_at: string | null;
  sesi_status: string | null;
  note: string | null;
  locked_at: string | null;
};

function getTodayHari(): string {
  return ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][new Date().getDay()];
}

function getWeekStartISO(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return toISODate(d);
}

export default function TeacherRealisasi() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<SessionToday[]>([]);
  const [students, setStudents] = useState<Record<string, StudentInGroup[]>>({});
  const [attendance, setAttendance] = useState<AttRow[]>([]);
  const [loading, setLoading] = useState(true);

  const today = toISODate(new Date());
  const dateLabel = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const { data: sched } = await supabase
      .from('schedules')
      .select('id, hari, jam_mulai, jam_selesai, materi, lokasi, groups!group_id(id,nama,kode,warna,warna_text)')
      .eq('teacher_id', user.id)
      .eq('week_start', getWeekStartISO())
      .eq('hari', getTodayHari())
      .order('jam_mulai');

    const todaySessions = (sched ?? []) as unknown as SessionToday[];
    setSessions(todaySessions);

    if (todaySessions.length === 0) { setLoading(false); return; }

    // Fetch students for each session's group
    const groupIds = [...new Set(todaySessions.map(s => s.groups.id))];
    const { data: sg } = await supabase
      .from('student_groups')
      .select('student_id, group_id, profiles!student_id(id,display_name)')
      .in('group_id', groupIds);

    const studentMap: Record<string, StudentInGroup[]> = {};
    todaySessions.forEach(s => {
      studentMap[s.id] = (sg ?? [])
        .filter(r => r.group_id === s.groups.id)
        .map(r => ({ student_id: r.student_id, profiles: r.profiles as unknown as { id: string; display_name: string } }));
    });
    setStudents(studentMap);

    const scheduleIds = todaySessions.map(s => s.id);
    const { data: att } = await supabase
      .from('attendance')
      .select('id, schedule_id, person_id, person_role, status, checkin_at, sesi_status, note, locked_at')
      .in('schedule_id', scheduleIds)
      .eq('session_date', today);

    setAttendance((att ?? []) as AttRow[]);
    setLoading(false);
  }, [user, today]);

  useEffect(() => { load(); }, [load]);

  // Poll attendance every 10 s so teacher sees student check-ins live
  useEffect(() => {
    if (sessions.length === 0) return;
    const scheduleIds = sessions.map(s => s.id);
    const t = setInterval(async () => {
      const { data: att } = await supabase
        .from('attendance')
        .select('id, schedule_id, person_id, person_role, status, checkin_at, sesi_status, note, locked_at')
        .in('schedule_id', scheduleIds)
        .eq('session_date', today);
      if (att) setAttendance(att as AttRow[]);
    }, 10_000);
    return () => clearInterval(t);
  }, [sessions, today]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', margin: '0 0 4px', color: '#0D0D0D' }}>
          Realisasi & Absen
        </h1>
        <p style={mutedStyle}>{dateLabel}</p>
      </div>

      {loading ? (
        <p style={mutedStyle}>Memuat...</p>
      ) : sessions.length === 0 ? (
        <div style={emptyCard}>
          <p style={{ fontFamily: 'var(--font-body)', color: '#666', margin: 0 }}>Tidak ada sesi hari ini.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {sessions.map(s => (
            <SessionCard
              key={s.id}
              session={s}
              sessionStudents={students[s.id] ?? []}
              attendance={attendance.filter(a => a.schedule_id === s.id)}
              today={today}
              teacherId={user!.id}
              onRefresh={load}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ===================== SESSION CARD ===================== */

function SessionCard({
  session, sessionStudents, attendance, today, teacherId, onRefresh,
}: {
  session: SessionToday;
  sessionStudents: StudentInGroup[];
  attendance: AttRow[];
  today: string;
  teacherId: string;
  onRefresh: () => void;
}) {
  const teacherRow = attendance.find(a => a.person_role === 'teacher' && a.person_id === teacherId);
  const [optimisticLocked, setOptimisticLocked] = useState(false);
  const locked = optimisticLocked || !!teacherRow?.locked_at;
  const [lockError, setLockError] = useState<string | null>(null);

  const hasSavedSesi = !!teacherRow?.sesi_status;
  const [saving, setSaving] = useState<string | null>(null);
  const [locking, setLocking] = useState(false);
  const [editingSesi, setEditingSesi] = useState(false);
  const [sesiStatus, setSesiStatus] = useState<string>(teacherRow?.sesi_status ?? 'terlaksana');
  const [note, setNote] = useState<string>(teacherRow?.note ?? '');
  const [studentStatuses, setStudentStatuses] = useState<Record<string, { status: string; note: string }>>(() => {
    const init: Record<string, { status: string; note: string }> = {};
    sessionStudents.forEach(st => {
      const att = attendance.find(a => a.person_id === st.student_id && a.person_role === 'student');
      const defaultStatus = att?.checkin_at ? 'hadir' : 'tidak_hadir';
      init[st.student_id] = { status: att?.status ?? defaultStatus, note: att?.note ?? '' };
    });
    return init;
  });

  const checkedInCount = attendance.filter(a => a.person_role === 'student' && a.checkin_at).length;

  async function markTeacherHadir() {
    setSaving('teacher');
    if (teacherRow) {
      await supabase.from('attendance').update({ status: 'hadir', checkin_at: new Date().toISOString() }).eq('id', teacherRow.id);
    } else {
      await supabase.from('attendance').insert({
        schedule_id: session.id, session_date: today,
        person_id: teacherId, person_role: 'teacher',
        status: 'hadir', checkin_at: new Date().toISOString(),
        sesi_status: sesiStatus, note: note || null,
      });
    }
    setSaving(null);
    onRefresh();
  }

  async function saveSesiInfo() {
    setSaving('sesi');
    if (teacherRow) {
      await supabase.from('attendance').update({ sesi_status: sesiStatus, note: note || null }).eq('id', teacherRow.id);
    } else {
      await supabase.from('attendance').insert({
        schedule_id: session.id, session_date: today,
        person_id: teacherId, person_role: 'teacher',
        status: null, sesi_status: sesiStatus, note: note || null,
      });
    }
    if (sesiStatus === 'dibatalkan') {
      await supabase.from('attendance')
        .delete()
        .eq('schedule_id', session.id)
        .eq('session_date', today)
        .eq('person_role', 'student');
    }
    setSaving(null);
    setEditingSesi(false);
    onRefresh();
  }

  async function updateStudentStatus(studentId: string, status: string, studentNote: string) {
    const att = attendance.find(a => a.person_id === studentId && a.person_role === 'student');
    if (att) {
      await supabase.from('attendance').update({ status, note: studentNote || null }).eq('id', att.id);
    } else {
      await supabase.from('attendance').insert({
        schedule_id: session.id, session_date: today,
        person_id: studentId, person_role: 'student',
        status, note: studentNote || null,
      });
    }
    onRefresh();
  }

  async function handleLock() {
    setLocking(true);
    setLockError(null);
    const now = new Date().toISOString();

    // Step 1: ensure teacher row exists WITHOUT locked_at
    if (!teacherRow) {
      const { error: insErr } = await supabase.from('attendance').insert({
        schedule_id: session.id, session_date: today,
        person_id: teacherId, person_role: 'teacher',
        status: sesiStatus === 'dibatalkan' ? null : 'hadir',
        sesi_status: sesiStatus, note: note || null,
        checkin_at: sesiStatus === 'dibatalkan' ? null : now,
      });
      if (insErr) {
        setLockError('Gagal menyimpan kehadiran guru: ' + insErr.message);
        setLocking(false);
        return;
      }
    } else {
      await supabase.from('attendance')
        .update({ sesi_status: sesiStatus, note: note || null })
        .eq('id', teacherRow.id);
    }

    // Step 2: lock the teacher row
    const { error: lockTeacherErr } = await supabase.from('attendance')
      .update({ locked_at: now })
      .eq('schedule_id', session.id)
      .eq('session_date', today)
      .eq('person_id', teacherId)
      .eq('person_role', 'teacher');

    if (lockTeacherErr) {
      setLockError('Gagal mengunci sesi guru: ' + lockTeacherErr.message);
      setLocking(false);
      return;
    }

    // If cancelled: wipe student attendance and done
    if (sesiStatus === 'dibatalkan') {
      await supabase.from('attendance')
        .delete()
        .eq('schedule_id', session.id)
        .eq('session_date', today)
        .eq('person_role', 'student');
      setOptimisticLocked(true);
      setLocking(false);
      onRefresh();
      return;
    }

    // Step 3: upsert student rows WITHOUT locked_at
    for (const st of sessionStudents) {
      const att = attendance.find(a => a.person_id === st.student_id && a.person_role === 'student');
      const finalStatus = studentStatuses[st.student_id]?.status ?? 'tidak_hadir';
      const finalNote = studentStatuses[st.student_id]?.note ?? '';
      if (att) {
        await supabase.from('attendance').update({ status: finalStatus, note: finalNote || null }).eq('id', att.id);
      } else {
        await supabase.from('attendance').insert({
          schedule_id: session.id, session_date: today,
          person_id: st.student_id, person_role: 'student',
          status: finalStatus, note: finalNote || null,
        });
      }
    }

    // Step 4: bulk lock all student rows
    const { error: lockStudentsErr } = await supabase
      .from('attendance')
      .update({ locked_at: now, verified_by: teacherId, verified_at: now })
      .eq('schedule_id', session.id)
      .eq('session_date', today)
      .eq('person_role', 'student');

    if (lockStudentsErr) {
      setLockError('Gagal mengunci absen siswa: ' + lockStudentsErr.message);
      setLocking(false);
      return;
    }

    setOptimisticLocked(true);
    setLocking(false);
    onRefresh();
  }

  return (
    <div style={cardStyle}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '16px' }}>
        <GrupBadge nama={session.groups.nama} warna={session.groups.warna} warna_text={session.groups.warna_text} />
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.9rem', color: '#0D0D0D' }}>
            {fmtTime(session.jam_mulai)} &ndash; {fmtTime(session.jam_selesai)}
          </div>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: '#888', marginTop: '1px' }}>
            {fmtTime(session.jam_mulai)}&ndash;{fmtTime(session.jam_selesai)} WITA
          </div>
          {session.materi && <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#0D0D0D', marginTop: '2px' }}>{session.materi}</div>}
          {session.lokasi && <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: '#666', marginTop: '1px' }}>@ {session.lokasi}</div>}
        </div>
        {locked && (
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 10px', borderRadius: '6px', background: '#DCFCE7', flexShrink: 0 }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#15803D" strokeWidth="2.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.72rem', fontWeight: 700, color: '#15803D' }}>TERKUNCI</span>
          </span>
        )}
      </div>

      <div style={{ borderTop: '1px solid #E2E1DC', paddingTop: '14px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

        {/* Teacher check-in */}
        <div>
          <p style={sectionLabel}>Kehadiran Saya</p>
          {teacherRow?.status === 'hadir' ? (
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#047857', margin: 0, fontWeight: 500 }}>
              Sudah hadir {teacherRow.checkin_at ? `(${fmtTimestampWITA(teacherRow.checkin_at, 'time')})` : ''}
            </p>
          ) : (
            !locked && (
              <button onClick={markTeacherHadir} disabled={saving === 'teacher'} style={btnSmall}>
                {saving === 'teacher' ? 'Mencatat...' : 'Saya Hadir'}
              </button>
            )
          )}
        </div>

        {/* Sesi status */}
        <div>
          <p style={sectionLabel}>Status Sesi</p>
          {locked ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {teacherRow?.sesi_status && (() => {
                const si = SESI_STATUS_LABELS[teacherRow.sesi_status] ?? { label: teacherRow.sesi_status.toUpperCase(), bg: '#F3F2EE', color: '#666' };
                return (
                  <span style={{ padding: '3px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, background: si.bg, color: si.color }}>
                    {si.label}
                  </span>
                );
              })()}
              {teacherRow?.note && <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: '#666' }}>{teacherRow.note}</span>}
            </div>
          ) : hasSavedSesi && !editingSesi ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              {(() => {
                const si = SESI_STATUS_LABELS[sesiStatus] ?? { label: sesiStatus.toUpperCase(), bg: '#F3F2EE', color: '#666' };
                return (
                  <span style={{ padding: '3px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, background: si.bg, color: si.color }}>
                    {si.label}
                  </span>
                );
              })()}
              {note && <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: '#666' }}>{note}</span>}
              <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: '#047857', display: 'flex', alignItems: 'center', gap: '3px' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                Tersimpan
              </span>
              <button onClick={() => setEditingSesi(true)} style={{ ...btnSmall, background: '#F3F2EE', color: '#0D0D0D', border: '1px solid #E2E1DC' }}>
                Edit
              </button>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '8px' }}>
                {(['terlaksana', 'dibatalkan'] as const).map(s => (
                  <label key={s} style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '0.85rem' }}>
                    <input type="radio" name={`sesi_${session.id}`} value={s} checked={sesiStatus === s} onChange={() => setSesiStatus(s)} />
                    {SESI_STATUS_DISPLAY[s] ?? s}
                  </label>
                ))}
              </div>
              <input
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Catatan (opsional)"
                style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }}
              />
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <button onClick={handleLock} disabled={locking} style={btnSmall}>
                  {locking ? 'Mengunci...' : 'Simpan & Kunci'}
                </button>
                {editingSesi && (
                  <button onClick={() => setEditingSesi(false)} style={{ ...btnSmall, background: '#F3F2EE', color: '#0D0D0D', border: '1px solid #E2E1DC' }}>
                    Batal
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {/* Student list */}
        <div>
          <p style={sectionLabel}>
            Daftar Absen ({sessionStudents.length} siswa &mdash; {checkedInCount} sudah check-in)
          </p>
          {sessionStudents.length === 0 ? (
            <p style={mutedStyle}>Tidak ada siswa di grup ini.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {sessionStudents.map(st => {
                const sAtt = attendance.find(a => a.person_id === st.student_id && a.person_role === 'student');
                const hasCheckedIn = !!sAtt?.checkin_at;
                const cur = studentStatuses[st.student_id] ?? { status: 'absen', note: '' };

                return (
                  <div key={st.student_id} style={studentRow}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: hasCheckedIn ? '#22C55E' : '#D1D5DB', flexShrink: 0 }} />
                      <div>
                        <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', fontWeight: 600, color: '#0D0D0D' }}>
                          {st.profiles.display_name}
                        </span>
                        {sAtt?.checkin_at && (
                          <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: '#666', marginLeft: '6px' }}>
                            check-in {fmtTimestampWITA(sAtt.checkin_at, 'time')}
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
                      {locked ? (
                        <span style={statusBadge(cur.status)}>
                          {cur.status === 'tidak_hadir' || cur.status === 'absen' ? 'TIDAK HADIR' : cur.status === 'izin' ? 'IZIN' : cur.status.toUpperCase()}
                        </span>
                      ) : (
                        <>
                          <select
                            value={cur.status === 'absen' || cur.status === 'izin' ? 'tidak_hadir' : cur.status}
                            onChange={e => {
                              const val = e.target.value;
                              setStudentStatuses(prev => ({ ...prev, [st.student_id]: { ...prev[st.student_id], status: val } }));
                              updateStudentStatus(st.student_id, val, cur.note);
                            }}
                            style={selectSmall}
                          >
                            <option value="hadir">Hadir</option>
                            <option value="tidak_hadir">Tidak Hadir</option>
                          </select>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Lock button / locked banner */}
        <div style={{ borderTop: '1px solid #E2E1DC', paddingTop: '14px' }}>
          {locked ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '8px', padding: '12px 14px' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#15803D" strokeWidth="2.2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              <div>
                <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.88rem', fontWeight: 700, color: '#15803D' }}>Sesi dikunci</span>
                {teacherRow?.locked_at && (
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: '#666', marginLeft: '8px' }}>
                    {fmtTimestampWITA(teacherRow.locked_at, 'time')}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <>
              <button onClick={handleLock} disabled={locking} style={{ ...btnSmall, background: '#047857' }}>
                {locking ? 'Mengunci...' : 'Selesai & Kunci Absen'}
              </button>
              {lockError && (
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: '#DC0A1E', margin: '6px 0 0', fontWeight: 600 }}>
                  {lockError}
                </p>
              )}
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: '#666', margin: '6px 0 0' }}>
                Atau akan terkunci otomatis pukul 23:59
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function statusBadge(status: string): React.CSSProperties {
  const map: Record<string, { bg: string; color: string }> = {
    hadir:       { bg: '#DCFCE7', color: '#15803D' },
    tidak_hadir: { bg: '#FEE2E2', color: '#DC0A1E' },
    absen:       { bg: '#FEE2E2', color: '#DC0A1E' },
    izin:        { bg: '#FEF9C3', color: '#A16207' },
  };
  const c = map[status] ?? { bg: '#F3F2EE', color: '#666' };
  return {
    padding: '2px 8px', borderRadius: '4px',
    fontFamily: 'var(--font-body)', fontSize: '0.72rem', fontWeight: 700,
    background: c.bg, color: c.color,
  };
}

const cardStyle: React.CSSProperties = {
  background: '#fff', border: '1px solid #E2E1DC', borderRadius: '10px', padding: '16px',
};

const emptyCard: React.CSSProperties = {
  background: '#fff', border: '1px solid #E2E1DC', borderRadius: '10px', padding: '32px',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};

const mutedStyle: React.CSSProperties = { fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: '#666', margin: 0 };
const sectionLabel: React.CSSProperties = { fontFamily: 'var(--font-body)', fontSize: '0.75rem', fontWeight: 700, color: '#666', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.05em' };

const studentRow: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px',
  background: '#F9F9F7', borderRadius: '6px', flexWrap: 'wrap',
};

const inputStyle: React.CSSProperties = {
  padding: '7px 9px', border: '1.5px solid #E2E1DC', borderRadius: '6px',
  fontFamily: 'var(--font-body)', fontSize: '0.83rem', outline: 'none',
  color: '#0D0D0D', background: '#fff',
};

const selectSmall: React.CSSProperties = {
  ...inputStyle, cursor: 'pointer',
};

const btnSmall: React.CSSProperties = {
  padding: '8px 16px', background: '#0D5C3A', color: '#fff',
  border: 'none', borderRadius: '7px', cursor: 'pointer',
  fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.85rem',
};
