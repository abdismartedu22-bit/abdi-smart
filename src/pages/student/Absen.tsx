import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { toISODate, fmtTime, fmtTimestampWITA, nowWITAMinutes } from '../../lib/dates';
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

type HistoryRow = {
  id: string;
  session_date: string;
  status: string | null;
  note: string | null;
  checkin_at: string | null;
  locked_at: string | null;
  schedule: {
    hari: string;
    jam_mulai: string;
    jam_selesai: string;
    materi: string | null;
    groups: { nama: string; kode: string; warna: string; warna_text: string };
  } | null;
};

// Uses WITA (UTC+8) for strict timezone-correct comparison
function getWindowState(jamMulai: string): 'before' | 'open' | 'closed' {
  const [h, m] = jamMulai.split(':').map(Number);
  const startMin = h * 60 + m;
  const endMin = startMin + 15;
  const nowMin = nowWITAMinutes();
  if (nowMin < startMin) return 'before';
  if (nowMin <= endMin) return 'open';
  return 'closed';
}

function addMinutes(timeStr: string, mins: number): string {
  const [h, m] = timeStr.split(':').map(Number);
  const total = h * 60 + m + mins;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
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

type Tab = 'hari-ini' | 'riwayat';

export default function StudentAbsen() {
  const [tab, setTab] = useState<Tab>('hari-ini');

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', margin: '0 0 4px', color: '#0D0D0D' }}>
          Absensi
        </h1>
      </div>

      <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', borderBottom: '2px solid #E2E1DC' }}>
        {(['hari-ini', 'riwayat'] as Tab[]).map(t => (
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
            {t === 'hari-ini' ? 'Hari Ini' : 'Riwayat'}
          </button>
        ))}
      </div>

      {tab === 'hari-ini' ? <HariIniTab /> : <RiwayatTab />}
    </div>
  );
}

/* ===================== HARI INI TAB ===================== */

function HariIniTab() {
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

    const todaySessions = (sched ?? []) as unknown as SessionToday[];
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
      <p style={mutedStyle}>{dateLabel}</p>
      <p style={{ ...mutedStyle, fontSize: '0.75rem', color: '#999', marginBottom: '16px' }}>
        Semua waktu dalam WITA (UTC+8)
      </p>

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
                      {fmtTime(s.jam_mulai)} &ndash; {fmtTime(s.jam_selesai)} WITA
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
                    Waktu absen: {fmtTime(s.jam_mulai)} &ndash; {endWindow} WITA
                  </p>

                  {att?.locked_at ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#666' }}>Absen dikunci</span>
                      {att.status && <span style={finalBadge(att.status)}>{att.status.toUpperCase()}</span>}
                      {att.checkin_at && (
                        <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: '#888' }}>
                          check-in {fmtTimestampWITA(att.checkin_at, 'time')}
                        </span>
                      )}
                    </div>
                  ) : att?.checkin_at ? (
                    <div>
                      <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#047857', margin: '0 0 4px', fontWeight: 500 }}>
                        Absen tercatat &mdash; menunggu verifikasi pengajar
                      </p>
                      <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: '#888', margin: 0 }}>
                        check-in {fmtTimestampWITA(att.checkin_at, 'time')}
                      </p>
                    </div>
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

/* ===================== RIWAYAT TAB ===================== */

function RiwayatTab() {
  const { user } = useAuth();
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    load();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('attendance')
      .select(`
        id, session_date, status, note, checkin_at, locked_at,
        schedule:schedules!schedule_id(
          hari, jam_mulai, jam_selesai, materi,
          groups!group_id(nama, kode, warna, warna_text)
        )
      `)
      .eq('person_id', user!.id)
      .eq('person_role', 'student')
      .order('session_date', { ascending: false })
      .limit(100);
    setRows((data ?? []) as unknown as HistoryRow[]);
    setLoading(false);
  }

  const statusInfo = (row: HistoryRow): { label: string; bg: string; color: string } => {
    if (row.status === 'hadir') return { label: 'HADIR', bg: '#DCFCE7', color: '#15803D' };
    if (row.status === 'absen') return { label: 'ABSEN', bg: '#FEE2E2', color: '#DC0A1E' };
    if (row.status === 'izin')  return { label: 'IZIN',  bg: '#FEF9C3', color: '#A16207' };
    if (row.checkin_at)         return { label: 'MENUNGGU', bg: '#EFF6FF', color: '#1D4ED8' };
    return { label: 'BELUM', bg: '#F3F2EE', color: '#888' };
  };

  const finalized = rows.filter(r => r.status !== null);
  const total = finalized.length;
  const hadir = finalized.filter(r => r.status === 'hadir').length;
  const pct = total > 0 ? Math.round((hadir / total) * 100) : null;

  return (
    <div>
      {loading ? (
        <p style={mutedStyle}>Memuat...</p>
      ) : rows.length === 0 ? (
        <div style={emptyCard}>
          <p style={{ fontFamily: 'var(--font-body)', color: '#666', margin: 0 }}>Belum ada riwayat absensi.</p>
        </div>
      ) : (
        <>
          {/* Summary */}
          <div style={{ background: '#fff', border: '1px solid #E2E1DC', borderRadius: '10px', padding: '14px 18px', marginBottom: '16px', display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem' }}>
              <span style={{ color: '#22C55E', fontWeight: 700 }}>{hadir}</span>
              <span style={{ color: '#666' }}> hadir</span>
            </div>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem' }}>
              <span style={{ color: '#DC0A1E', fontWeight: 700 }}>{finalized.filter(r => r.status === 'absen').length}</span>
              <span style={{ color: '#666' }}> absen</span>
            </div>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem' }}>
              <span style={{ color: '#A16207', fontWeight: 700 }}>{finalized.filter(r => r.status === 'izin').length}</span>
              <span style={{ color: '#666' }}> izin</span>
            </div>
            {rows.filter(r => !r.status).length > 0 && (
              <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem' }}>
                <span style={{ color: '#1D4ED8', fontWeight: 700 }}>{rows.filter(r => !r.status).length}</span>
                <span style={{ color: '#666' }}> menunggu</span>
              </div>
            )}
            <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', marginLeft: 'auto' }}>
              <span style={{ fontWeight: 700, color: '#0D0D0D' }}>{pct !== null ? `${pct}%` : '-'}</span>
              <span style={{ color: '#666' }}> hadir ({total} sesi dikunci)</span>
            </div>
          </div>

          {/* History list */}
          <div style={{ background: '#fff', border: '1px solid #E2E1DC', borderRadius: '10px', overflow: 'hidden' }}>
            {rows.map((r, i) => {
              const s = r.schedule;
              const si = statusInfo(r);
              const dateObj = new Date(r.session_date + 'T00:00:00');
              const dateLabel = dateObj.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

              return (
                <div key={r.id} style={{
                  display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px',
                  borderBottom: i < rows.length - 1 ? '1px solid #F3F2EE' : 'none',
                  flexWrap: 'wrap',
                }}>
                  {s?.groups && (
                    <GrupBadge kode={s.groups.kode} warna={s.groups.warna} warna_text={s.groups.warna_text} />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.88rem', color: '#0D0D0D' }}>
                      {dateLabel}
                    </div>
                    <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: '#666' }}>
                      {s ? `${fmtTime(s.jam_mulai)}–${fmtTime(s.jam_selesai)} WITA` : ''}
                      {s?.materi ? ` · ${s.materi}` : ''}
                    </div>
                    {r.checkin_at && (
                      <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: '#999' }}>
                        check-in {fmtTimestampWITA(r.checkin_at, 'time')}
                      </div>
                    )}
                    {r.note && (
                      <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: '#A16207', marginTop: '1px' }}>
                        {r.note}
                      </div>
                    )}
                  </div>
                  <span style={{ padding: '3px 10px', borderRadius: '4px', fontFamily: 'var(--font-body)', fontSize: '0.72rem', fontWeight: 700, background: si.bg, color: si.color, flexShrink: 0 }}>
                    {si.label}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

/* ===================== SHARED STYLES ===================== */

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

const mutedStyle: React.CSSProperties = { fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#666', margin: '0 0 8px' };

const btnAbsen: React.CSSProperties = {
  padding: '10px 28px', background: '#0F1F6B', color: '#fff',
  border: 'none', borderRadius: '8px', cursor: 'pointer',
  fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.9rem',
};
