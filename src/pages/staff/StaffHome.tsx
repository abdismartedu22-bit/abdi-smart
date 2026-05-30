import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { toISODate, fmtTime } from '../../lib/dates';
import GrupBadge from '../../components/shared/GrupBadge';
import DashboardBanner from '../../components/shared/DashboardBanner';

type TodaySession = {
  id: string;
  hari: string;
  jam_mulai: string;
  jam_selesai: string;
  materi: string | null;
  lokasi: string | null;
  groups: { id: string; nama: string; kode: string; warna: string; warna_text: string };
  teacher: { id: string; display_name: string };
};

function getWeekStartISO(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return toISODate(d);
}

function getWeekEndISO(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? 0 : 7 - day;
  d.setDate(d.getDate() + diff);
  return toISODate(d);
}

function getTodayHari(): string {
  return ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][new Date().getDay()];
}

export default function StaffHome() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [todaySessions, setTodaySessions] = useState<TodaySession[]>([]);
  const [weekStats, setWeekStats] = useState({ sessions: 0, teachers: 0, realisasi: 0 });
  const [todayAttendance, setTodayAttendance] = useState<Record<string, string | null>>({});

  const dateLabel = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true);
    const today = toISODate(new Date());
    const todayHari = getTodayHari();
    const weekStart = getWeekStartISO();
    const weekEnd = getWeekEndISO();

    const [todayRes, weekRes] = await Promise.all([
      supabase.from('schedules')
        .select('id, hari, jam_mulai, jam_selesai, materi, lokasi, groups!group_id(id,nama,kode,warna,warna_text), teacher:profiles!teacher_id(id,display_name)')
        .eq('week_start', weekStart)
        .eq('hari', todayHari)
        .order('jam_mulai'),
      supabase.from('schedules')
        .select('id, teacher_id')
        .gte('week_start', weekStart)
        .lte('week_start', weekEnd),
    ]);

    const sessions = (todayRes.data ?? []) as unknown as TodaySession[];
    setTodaySessions(sessions);

    const weekSessions = weekRes.data ?? [];
    const uniqueTeachers = new Set(weekSessions.map((s: any) => s.teacher_id));

    if (weekSessions.length > 0) {
      const { count: realisasiCount } = await supabase
        .from('attendance')
        .select('id', { count: 'exact', head: true })
        .in('schedule_id', weekSessions.map((s: any) => s.id))
        .eq('person_role', 'teacher')
        .not('sesi_status', 'is', null);

      setWeekStats({
        sessions: weekSessions.length,
        teachers: uniqueTeachers.size,
        realisasi: realisasiCount ?? 0,
      });
    } else {
      setWeekStats({ sessions: 0, teachers: 0, realisasi: 0 });
    }

    if (sessions.length > 0) {
      const { data: att } = await supabase
        .from('attendance')
        .select('schedule_id, sesi_status')
        .in('schedule_id', sessions.map(s => s.id))
        .eq('session_date', today)
        .eq('person_role', 'teacher');
      const map: Record<string, string | null> = {};
      (att ?? []).forEach((a: any) => { map[a.schedule_id] = a.sesi_status; });
      setTodayAttendance(map);
    }

    setLoading(false);
  }

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', margin: '0 0 4px', color: '#0D0D0D' }}>
          Hai, {profile?.display_name ?? 'Staff'}!
        </h1>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#666', margin: 0 }}>{dateLabel}</p>
      </div>

      {loading ? (
        <p style={muted}>Memuat...</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          <DashboardBanner />

          {/* Today's sessions */}
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <p style={sectionLabel}>Sesi Hari Ini</p>
              <button onClick={() => navigate('/staff/jadwal')} style={linkBtn}>Kelola Jadwal</button>
            </div>
            {todaySessions.length === 0 ? (
              <p style={muted}>Tidak ada sesi hari ini.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {todaySessions.map(s => {
                  const sesiStatus = todayAttendance[s.id];
                  return (
                    <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', background: '#F9F9F7', borderRadius: '8px', flexWrap: 'wrap' }}>
                      <GrupBadge kode={s.groups.kode} warna={s.groups.warna} warna_text={s.groups.warna_text} />
                      <span style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.85rem', color: '#0D0D0D' }}>{fmtTime(s.jam_mulai)}</span>
                      <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#555', flex: 1 }}>{s.materi ?? 'tanpa materi'}</span>
                      <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: '#666' }}>{s.teacher.display_name}</span>
                      {sesiStatus ? (
                        <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.72rem', fontWeight: 700, color: sesiStatus === 'terlaksana' ? '#15803D' : '#DC0A1E', background: sesiStatus === 'terlaksana' ? '#DCFCE7' : '#FEE2E2', padding: '2px 8px', borderRadius: '4px' }}>
                          {sesiStatus.toUpperCase()}
                        </span>
                      ) : (
                        <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.72rem', color: '#999' }}>BELUM</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick actions */}
          <div style={card}>
            <p style={sectionLabel}>Aksi Cepat</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '10px', marginTop: '4px' }}>
              {[
                { label: '+ Tambah Jadwal', path: '/staff/jadwal', color: '#0D5C3A' },
                { label: '+ Input Hasil TO', path: '/staff/hasil-to', color: '#047857' },
                { label: 'Download Laporan', path: '/staff/download', color: '#4B5563' },
              ].map(a => (
                <button
                  key={a.path}
                  onClick={() => navigate(a.path)}
                  style={{ padding: '12px 10px', background: a.color, color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.85rem', textAlign: 'center' }}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>

          {/* Week stats */}
          <div style={card}>
            <p style={sectionLabel}>Minggu Ini</p>
            <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginTop: '4px' }}>
              <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.88rem', color: '#0D0D0D' }}>
                <span style={{ fontWeight: 700 }}>{weekStats.sessions}</span> <span style={{ color: '#666' }}>sesi</span>
              </div>
              <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.88rem', color: '#0D0D0D' }}>
                <span style={{ fontWeight: 700 }}>{weekStats.teachers}</span> <span style={{ color: '#666' }}>pengajar</span>
              </div>
              <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.88rem', color: '#0D0D0D' }}>
                <span style={{ fontWeight: 700 }}>{weekStats.realisasi}</span><span style={{ color: '#666' }}>/{weekStats.sessions} realisasi terisi</span>
              </div>
            </div>
          </div>

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
