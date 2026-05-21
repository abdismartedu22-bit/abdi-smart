import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { toISODate, fmtTime } from '../../lib/dates';
import GrupBadge from '../../components/shared/GrupBadge';

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
  const locked = !!teacherRow?.locked_at;

  const [saving, setSaving] = useState<string | null>(null);
  const [locking, setLocking] = useState(false);
  const [sesiStatus, setSesiStatus] = useState<string>(teacherRow?.sesi_status ?? 'terlaksana');
  const [note, setNote] = useState<string>(teacherRow?.note ?? '');
  const [studentStatuses, setStudentStatuses] = useState<Record<string, { status: string; note: string }>>(() => {
    const init: Record<string, { status: string; note: string }> = {};
    sessionStudents.forEach(st => {
      const att = attendance.find(a => a.person_id === st.student_id && a.person_role === 'student');
      init[st.student_id] = { status: att?.status ?? 'absen', note: att?.note ?? '' };
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
    setSaving(null);
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
    const now = new Date().toISOString();

    // Upsert teacher row with lock
    if (teacherRow) {
      await supabase.from('attendance').update({ sesi_status: sesiStatus, note: note || null, locked_at: now }).eq('id', teacherRow.id);
    } else {
      await supabase.from('attendance').insert({
        schedule_id: session.id, session_date: today,
        person_id: teacherId, person_role: 'teacher',
        status: 'hadir', sesi_status: sesiStatus, note: note || null,
        checkin_at: now, locked_at: now,
      });
    }

    // Lock all student rows and set final statuses
    for (const st of sessionStudents) {
      const att = attendance.find(a => a.person_id === st.student_id && a.person_role === 'student');
      const finalStatus = studentStatuses[st.student_id]?.status ?? 'absen';
      const finalNote = studentStatuses[st.student_id]?.note ?? '';
      if (att) {
        await supabase.from('attendance').update({ status: finalStatus, note: finalNote || null, locked_at: now, verified_by: teacherId, verified_at: now }).eq('id', att.id);
      } else {
        await supabase.from('attendance').insert({
          schedule_id: session.id, session_date: today,
          person_id: st.student_id, person_role: 'student',
          status: finalStatus, note: finalNote || null,
          locked_at: now, verified_by: teacherId, verified_at: now,
        });
      }
    }

    setLocking(false);
    onRefresh();
  }

  return (
    <div style={cardStyle}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '16px' }}>
        <GrupBadge kode={session.groups.kode} warna={session.groups.warna} warna_text={session.groups.warna_text} />
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.9rem', color: '#0D0D0D' }}>
            {fmtTime(session.jam_mulai)} &ndash; {fmtTime(session.jam_selesai)}
          </div>
          {session.materi && <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#0D0D0D', marginTop: '2px' }}>{session.materi}</div>}
          {session.lokasi && <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: '#666', marginTop: '1px' }}>@ {session.lokasi}</div>}
        </div>
        {locked && <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', fontWeight: 700, color: '#666', background: '#F3F2EE', padding: '3px 8px', borderRadius: '4px' }}>TERKUNCI</span>}
      </div>

      <div style={{ borderTop: '1px solid #E2E1DC', paddingTop: '14px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

        {/* Teacher check-in */}
        <div>
          <p style={sectionLabel}>Kehadiran Saya</p>
          {teacherRow?.status === 'hadir' ? (
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#047857', margin: 0, fontWeight: 500 }}>
              Sudah hadir {teacherRow.checkin_at ? `(${new Date(teacherRow.checkin_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })})` : ''}
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
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '8px' }}>
            {(['terlaksana', 'tidak', 'ditunda'] as const).map(s => (
              <label key={s} style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: locked ? 'default' : 'pointer', fontFamily: 'var(--font-body)', fontSize: '0.85rem' }}>
                <input type="radio" name={`sesi_${session.id}`} value={s} checked={sesiStatus === s} onChange={() => !locked && setSesiStatus(s)} disabled={locked} />
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </label>
            ))}
          </div>
          <input
            value={note}
            onChange={e => setNote(e.target.value)}
            disabled={locked}
            placeholder="Catatan (opsional)"
            style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }}
          />
          {!locked && (
            <button onClick={saveSesiInfo} disabled={saving === 'sesi'} style={{ ...btnSmall, marginTop: '8px' }}>
              {saving === 'sesi' ? 'Menyimpan...' : 'Simpan Status Sesi'}
            </button>
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
                            check-in {new Date(sAtt.checkin_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
                      {locked ? (
                        <span style={statusBadge(cur.status)}>{cur.status.toUpperCase()}</span>
                      ) : (
                        <>
                          <select
                            value={cur.status}
                            onChange={e => {
                              const val = e.target.value;
                              setStudentStatuses(prev => ({ ...prev, [st.student_id]: { ...prev[st.student_id], status: val } }));
                              updateStudentStatus(st.student_id, val, cur.note);
                            }}
                            style={selectSmall}
                          >
                            <option value="hadir">Hadir</option>
                            <option value="absen">Absen</option>
                            <option value="izin">Izin</option>
                          </select>
                          {cur.status === 'izin' && (
                            <input
                              value={cur.note}
                              onChange={e => setStudentStatuses(prev => ({ ...prev, [st.student_id]: { ...prev[st.student_id], note: e.target.value } }))}
                              onBlur={() => updateStudentStatus(st.student_id, cur.status, cur.note)}
                              placeholder="alasan..."
                              style={{ ...inputStyle, width: '120px' }}
                            />
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Lock button */}
        {!locked && (
          <div style={{ borderTop: '1px solid #E2E1DC', paddingTop: '14px' }}>
            <button onClick={handleLock} disabled={locking} style={{ ...btnSmall, background: '#047857' }}>
              {locking ? 'Mengunci...' : 'Selesai & Kunci Absen'}
            </button>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: '#666', margin: '6px 0 0' }}>
              Atau akan terkunci otomatis pukul 23:59
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function statusBadge(status: string): React.CSSProperties {
  const map: Record<string, { bg: string; color: string }> = {
    hadir: { bg: '#DCFCE7', color: '#15803D' },
    absen: { bg: '#FEE2E2', color: '#DC0A1E' },
    izin:  { bg: '#FEF9C3', color: '#A16207' },
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
  padding: '8px 16px', background: '#0F1F6B', color: '#fff',
  border: 'none', borderRadius: '7px', cursor: 'pointer',
  fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.85rem',
};
