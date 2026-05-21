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
  teacher: { id: string; display_name: string } | null;
};

type AttendanceRow = {
  id: string;
  schedule_id: string;
  status: 'hadir' | 'absen' | 'izin' | null;
  checkin_at: string | null;
  locked_at: string | null;
};

function getWindowState(jamMulai: string): 'before' | 'open' | 'closed' {
  const now = new Date();
  const [h, m] = jamMulai.split(':').map(Number);
  const start = new Date(now);
  start.setHours(h, m, 0, 0);
  const end = new Date(start.getTime() + 15 * 60 * 1000);
  if (now < start) return 'before';
  if (now <= end) return 'open';
  return 'closed';
}

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

function addMinutes(timeStr: string, mins: number): string {
  const [h, m] = timeStr.split(':').map(Number);
  const total = h * 60 + m + mins;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export default function StudentAbsen() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<SessionToday[]>([]);
  const [attendance, setAttendance] = useState<Record<string, AttendanceRow>>({});
  const [loading, setLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState<string | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const today = toISODate(new Date());
    const weekStart = getWeekStartISO();
    const todayHari = getTodayHari();

    const { data: sg } = await supabase
      .from('student_groups')
      .select('group_id')
      .eq('student_id', user.id);
    const groupIds = (sg ?? []).map(x => x.group_id as string);

    if (groupIds.length === 0) {
      setSessions([]);
      setAttendance({});
      setLoading(false);
      return;
    }

    const { data: sched } = await supabase
      .from('schedules')
      .select('id, hari, jam_mulai, jam_selesai, materi, lokasi, groups!group_id(id,nama,kode,warna,warna_text), teacher:profiles!teacher_id(id,display_name)')
      .in('group_id', groupIds)
      .eq('week_start', weekStart)
      .eq('hari', todayHari)
      .order('jam_mulai');

    const todaySessions = (sched ?? []) as SessionToday[];
    setSessions(todaySessions);

    if (todaySessions.length > 0) {
      const { data: att } = await supabase
        .from('attendance')
        .select('id, schedule_id, status, checkin_at, locked_at')
        .in('schedule_id', todaySessions.map(s => s.id))
        .eq('person_id', user.id)
        .eq('session_date', today);

      const map: Record<string, AttendanceRow> = {};
      (att ?? []).forEach(a => { map[a.schedule_id] = a as AttendanceRow; });
      setAttendance(map);
    }

    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  async function handleCheckIn(scheduleId: string) {
    if (!user) return;
    setCheckingIn(scheduleId);
    const today = toISODate(new Date());
    const { error } = await supabase.from('attendance').insert({
      schedule_id: scheduleId,
      session_date: today,
      person_id: user.id,
      person_role: 'student',
      checkin_at: new Date().toISOString(),
      status: null,
    });
    setCheckingIn(null);
    if (!error) load();
  }

  const today = new Date();
  const dateLabel = today.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', margin: '0 0 4px', color: '#0D0D0D' }}>
          Absen Hari Ini
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {sessions.map(s => {
            const att = attendance[s.id];
            const winState = getWindowState(s.jam_mulai);
            const endWindow = addMinutes(fmtTime(s.jam_mulai), 15);

            return (
              <div key={s.id} style={card}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '12px' }}>
                  <GrupBadge kode={s.groups.kode} warna={s.groups.warna} warna_text={s.groups.warna_text} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.9rem', color: '#0D0D0D' }}>
                      {fmtTime(s.jam_mulai)} &ndash; {fmtTime(s.jam_selesai)}
                    </div>
                    {s.materi && (
                      <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#0D0D0D', marginTop: '2px' }}>
                        {s.materi}
                      </div>
                    )}
                    <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: '#666', marginTop: '2px' }}>
                      {s.teacher?.display_name ?? 'Pengajar'}{s.lokasi && ` @ ${s.lokasi}`}
                    </div>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid #E2E1DC', paddingTop: '12px' }}>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: '#666', margin: '0 0 10px' }}>
                    Waktu absen: {fmtTime(s.jam_mulai)} &ndash; {endWindow}
                  </p>

                  {att?.locked_at ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#666' }}>Absen dikunci</span>
                      {att.status && <span style={finalBadge(att.status)}>{att.status.toUpperCase()}</span>}
                    </div>
                  ) : att?.checkin_at ? (
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#047857', margin: 0, fontWeight: 500 }}>
                      Absen tercatat &mdash; menunggu verifikasi pengajar
                    </p>
                  ) : winState === 'before' ? (
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#666', margin: 0 }}>
                      Belum waktunya absen
                    </p>
                  ) : winState === 'open' ? (
                    <button
                      onClick={() => handleCheckIn(s.id)}
                      disabled={checkingIn === s.id}
                      style={btnAbsen}
                    >
                      {checkingIn === s.id ? 'Mencatat...' : 'Absen Sekarang'}
                    </button>
                  ) : (
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#DC0A1E', margin: 0 }}>
                      Waktu absen sudah habis
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function finalBadge(status: string): React.CSSProperties {
  const colors: Record<string, { bg: string; color: string }> = {
    hadir: { bg: '#DCFCE7', color: '#15803D' },
    absen: { bg: '#FEE2E2', color: '#DC0A1E' },
    izin:  { bg: '#FEF9C3', color: '#A16207' },
  };
  const c = colors[status] ?? { bg: '#F3F2EE', color: '#666' };
  return {
    display: 'inline-block', padding: '3px 10px', borderRadius: '4px',
    fontFamily: 'var(--font-body)', fontSize: '0.75rem', fontWeight: 700,
    background: c.bg, color: c.color,
  };
}

const card: React.CSSProperties = {
  background: '#fff', border: '1px solid #E2E1DC', borderRadius: '10px', padding: '16px',
};

const emptyCard: React.CSSProperties = {
  background: '#fff', border: '1px solid #E2E1DC', borderRadius: '10px', padding: '32px',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};

const mutedStyle: React.CSSProperties = { fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#666', margin: 0 };

const btnAbsen: React.CSSProperties = {
  padding: '10px 28px', background: '#0F1F6B', color: '#fff',
  border: 'none', borderRadius: '8px', cursor: 'pointer',
  fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.9rem',
};
