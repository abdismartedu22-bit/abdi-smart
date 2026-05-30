import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { toISODate, fmtTime } from '../../lib/dates';
import GrupBadge from '../../components/shared/GrupBadge';
import DashboardBanner from '../../components/shared/DashboardBanner';

type Session = {
  id: string;
  hari: string;
  jam_mulai: string;
  jam_selesai: string;
  materi: string | null;
  lokasi: string | null;
  groups: { id: string; nama: string; kode: string; warna: string; warna_text: string };
};

function getWeekStartISO(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return toISODate(d);
}

function getTodayHari(): string {
  return ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][new Date().getDay()];
}

export default function TeacherHome() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [todaySessions, setTodaySessions] = useState<Session[]>([]);
  const [weekSessions, setWeekSessions] = useState<Session[]>([]);
  const [attendanceCounts, setAttendanceCounts] = useState<Record<string, number>>({});
  const [monthlyCount, setMonthlyCount] = useState(0);

  const dateLabel = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const todayHari = getTodayHari();

  useEffect(() => {
    if (!user) return;
    load();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true);
    const weekStart = getWeekStartISO();
    const today = toISODate(new Date());
    const todayH = getTodayHari();
    const monthStart = toISODate(new Date(new Date().getFullYear(), new Date().getMonth(), 1));

    const { data: weekData } = await supabase
      .from('schedules')
      .select('id, hari, jam_mulai, jam_selesai, materi, lokasi, groups!group_id(id,nama,kode,warna,warna_text)')
      .eq('teacher_id', user!.id)
      .eq('week_start', weekStart)
      .order('jam_mulai');

    const all = (weekData ?? []) as unknown as Session[];
    const todayList = all.filter(s => s.hari === todayH);
    setTodaySessions(todayList);
    setWeekSessions(all);

    if (todayList.length > 0) {
      const { data: att } = await supabase
        .from('attendance')
        .select('schedule_id')
        .in('schedule_id', todayList.map(s => s.id))
        .eq('session_date', today)
        .eq('person_role', 'student')
        .not('checkin_at', 'is', null);

      const counts: Record<string, number> = {};
      todayList.forEach(s => { counts[s.id] = 0; });
      (att ?? []).forEach((a: any) => { counts[a.schedule_id] = (counts[a.schedule_id] ?? 0) + 1; });
      setAttendanceCounts(counts);
    }

    const { count: mc } = await supabase
      .from('attendance')
      .select('id', { count: 'exact', head: true })
      .eq('person_id', user!.id)
      .eq('person_role', 'teacher')
      .eq('sesi_status', 'terlaksana')
      .gte('session_date', monthStart)
      .lte('session_date', today);
    setMonthlyCount(mc ?? 0);

    setLoading(false);
  }

  const hariOrder = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
  const todayIdx = hariOrder.indexOf(todayHari);
  const upcomingWeek = weekSessions.filter(s => {
    const idx = hariOrder.indexOf(s.hari);
    return idx > todayIdx;
  });

  function getDaysUntil(hari: string): string {
    const idx = hariOrder.indexOf(hari);
    const diff = idx - todayIdx;
    if (diff === 1) return 'besok';
    return `${diff} hari`;
  }

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', margin: '0 0 4px', color: '#0D0D0D' }}>
          Hai, {profile?.display_name ?? '...'}!
        </h1>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#666', margin: 0 }}>{dateLabel}</p>
      </div>

      {loading ? (
        <p style={muted}>Memuat...</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          <DashboardBanner />

          {/* Monthly teaching count */}
          <div style={{ background: '#fff', border: '1px solid #E2E1DC', borderRadius: '10px', padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: '#E8F5EC', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0D5C3A" strokeWidth="2.2">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
                <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" />
              </svg>
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', color: '#0D5C3A', lineHeight: 1, fontWeight: 900 }}>{monthlyCount}</div>
              <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: '#666', marginTop: '2px' }}>
                sesi terlaksana bulan {new Date().toLocaleDateString('id-ID', { month: 'long' })}
              </div>
            </div>
          </div>

          {/* Today's sessions */}
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <p style={sectionLabel}>Sesi Hari Ini</p>
              <button onClick={() => navigate('/teacher/realisasi')} style={linkBtn}>Buka Realisasi</button>
            </div>
            {todaySessions.length === 0 ? (
              <p style={muted}>Tidak ada sesi hari ini.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {todaySessions.map(s => (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '12px', background: '#F9F9F7', borderRadius: '8px' }}>
                    <GrupBadge kode={s.groups.kode} warna={s.groups.warna} warna_text={s.groups.warna_text} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.9rem', color: '#0D0D0D' }}>
                        {fmtTime(s.jam_mulai)} &ndash; {fmtTime(s.jam_selesai)}
                      </div>
                      {s.materi && <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#0D0D0D', marginTop: '2px' }}>{s.materi}</div>}
                      {s.lokasi && <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: '#666', marginTop: '1px' }}>@ {s.lokasi}</div>}
                      <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: '#666', marginTop: '4px' }}>
                        {attendanceCounts[s.id] ?? 0} siswa sudah check-in
                      </div>
                    </div>
                    <button
                      onClick={() => navigate('/teacher/realisasi')}
                      style={{ padding: '6px 12px', background: '#0D5C3A', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.8rem', flexShrink: 0 }}
                    >
                      Buka
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Upcoming this week */}
          {upcomingWeek.length > 0 && (
            <div style={card}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <p style={sectionLabel}>Sesi Minggu Ini</p>
                <button onClick={() => navigate('/teacher/jadwal')} style={linkBtn}>Lihat Jadwal</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {upcomingWeek.map(s => (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', background: '#F9F9F7', borderRadius: '7px', flexWrap: 'wrap' }}>
                    <GrupBadge kode={s.groups.kode} warna={s.groups.warna} warna_text={s.groups.warna_text} />
                    <span style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.85rem', color: '#0D0D0D' }}>{s.hari}</span>
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#555' }}>{fmtTime(s.jam_mulai)}</span>
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#555', flex: 1 }}>{s.materi ?? '-'}</span>
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: '#888' }}>{getDaysUntil(s.hari)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {weekSessions.length === 0 && todaySessions.length === 0 && (
            <div style={{ background: '#fff', border: '1px solid #E2E1DC', borderRadius: '10px', padding: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p style={muted}>Tidak ada sesi minggu ini.</p>
            </div>
          )}

        </div>
      )}
    </div>
  );
}

const muted: React.CSSProperties = { fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#666', margin: 0 };
const card: React.CSSProperties = {
  background: '#fff', border: '1px solid #E2E1DC', borderRadius: '10px', padding: '18px',
};
const sectionLabel: React.CSSProperties = {
  fontFamily: 'var(--font-body)', fontSize: '0.75rem', fontWeight: 700, color: '#666',
  margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em',
};
const linkBtn: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer',
  fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: '#0D5C3A', fontWeight: 600, padding: 0,
};
