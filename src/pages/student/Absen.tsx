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
  status: 'hadir' | 'absen' | 'izin' | 'tidak_hadir' | null;
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
function getWindowState(jamMulai: string, jamSelesai: string): 'before' | 'open' | 'closed' {
  const [sh, sm] = jamMulai.split(':').map(Number);
  const [eh, em] = jamSelesai.split(':').map(Number);
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;
  const nowMin = nowWITAMinutes();
  if (nowMin < startMin) return 'before';
  if (nowMin <= endMin) return 'open';
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
              color: tab === t ? '#0D5C3A' : '#666',
              borderBottom: tab === t ? '2px solid #0D5C3A' : '2px solid transparent',
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
  const [checkInError, setCheckInError] = useState<string>('');

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

  // Poll attendance every 10 s so locked_at reflects teacher's action
  useEffect(() => {
    if (!user || sessions.length === 0) return;
    const todayISO = toISODate(new Date());
    const t = setInterval(async () => {
      const { data: att } = await supabase
        .from('attendance')
        .select('id, schedule_id, status, checkin_at, locked_at')
        .in('schedule_id', sessions.map(s => s.id))
        .eq('person_id', user.id)
        .eq('session_date', todayISO);
      if (att) {
        const map: Record<string, AttendanceRow> = {};
        att.forEach((a: any) => { map[a.schedule_id] = a as AttendanceRow; });
        setAttendance(map);
      }
    }, 10_000);
    return () => clearInterval(t);
  }, [user, sessions]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCheckIn(scheduleId: string) {
    if (!user) return;
    setCheckingIn(scheduleId);
    setCheckInError('');
    const today = toISODate(new Date());
    const existingRow = attendance[scheduleId];

    let error;
    if (existingRow?.id) {
      ({ error } = await supabase.from('attendance').update({
        checkin_at: new Date().toISOString(),
      }).eq('id', existingRow.id));
    } else {
      ({ error } = await supabase.from('attendance').insert({
        schedule_id: scheduleId,
        session_date: today,
        person_id: user.id,
        person_role: 'student',
        checkin_at: new Date().toISOString(),
        status: null,
      }));
    }

    setCheckingIn(null);
    if (error) {
      console.error('Absen error:', error);
      setCheckInError(`Gagal mencatat absen: ${error.message}`);
    }
    load();
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
            const winState = getWindowState(s.jam_mulai, s.jam_selesai);
            const endWindow = fmtTime(s.jam_selesai);

            return (
              <div key={s.id} style={card}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '12px' }}>
                  <GrupBadge nama={s.groups.nama} warna={s.groups.warna} warna_text={s.groups.warna_text} />
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
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: '#aaa', margin: '0 0 10px' }}>
                    Waktu absen: {fmtTime(s.jam_mulai)} &ndash; {endWindow} WITA
                    {winState === 'closed' && <span style={{ color: '#DC0A1E' }}> (sudah lewat)</span>}
                  </p>

                  {att?.locked_at ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 12px', borderRadius: '6px', background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#15803D" strokeWidth="2.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                        <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', fontWeight: 700, color: '#15803D' }}>TERKUNCI</span>
                      </span>
                      {att.status && (
                        <span style={finalBadge(att.status)}>
                          {att.status === 'tidak_hadir' || att.status === 'absen' ? 'TIDAK HADIR' : att.status.toUpperCase()}
                        </span>
                      )}
                      {att.checkin_at && (
                        <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: '#888' }}>
                          check-in {fmtTimestampWITA(att.checkin_at, 'time')}
                        </span>
                      )}
                    </div>
                  ) : att?.checkin_at ? (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 12px', borderRadius: '6px', background: '#D1FAE5', border: '1px solid #6EE7B7' }}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#047857" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                          <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', fontWeight: 700, color: '#047857' }}>ABSEN TERCATAT</span>
                        </span>
                      </div>
                      <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: '#888', margin: 0 }}>
                        check-in {fmtTimestampWITA(att.checkin_at, 'time')} &middot; menunggu verifikasi pengajar
                      </p>
                    </div>
                  ) : (
                    <div>
                      <button
                        onClick={() => handleCheckIn(s.id)}
                        disabled={checkingIn === s.id}
                        style={btnAbsen}
                      >
                        {checkingIn === s.id ? 'Mencatat...' : 'Absen Sekarang'}
                      </button>
                      {checkInError && (
                        <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: '#DC0A1E', margin: '6px 0 0' }}>
                          {checkInError}
                        </p>
                      )}
                    </div>
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
    if (row.status === 'tidak_hadir' || row.status === 'absen') return { label: 'TIDAK HADIR', bg: '#FEE2E2', color: '#DC0A1E' };
    if (row.status === 'izin')  return { label: 'IZIN',  bg: '#FEF9C3', color: '#A16207' };
    if (row.checkin_at)         return { label: 'MENUNGGU', bg: '#EFF6FF', color: '#1D4ED8' };
    return { label: 'BELUM', bg: '#F3F2EE', color: '#888' };
  };

  const finalized = rows.filter(r => r.status !== null);
  const total = finalized.length;
  const hadir = finalized.filter(r => r.status === 'hadir').length;
  const tidakHadir = finalized.filter(r => r.status === 'tidak_hadir' || r.status === 'absen' || r.status === 'izin').length;
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
              <span style={{ color: '#DC0A1E', fontWeight: 700 }}>{tidakHadir}</span>
              <span style={{ color: '#666' }}> tidak hadir</span>
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
                    <GrupBadge nama={s.groups.nama} warna={s.groups.warna} warna_text={s.groups.warna_text} />
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
    hadir:       { bg: '#DCFCE7', color: '#15803D' },
    tidak_hadir: { bg: '#FEE2E2', color: '#DC0A1E' },
    absen:       { bg: '#FEE2E2', color: '#DC0A1E' },
    izin:        { bg: '#FEF9C3', color: '#A16207' },
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
  padding: '10px 28px', background: '#0D5C3A', color: '#fff',
  border: 'none', borderRadius: '8px', cursor: 'pointer',
  fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.9rem',
};
